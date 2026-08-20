"use server";

import { revalidatePath } from "next/cache";
import { zodTextFormat } from "openai/helpers/zod";

import {
  findUnsupportedClaimTerms,
  getUnsupportedClaimVocabulary,
} from "@/lib/claim-safety";
import {
  getPublicResearchCategory,
  researchMarketAndReviews,
} from "@/lib/market-research";
import { getOpenAIClient, getStrategyModel } from "@/lib/openai";
import {
  modelStrategySetSchema,
  storedStrategySchema,
  type StoredStrategy,
} from "@/lib/strategy";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace/get-or-create-workspace";

import {
  generateStrategies,
  type StrategyActionState,
} from "./actions";

type ProductRelation = {
  id: string;
  name: string;
  description: string | null;
  base_price: number | null;
  currency: string | null;
  category_key: string | null;
};

type FactRow = {
  id: string;
  value_json: unknown;
  fact_definitions:
    | { key: string; display_name: string }
    | Array<{ key: string; display_name: string }>
    | null;
};

function getRelation<T>(relation: T | T[] | null) {
  return Array.isArray(relation) ? relation[0] : relation;
}

function isReadinessError(message?: string) {
  return Boolean(
    message &&
      (message.includes("필수 Fact") ||
        message.includes("DB 카탈로그 연결이 필요한 필수 Fact"))
  );
}

function strategyTexts(strategy: StoredStrategy) {
  return [
    strategy.name,
    strategy.positioning,
    strategy.targetCustomer,
    strategy.oneLiner,
    strategy.coreMessage,
    ...strategy.benefits.flatMap((benefit) => [benefit.title, benefit.description]),
  ];
}

