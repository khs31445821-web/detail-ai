"use server";

import { revalidatePath } from "next/cache";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import {
  loadCategoryLineageKeys,
  loadResolvedCategoryFacts,
} from "@/lib/category-facts";
import { getOpenAIClient, getProductAnalysisModel } from "@/lib/openai";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace/get-or-create-workspace";

import {
  analyzeProductImages,
  saveProductFacts,
  type AnalyzerActionState,
} from "./actions";

const projectIdSchema = z.string().uuid();
const sellerFactSchema = z.object({
  facts: z
    .array(
      z.object({
        factKey: z.string().trim().min(1).max(100),
        value: z.string().trim().min(1).max(1000),
        evidence: z.string().trim().min(1).max(300),
      })
    )
    .max(20),
});

type FactDefinition = {
  id: string;
  key: string;
  display_name: string;
  value_type: string;
};

type CategoryFact = {
  fact_definition_id: string;
  fact_definitions: FactDefinition | FactDefinition[] | null;
};

function getDefinition(relation: FactDefinition | FactDefinition[] | null) {
  return Array.isArray(relation) ? relation[0] : relation;
}

function parseExplicitValue(valueType: string, rawValue: string) {
  const normalizedType = valueType.toUpperCase();
  const value = rawValue.trim();

  if (normalizedType.includes("BOOLEAN")) {
    if (value === "true") return true;
    if (value === "false") return false;
    return undefined;
  }

  if (
    normalizedType.includes("NUMBER") ||
    normalizedType.includes("INTEGER") ||
    normalizedType.includes("DECIMAL")
  ) {
    if (!/^-?\d+(?:\.\d+)?$/.test(value)) return undefined;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : undefined;
  }

  return value || undefined;
}

async function organizeSellerText(
  projectId: string,
  externalAnalysisConsent: boolean
): Promise<{ savedCount: number; skipped: boolean }> {
  if (!externalAnalysisConsent) return { savedCount: 0, skipped: true };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 만료되었습니다.");

  const workspace = await getOrCreateWorkspace();
  if (!workspace) throw new Error("작업공간을 찾지 못했습니다.");

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, product_id")
    .eq("id", projectId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (projectError) throw projectError;
  if (!project) throw new Error("프로젝트를 찾을 수 없습니다.");

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, name, description, category_key")
    .eq("id", project.product_id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (productError) throw productError;
  if (!product?.category_key) throw new Error("먼저 상품 카테고리를 선택해주세요.");

  const sellerText = [product.name, product.description]
    .filter(Boolean)
    .join("\n")
    .trim();
  if (!sellerText) return { savedCount: 0, skipped: true };

  const openAI = getOpenAIClient();
  if (!openAI) throw new Error("AI 분석 설정이 필요합니다.");

  const lineage = await loadCategoryLineageKeys(supabase, product.category_key);
  const catalog = await loadResolvedCategoryFacts(supabase, lineage);
  const categoryFacts = catalog.facts as CategoryFact[];
  const definitions = categoryFacts
    .map((fact) => getDefinition(fact.fact_definitions))
    .filter((definition): definition is FactDefinition => Boolean(definition));
  if (definitions.length === 0) return { savedCount: 0, skipped: true };

  const response = await openAI.responses.parse({
    model: getProductAnalysisModel(),
    store: false,
    instructions:
      "당신은 판매자가 직접 적은 상품 설명을 구조화하는 엄격한 데이터 정리자입니다. 판매자가 명시적으로 말한 내용만 추출하고 추론하지 마세요. 성능, 인증, 원산지, 소재, 수치 등을 상식이나 상품명에서 확대 해석하지 마세요. 잘 모르겠다고 적힌 내용은 Fact로 추출하지 마세요.",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "아래 판매자 입력을 허용된 상품 항목으로만 정리하세요.",
              "evidence에는 판매자 입력에서 실제로 존재하는 짧은 문구를 그대로 넣으세요.",
              "BOOLEAN은 value를 true 또는 false로, NUMBER/INTEGER/DECIMAL은 단위 없는 숫자로, 그 외는 짧은 문자열로 반환하세요.",
              "확실하지 않거나 직접 말하지 않은 값은 생략하세요.",
              `허용 항목: ${JSON.stringify(
                definitions.map((definition) => ({
                  key: definition.key,
                  displayName: definition.display_name,
                  valueType: definition.value_type,
                }))
              )}`,
              `판매자 입력:\n${sellerText}`,
            ].join("\n"),
          },
        ],
      },
    ],
    text: {
      format: zodTextFormat(sellerFactSchema, "seller_product_facts"),
    },
    max_output_tokens: 1400,
  });

  const parsed = response.output_parsed;
  if (!parsed) throw new Error("상품 정보를 구조화하지 못했습니다.");

  const definitionByKey = new Map(
    definitions.map((definition) => [definition.key, definition])
  );
  const candidates = parsed.facts.flatMap((fact) => {
    const definition = definitionByKey.get(fact.factKey);
    if (!definition) return [];
    if (!sellerText.includes(fact.evidence)) return [];
    const value = parseExplicitValue(definition.value_type, fact.value);
    if (value === undefined) return [];
    return [{ definition, value }];
  });

  if (candidates.length === 0) return { savedCount: 0, skipped: false };

  const { data: existingRows, error: existingError } = await supabase
    .from("product_facts")
    .select("id, fact_definition_id, locked")
    .eq("product_id", product.id)
    .in(
      "fact_definition_id",
      candidates.map(({ definition }) => definition.id)
    );
  if (existingError) throw existingError;

  const existingByDefinition = new Map(
    (existingRows ?? []).map((row) => [row.fact_definition_id, row])
  );
  let savedCount = 0;

  for (const { definition, value } of candidates) {
    const existing = existingByDefinition.get(definition.id);
    if (existing?.locked) continue;

    if (existing) {
      const { error } = await supabase
        .from("product_facts")
        .update({
          value_json: value,
          source: "USER_INPUT",
          status: "CONFIRMED",
          confidence: 1,
        })
        .eq("id", existing.id)
        .eq("product_id", product.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("product_facts").insert({
        product_id: product.id,
        fact_definition_id: definition.id,
        value_json: value,
        source: "USER_INPUT",
        status: "CONFIRMED",
        confidence: 1,
        locked: false,
        created_by: user.id,
      });
      if (error) throw error;
    }
    savedCount += 1;
  }

  return { savedCount, skipped: false };
}

