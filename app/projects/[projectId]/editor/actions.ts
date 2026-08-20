"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { findUnsupportedClaimTerms } from "@/lib/claim-safety";
import {
  getBlockType,
  pageDocumentSchema,
  type PageDocument,
} from "@/lib/page-document";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace/get-or-create-workspace";

export type EditorSaveState = {
  status: "idle" | "success" | "error";
  message: string;
  savedAt?: string;
};

const projectIdSchema = z.string().uuid();
const documentJsonSchema = z.string().min(2).max(500_000);

type ProductRelation = { id: string };
type FactDefinitionRelation = {
  key: string;
  display_name: string;
};
type ProductFactRow = {
  id: string;
  value_json: unknown;
  fact_definitions:
    | FactDefinitionRelation
    | FactDefinitionRelation[]
    | null;
};

function getRelation<T>(relation: T | T[] | null) {
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

function getDisplayValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function getPageTexts(document: PageDocument) {
  return document.sections.flatMap((section) => [
    section.eyebrow,
    section.headline,
    section.body,
    section.ctaLabel,
    ...section.items.flatMap((item) => [item.title, item.description]),
    ...section.faqs.flatMap((faq) => [faq.question, faq.answer]),
  ]);
}

export async function savePageDocument(
  projectId: string,
  _previousState: EditorSaveState,
  formData: FormData
): Promise<EditorSaveState> {
  const parsedProjectId = projectIdSchema.safeParse(projectId);
  const parsedJson = documentJsonSchema.safeParse(formData.get("document"));
  if (!parsedProjectId.success || !parsedJson.success) {
    return {
      status: "error",
      message: "저장할 PageDocument 형식이 올바르지 않습니다.",
    };
  }

  let candidateJson: unknown;
  try {
    candidateJson = JSON.parse(parsedJson.data);
  } catch {
    return {
      status: "error",
      message: "PageDocument JSON을 읽을 수 없습니다.",
    };
  }

  const parsedCandidate = pageDocumentSchema.safeParse(candidateJson);
  if (!parsedCandidate.success) {
    return {
      status: "error",
      message: "편집 내용이 PageDocument 스키마를 벗어났습니다.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: "로그인이 만료되었습니다." };
  }

  try {
    const workspace = await getOrCreateWorkspace();
    if (!workspace) {
      return { status: "error", message: "작업공간을 확인하지 못했습니다." };
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select(`
        id,
        page_document,
        selected_strategy_id,
        products (id)
      `)
      .eq("id", parsedProjectId.data)
      .eq("workspace_id", workspace.id)
      .maybeSingle();

    if (projectError) {
      throw projectError;
    }
    if (!project?.selected_strategy_id) {
      return { status: "error", message: "편집할 프로젝트를 찾을 수 없습니다." };
    }

    const productRelation = project.products as
      | ProductRelation
      | ProductRelation[]
      | null;
    const product = getRelation(productRelation);
    const parsedCurrent = pageDocumentSchema.safeParse(project.page_document);
    if (!product || !parsedCurrent.success) {
      return {
        status: "error",
        message: "현재 PageDocument를 확인할 수 없습니다. Planner에서 다시 생성해주세요.",
      };
    }

    const candidate = parsedCandidate.data;
    const current = parsedCurrent.data;
    if (
      candidate.strategyId !== project.selected_strategy_id ||
      candidate.strategyId !== current.strategyId ||
      candidate.responseId !== current.responseId ||
      candidate.generatedAt !== current.generatedAt ||
      JSON.stringify(candidate.marketResearch) !==
        JSON.stringify(current.marketResearch)
    ) {
      return {
        status: "error",
        message: "다른 화면에서 PageDocument가 변경되었습니다. 새로고침 후 다시 편집해주세요.",
      };
    }

    const currentSectionById = new Map(
      current.sections.map((section) => [section.id, section])
    );
    if (
      candidate.sections.length !== current.sections.length ||
      new Set(candidate.sections.map((section) => section.id)).size !==
        candidate.sections.length ||
      candidate.sections.some((section) => {
        const currentSection = currentSectionById.get(section.id);
        return (
          !currentSection ||
          currentSection.type !== section.type ||
          getBlockType(section.variant) !== section.type
        );
      })
    ) {
      return {
        status: "error",
        message: "현재 Editor에서는 기존 블록의 편집과 순서 변경만 저장할 수 있습니다.",
      };
    }

    if (
      candidate.sections[0]?.type !== "hero" ||
      candidate.sections.at(-1)?.type !== "cta"
    ) {
      return {
        status: "error",
        message: "Hero는 첫 블록, CTA는 마지막 블록에 유지해주세요.",
      };
    }

    const [factsResult, assetsResult] = await Promise.all([
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
        .from("product_assets")
        .select("id")
        .eq("product_id", product.id),
    ]);

    if (factsResult.error) {
      throw factsResult.error;
    }
    if (assetsResult.error) {
      throw assetsResult.error;
    }

    const facts = ((factsResult.data ?? []) as ProductFactRow[]).map((fact) => {
      const definition = getRelation(fact.fact_definitions);
      return {
        id: fact.id,
        key: definition?.key ?? fact.id,
        name: definition?.display_name ?? "상품 Fact",
        value: getDisplayValue(fact.value_json),
      };
    });
    const factById = new Map(facts.map((fact) => [fact.id, fact]));
    const assetIds = new Set((assetsResult.data ?? []).map((asset) => asset.id));

    if (
      candidate.sections.some(
        (section) => section.assetId && !assetIds.has(section.assetId)
      )
    ) {
      return {
        status: "error",
        message: "이 상품에 속하지 않은 이미지는 사용할 수 없습니다.",
      };
    }

    const protectedSections = candidate.sections.map((section) => {
      const currentSection = currentSectionById.get(section.id)!;
      if (
        section.items.length !== currentSection.items.length ||
        section.faqs.length !== currentSection.faqs.length
      ) {
        throw new Error("보호된 PageDocument 배열 구조가 변경되었습니다.");
      }

      return {
        ...section,
        supportingFactIds: currentSection.supportingFactIds,
        items: section.items.map((item, index) => ({
          ...item,
          supportingFactIds:
            currentSection.items[index]?.supportingFactIds ?? [],
        })),
        faqs: section.faqs.map((faq, index) => ({
          ...faq,
          supportingFactIds:
            currentSection.faqs[index]?.supportingFactIds ?? [],
        })),
        specs: currentSection.specs.flatMap((spec) => {
          const fact = factById.get(spec.factId);
          return fact
            ? [{ factId: fact.id, label: fact.name, value: fact.value }]
            : [];
        }),
      };
    });

    const protectedDocument = pageDocumentSchema.parse({
      ...candidate,
      schemaVersion: current.schemaVersion,
      strategyId: current.strategyId,
      generatedAt: current.generatedAt,
      model: current.model,
      responseId: current.responseId,
      safetyCorrections: current.safetyCorrections,
      sections: protectedSections,
    });
    const unsupportedClaims = findUnsupportedClaimTerms(
      getPageTexts(protectedDocument),
      facts
    );
    if (unsupportedClaims.length > 0) {
      return {
        status: "error",
        message: `확정 Fact 근거가 필요한 표현이 있습니다: ${[
          ...new Set(unsupportedClaims),
        ].join(", ")}`,
      };
    }

    const { error: updateError } = await supabase
      .from("projects")
      .update({ page_document: protectedDocument })
      .eq("id", project.id)
      .eq("workspace_id", workspace.id)
      .eq("selected_strategy_id", current.strategyId);

    if (updateError) {
      throw updateError;
    }

    revalidatePath(`/projects/${project.id}/editor`);
    revalidatePath(`/projects/${project.id}/planner`);
    return {
      status: "success",
      message: "PageDocument를 안전하게 저장했습니다.",
      savedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("PageDocument 편집 저장 실패:", error);
    return {
      status: "error",
      message:
        error instanceof Error &&
        error.message === "보호된 PageDocument 배열 구조가 변경되었습니다."
          ? error.message
          : "편집 내용을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.",
    };
  }
}