async function generateWithAvailableInformation(
  projectId: string,
  formData: FormData
): Promise<StrategyActionState> {
  if (formData.get("externalGenerationConsent") !== "accepted") {
    return { status: "error", message: "AI 판매전략 생성을 위한 동의가 필요합니다." };
  }

  const openAI = getOpenAIClient();
  if (!openAI) return { status: "error", message: "AI 생성 설정이 필요합니다." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "다시 로그인해주세요." };

  try {
    const workspace = await getOrCreateWorkspace();
    if (!workspace) return { status: "error", message: "작업공간을 찾지 못했습니다." };

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select(`
        id,
        product_id,
        products (
          id,
          name,
          description,
          base_price,
          currency,
          category_key
        )
      `)
      .eq("id", projectId)
      .eq("workspace_id", workspace.id)
      .maybeSingle();
    if (projectError) throw projectError;
    if (!project) return { status: "error", message: "프로젝트를 찾을 수 없습니다." };

    const product = getRelation(project.products as ProductRelation | ProductRelation[] | null);
    if (!product?.category_key) {
      return { status: "error", message: "상품 카테고리를 먼저 선택해주세요." };
    }

    const [factsResult, categoryResult, oldStrategiesResult] = await Promise.all([
      supabase
        .from("product_facts")
        .select(`
          id,
          value_json,
          fact_definitions (key, display_name)
        `)
        .eq("product_id", product.id)
        .eq("status", "CONFIRMED"),
      supabase
        .from("categories")
        .select("display_name")
        .eq("key", product.category_key)
        .maybeSingle(),
      supabase.from("strategies").select("id").eq("project_id", project.id),
    ]);
    if (factsResult.error) throw factsResult.error;
    if (categoryResult.error) throw categoryResult.error;
    if (oldStrategiesResult.error) throw oldStrategiesResult.error;
    if (!categoryResult.data) {
      return { status: "error", message: "상품 카테고리를 확인하지 못했습니다." };
    }

    const facts = (factsResult.data ?? []) as FactRow[];
    const groundingFacts = facts.map((fact) => {
      const definition = getRelation(fact.fact_definitions);
      return {
        id: fact.id,
        key: definition?.key ?? fact.id,
        name: definition?.display_name ?? "상품 정보",
        value:
          typeof fact.value_json === "object"
            ? JSON.stringify(fact.value_json)
            : String(fact.value_json),
      };
    });
    const allowedFactIds = new Set(groundingFacts.map((fact) => fact.id));
    const marketResearch = await researchMarketAndReviews({
      openAI,
      categoryKey: product.category_key,
      categoryName: getPublicResearchCategory(
        categoryResult.data.display_name,
        groundingFacts
      ),
    });
    const model = getStrategyModel();
    const prohibitedVocabulary = getUnsupportedClaimVocabulary(groundingFacts);
    let generated: StoredStrategy[] | null = null;
    let feedback: string[] = [];

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await openAI.responses.parse({
        model,
        store: false,
        instructions:
          "당신은 한국 이커머스 판매전략가입니다. 정보가 적은 상품도 안전하게 판매 방향을 설계합니다. CONFIRMED 상품 정보 밖의 소재, 성능, 인증, 효과, 원산지, 구성, 배송 조건을 절대 만들어내지 마세요. 정보가 부족하면 구체적 상품 성능 대신 고객의 선택 상황, 카테고리의 구매 기준, 이미지와 상세페이지에서 확인할 수 있는 정보의 우선순위를 전략으로 제시하세요.",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  "서로 다른 판매 방향 3개를 한국어로 설계하세요.",
                  "확정 상품 정보가 없거나 적어도 생성은 중단하지 마세요.",
                  "supportingFactIds에는 아래 confirmedFacts의 id만 넣고, 근거 Fact가 없으면 빈 배열로 두세요.",
                  "근거 없는 상품 장점 대신 포지셔닝, 고객의 선택 맥락, 정보 전달 방식에 집중하세요.",
                  "판매자 자유 설명은 맥락일 뿐, confirmedFacts에 없는 내용을 상품 성능이나 사실로 단정하지 마세요.",
                  `금지 표현 참고: ${prohibitedVocabulary.join(", ")}`,
                  feedback.length > 0 ? `이전 결과 수정사항: ${feedback.join(", ")}` : "",
                  `입력: ${JSON.stringify({
                    product: {
                      name: product.name,
                      description: product.description,
                      price: product.base_price,
                      currency: product.currency,
                      category: product.category_key,
                    },
                    confirmedFacts: groundingFacts,
                    marketSignals: {
                      popularitySignals: marketResearch.popularitySignals,
                      reviewSatisfactions: marketResearch.reviewSatisfactions,
                      reviewComplaints: marketResearch.reviewComplaints,
                      detailPagePatterns: marketResearch.detailPagePatterns,
                      strategyOpportunities: marketResearch.strategyOpportunities,
                    },
                  })}`,
                ]
                  .filter(Boolean)
                  .join("\n"),
              },
            ],
          },
        ],
        text: { format: zodTextFormat(modelStrategySetSchema, "strategy_set") },
        max_output_tokens: 3200,
      });

      if (!response.output_parsed) throw new Error("판매전략을 구조화하지 못했습니다.");
      const archetypes = response.output_parsed.strategies.map((strategy) => strategy.archetype);
      if (new Set(archetypes).size !== 3) {
        feedback = ["세 전략의 방향이 서로 충분히 달라야 합니다."];
        continue;
      }

      const candidate = response.output_parsed.strategies.map((strategy) =>
        storedStrategySchema.parse({
          ...strategy,
          supportingFactIds: strategy.supportingFactIds.filter((id) => allowedFactIds.has(id)),
          benefits: strategy.benefits.map((benefit) => ({
            ...benefit,
            supportingFactIds: benefit.supportingFactIds.filter((id) => allowedFactIds.has(id)),
          })),
          schemaVersion: 1,
          model,
          responseId: response.id,
          createdAt: new Date().toISOString(),
          marketResearch,
        })
      );

      feedback = [
        ...new Set(
          candidate.flatMap((strategy) =>
            findUnsupportedClaimTerms(strategyTexts(strategy), groundingFacts)
          )
        ),
      ];
      if (feedback.length === 0) {
        generated = candidate;
        break;
      }
    }

    if (!generated) {
      throw new Error("현재 정보 범위 안에서 안전한 판매전략을 만들지 못했습니다.");
    }

    const { data: inserted, error: insertError } = await supabase
      .from("strategies")
      .insert(
        generated.map((strategy) => ({
          project_id: project.id,
          archetype: strategy.archetype,
          name: strategy.name,
          strategy_json: strategy,
          selected: false,
        }))
      )
      .select("id");
    if (insertError || !inserted) throw insertError ?? new Error("전략 저장 실패");

    const oldIds = (oldStrategiesResult.data ?? []).map((strategy) => strategy.id);
    const insertedIds = inserted.map((strategy) => strategy.id);
    const { error: projectUpdateError } = await supabase
      .from("projects")
      .update({ selected_strategy_id: null, page_document: {} })
      .eq("id", project.id)
      .eq("workspace_id", workspace.id);
    if (projectUpdateError) {
      await supabase.from("strategies").delete().in("id", insertedIds);
      throw projectUpdateError;
    }
    if (oldIds.length > 0) {
      const { error: deleteOldError } = await supabase
        .from("strategies")
        .delete()
        .in("id", oldIds)
        .eq("project_id", project.id);
      if (deleteOldError) throw deleteOldError;
    }

    revalidatePath(`/projects/${project.id}/strategies`);
    revalidatePath(`/projects/${project.id}/planner`);
    return {
      status: "success",
      message: `현재 확인된 정보 ${groundingFacts.length}개를 기준으로 판매 방향 3개를 만들었습니다.`,
    };
  } catch (error) {
    console.error("간소화 판매전략 생성 실패:", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "판매 방향을 만들지 못했습니다. 잠시 후 다시 시도해주세요.",
    };
  }
}

export async function generateFlexibleStrategies(
  projectId: string,
  previousState: StrategyActionState,
  formData: FormData
): Promise<StrategyActionState> {
  const standard = await generateStrategies(projectId, previousState, formData);
  if (standard.status !== "error" || !isReadinessError(standard.message)) {
    return standard;
  }
  return generateWithAvailableInformation(projectId, formData);
}