export async function prepareSmartAnalysis(
  projectId: string,
  _previousState: AnalyzerActionState,
  formData: FormData
): Promise<AnalyzerActionState> {
  const parsedProjectId = projectIdSchema.safeParse(projectId);
  if (!parsedProjectId.success) {
    return { status: "error", message: "잘못된 프로젝트입니다." };
  }

  if (formData.get("externalAnalysisConsent") !== "accepted") {
    return {
      status: "error",
      message: "상품 정보를 AI로 정리하려면 분석 동의가 필요합니다.",
    };
  }

  try {
    const textResult = await organizeSellerText(parsedProjectId.data, true);

    const supabase = await createClient();
    const workspace = await getOrCreateWorkspace();
    if (!workspace) throw new Error("작업공간을 찾지 못했습니다.");
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("product_id")
      .eq("id", parsedProjectId.data)
      .eq("workspace_id", workspace.id)
      .maybeSingle();
    if (projectError) throw projectError;
    if (!project) throw new Error("프로젝트를 찾을 수 없습니다.");

    const { count, error: countError } = await supabase
      .from("product_assets")
      .select("id", { count: "exact", head: true })
      .eq("product_id", project.product_id);
    if (countError) throw countError;

    let imageMessage = "";
    if ((count ?? 0) > 0) {
      const imageForm = new FormData();
      imageForm.set("externalAnalysisConsent", "accepted");
      const imageResult = await analyzeProductImages(
        parsedProjectId.data,
        { status: "idle" },
        imageForm
      );
      imageMessage = imageResult.message ?? "";
    }

    revalidatePath(`/projects/${parsedProjectId.data}/analyze`);
    const textMessage = textResult.savedCount
      ? `직접 적어주신 내용에서 ${textResult.savedCount}개 정보를 정리했습니다.`
      : "직접 적어주신 내용에서 확정할 추가 항목은 없었습니다.";
    return {
      status: "success",
      message: [textMessage, imageMessage].filter(Boolean).join(" "),
    };
  } catch (error) {
    console.error("스마트 상품 분석 실패:", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "상품 정보를 정리하지 못했습니다. 잠시 후 다시 시도해주세요.",
    };
  }
}

export async function saveSmartAnswers(
  projectId: string,
  previousState: AnalyzerActionState,
  formData: FormData
): Promise<AnalyzerActionState> {
  const result = await saveProductFacts(projectId, previousState, formData);
  if (
    result.status === "error" &&
    result.message?.includes("저장할 상품 정보를 한 가지 이상")
  ) {
    return {
      status: "success",
      message: "모르는 항목은 건너뛰었습니다. 지금 정보로 계속 만들 수 있어요.",
    };
  }
  return result;
}
