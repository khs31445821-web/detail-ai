"use server";

import { randomUUID } from "node:crypto";

import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { revalidatePath } from "next/cache";
import { zodTextFormat } from "openai/helpers/zod";

import { getAnthropicClient } from "@/lib/anthropic";
import { findUnsupportedClaimTerms } from "@/lib/claim-safety";
import {
  getBlockType,
  modelPagePlanSchema,
  pageDocumentSchema,
  type PageDocument,
} from "@/lib/page-document";
import {
  getConfiguredPagePlannerModel,
  getPagePlannerProvider,
} from "@/lib/page-planner-provider";
import { getOpenAIClient } from "@/lib/openai";
import { storedStrategySchema } from "@/lib/strategy";
import { loadEffectiveStorePolicy, type StorePolicy } from "@/lib/store-policy";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace/get-or-create-workspace";

import {
  generatePageDocument,
  type PlannerActionState,
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

const SHIPPING_WORDS = /배송|택배|출고|교환|반품|환불|도서|산간|제주|고객센터|문의/;

function getRelation<T>(relation: T | T[] | null) {
  return Array.isArray(relation) ? relation[0] : relation;
}

function isSparseFactError(message?: string) {
  return Boolean(
    message &&
      (message.includes("확정된 Product Fact가 없습니다") ||
        message.includes("의류 상세페이지에는"))
  );
}

function money(value: number) {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function buildStoreFaqs(policy: StorePolicy) {
  const faqs: Array<{
    question: string;
    answer: string;
    supportingFactIds: string[];
  }> = [];

  const shipping: string[] = [];
  if (policy.shippingMethod) shipping.push(`배송 방법은 ${policy.shippingMethod}입니다.`);
  if (policy.averageDispatchTime) shipping.push(`평균 출고는 ${policy.averageDispatchTime}입니다.`);
  if (policy.shippingFee !== null) shipping.push(`기본 배송비는 ${money(policy.shippingFee)}입니다.`);
  if (policy.freeShippingThreshold !== null) {
    shipping.push(`${money(policy.freeShippingThreshold)} 이상 구매 시 무료배송 조건이 적용됩니다.`);
  }
  if (policy.remoteAreaFee !== null) {
    shipping.push(`제주·도서산간은 ${money(policy.remoteAreaFee)}의 추가 배송비가 있을 수 있습니다.`);
  }
  if (shipping.length > 0) {
    faqs.push({
      question: "배송은 어떻게 진행되나요?",
      answer: shipping.join(" "),
      supportingFactIds: [],
    });
  }

  const returns: string[] = [];
  if (policy.returnExchangeWindow) returns.push(`교환·반품 가능기간은 ${policy.returnExchangeWindow}입니다.`);
  if (policy.returnShippingFee !== null) returns.push(`반품 배송비는 ${money(policy.returnShippingFee)}입니다.`);
  if (policy.exchangeShippingFee !== null) returns.push(`교환 배송비는 ${money(policy.exchangeShippingFee)}입니다.`);
  if (returns.length > 0) {
    faqs.push({
      question: "교환·반품은 어떻게 하나요?",
      answer: returns.join(" "),
      supportingFactIds: [],
    });
  }

  if (policy.customerService) {
    faqs.push({
      question: "상품 문의는 어디로 하면 되나요?",
      answer: policy.customerService,
      supportingFactIds: [],
    });
  }

  return faqs;
}

async function applyStorePolicyGuard(projectId: string) {
  const supabase = await createClient();
  const workspace = await getOrCreateWorkspace();
  if (!workspace) return;

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, product_id, page_document")
    .eq("id", projectId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (error || !project) return;

  const parsed = pageDocumentSchema.safeParse(project.page_document);
  if (!parsed.success) return;

  let policy: StorePolicy | null = null;
  try {
    policy = await loadEffectiveStorePolicy(
      supabase,
      workspace.id,
      project.product_id
    );
  } catch (policyError) {
    console.error("스토어 기본정보 조회 실패, 빈 정책으로 계속합니다:", policyError);
  }

  const policyFaqs = policy ? buildStoreFaqs(policy) : [];
  let injected = false;
  let sections = parsed.data.sections.flatMap((section) => {
    if (section.type !== "faq") return [section];

    const productFaqs = section.faqs.filter(
      (faq) => !SHIPPING_WORDS.test(`${faq.question} ${faq.answer}`)
    );
    const nextFaqs = !injected && policyFaqs.length > 0
      ? [...productFaqs, ...policyFaqs].slice(0, 8)
      : productFaqs;
    if (!injected && policyFaqs.length > 0) injected = true;
    if (nextFaqs.length === 0) return [];
    return [{ ...section, faqs: nextFaqs }];
  });

  if (policyFaqs.length > 0 && !injected) {
    const ctaIndex = sections.findIndex((section) => section.type === "cta");
    const faqSection = {
      id: randomUUID(),
      type: "faq" as const,
      variant: "faq_01" as const,
      conversionRole: "OBJECTION" as const,
      eyebrow: "ORDER GUIDE",
      headline: "주문 전 확인해주세요",
      body: "배송과 교환·반품 정보를 확인한 뒤 편하게 주문하세요.",
      items: [],
      specs: [],
      faqs: policyFaqs,
      ctaLabel: "",
      assetId: null,
      supportingFactIds: [],
      tone: "LIGHT" as const,
      align: "LEFT" as const,
    };
    if (ctaIndex >= 0) {
      sections = [
        ...sections.slice(0, ctaIndex),
        faqSection,
        ...sections.slice(ctaIndex),
      ];
    } else {
      sections = [...sections, faqSection];
    }
  }

  const nextDocument = pageDocumentSchema.parse({
    ...parsed.data,
    sections,
  });
  const { error: updateError } = await supabase
    .from("projects")
    .update({ page_document: nextDocument })
    .eq("id", project.id)
    .eq("workspace_id", workspace.id);
  if (updateError) throw updateError;
}

async function generateSparsePage(
  projectId: string,
  formData: FormData
): Promise<PlannerActionState> {
  if (formData.get("externalPlanningConsent") !== "accepted") {
    return { status: "error", message: "AI 페이지 생성을 위한 동의가 필요합니다." };
  }

  const provider = getPagePlannerProvider();
  const anthropic = provider === "anthropic" ? getAnthropicClient() : null;
  const openAI = provider === "openai" ? getOpenAIClient() : null;
  if (!anthropic && !openAI) {
    return { status: "error", message: "AI 페이지 생성 설정이 필요합니다." };
  }

  const supabase = await createClient();
  const workspace = await getOrCreateWorkspace();
  if (!workspace) return { status: "error", message: "작업공간을 찾지 못했습니다." };

  try {
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select(`
        id,
        selected_strategy_id,
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
    if (!project?.selected_strategy_id) {
      return { status: "error", message: "먼저 판매 방향을 선택해주세요." };
    }

    const product = getRelation(project.products as ProductRelation | ProductRelation[] | null);
    if (!product) return { status: "error", message: "상품을 찾을 수 없습니다." };

    const [strategyResult, factsResult, assetsResult] = await Promise.all([
      supabase
        .from("strategies")
        .select("id, strategy_json")
        .eq("id", project.selected_strategy_id)
        .eq("project_id", project.id)
        .maybeSingle(),
      supabase
        .from("product_facts")
        .select(`id, value_json, fact_definitions (key, display_name)`)
        .eq("product_id", product.id)
        .eq("status", "CONFIRMED"),
      supabase
        .from("product_assets")
        .select("id")
        .eq("product_id", product.id)
        .order("created_at", { ascending: true }),
    ]);
    if (strategyResult.error) throw strategyResult.error;
    if (factsResult.error) throw factsResult.error;
    if (assetsResult.error) throw assetsResult.error;
    if (!strategyResult.data) return { status: "error", message: "판매 방향을 찾지 못했습니다." };

    const parsedStrategy = storedStrategySchema.safeParse(strategyResult.data.strategy_json);
    if (!parsedStrategy.success) return { status: "error", message: "판매 방향을 다시 생성해주세요." };

    const facts = ((factsResult.data ?? []) as FactRow[]).map((fact) => {
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
    const allowedFactIds = new Set(facts.map((fact) => fact.id));
    const assetIds = new Set((assetsResult.data ?? []).map((asset) => asset.id));
    const model = getConfiguredPagePlannerModel();
    let pageDocument: PageDocument | null = null;
    let safetyFeedback: string[] = [];

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const prompt = [
        "현재 정보가 적어도 멈추지 말고 6개 안팎의 간결한 상세페이지 구조를 만드세요.",
        "첫 섹션은 hero_01/02/03, 마지막은 cta_01/02여야 합니다.",
        "확정 정보에 없는 소재, 성능, 사용효과, 인증, 원산지, 구성품, 배송·교환 조건을 절대 만들어내지 마세요.",
        "상품 정보가 부족하면 같은 말을 반복하지 말고 상품 정체성, 선택 맥락, 확인 가능한 정보, 구매 전 확인 순으로 짧게 구성하세요.",
        facts.length > 0
          ? "spec 블록을 사용할 수 있으며 specs와 supportingFactIds는 제공된 confirmedFacts id만 사용하세요."
          : "확정 상품 정보가 없으므로 spec 블록을 피하고 모든 supportingFactIds와 specs를 빈 배열로 두세요.",
        assetIds.size > 0
          ? "이미지 중심 섹션에는 availableAssetIds 중 하나를 사용하세요."
          : "assetId는 모두 null로 두세요.",
        "배송·교환·반품 FAQ는 여기서 만들지 마세요. 저장된 스토어 정보가 있으면 시스템이 별도로 안전하게 추가합니다.",
        safetyFeedback.length > 0
          ? `이전 결과 수정사항: ${safetyFeedback.join(", ")}`
          : "",
        `입력: ${JSON.stringify({
          product: {
            name: product.name,
            description: product.description,
            price: product.base_price,
            currency: product.currency,
            category: product.category_key,
          },
          strategy: parsedStrategy.data,
          confirmedFacts: facts,
          availableAssetIds: [...assetIds],
          allowedVariants: [
            "hero_01",
            "hero_02",
            "hero_03",
            "benefit_01",
            "benefit_02",
            "benefit_03",
            "image_text_01",
            "image_text_02",
            "image_text_03",
            "feature_01",
            "feature_02",
            ...(facts.length > 0 ? ["spec_01", "spec_02"] : []),
            "faq_01",
            "cta_01",
            "cta_02",
          ],
        })}`,
      ]
        .filter(Boolean)
        .join("\n");

      let plan = null;
      let responseId = "";
      if (provider === "anthropic") {
        if (!anthropic) throw new Error("AI 페이지 생성 설정이 필요합니다.");
        const response = await anthropic.messages.parse({
          model,
          max_tokens: 9000,
          system:
            "당신은 한국 이커머스 상세페이지 디렉터입니다. 허용된 블록 JSON만 만들고, 확인되지 않은 상품 사실을 만들어내지 않습니다.",
          messages: [{ role: "user", content: prompt }],
          output_config: {
            effort: "low",
            format: zodOutputFormat(modelPagePlanSchema),
          },
        });
        plan = response.parsed_output;
        responseId = response.id;
      } else {
        if (!openAI) throw new Error("AI 페이지 생성 설정이 필요합니다.");
        const response = await openAI.responses.parse({
          model,
          store: false,
          instructions:
            "당신은 한국 이커머스 상세페이지 디렉터입니다. 허용된 블록 JSON만 만들고, 확인되지 않은 상품 사실을 만들어내지 않습니다.",
          input: prompt,
          text: { format: zodTextFormat(modelPagePlanSchema, "page_plan") },
          max_output_tokens: 4800,
        });
        plan = response.output_parsed;
        responseId = response.id;
      }
      if (!plan) throw new Error("페이지 초안을 구조화하지 못했습니다.");

      const document = pageDocumentSchema.parse({
        schemaVersion: 1,
        strategyId: strategyResult.data.id,
        generatedAt: new Date().toISOString(),
        model,
        responseId,
        safetyCorrections: [],
        marketResearch: parsedStrategy.data.marketResearch,
        theme: { ...plan.theme, brandColor: null },
        sections: plan.sections.map((section) => ({
          ...section,
          id: randomUUID(),
          type: getBlockType(section.variant),
          assetId:
            section.assetId && assetIds.has(section.assetId)
              ? section.assetId
              : null,
          supportingFactIds: section.supportingFactIds.filter((id) =>
            allowedFactIds.has(id)
          ),
          items: section.items.map((item) => ({
            ...item,
            supportingFactIds: item.supportingFactIds.filter((id) =>
              allowedFactIds.has(id)
            ),
          })),
          specs: section.specs.filter((spec) => allowedFactIds.has(spec.factId)),
          faqs: section.faqs
            .filter((faq) => !SHIPPING_WORDS.test(`${faq.question} ${faq.answer}`))
            .map((faq) => ({
              ...faq,
              supportingFactIds: faq.supportingFactIds.filter((id) =>
                allowedFactIds.has(id)
              ),
            })),
        })),
      });

      const pageTexts = document.sections.flatMap((section) => [
        section.headline,
        section.body,
        ...section.items.flatMap((item) => [item.title, item.description]),
        ...section.faqs.flatMap((faq) => [faq.question, faq.answer]),
      ]);
      safetyFeedback = findUnsupportedClaimTerms(pageTexts, facts);
      if (safetyFeedback.length === 0) {
        pageDocument = document;
        break;
      }
    }

    if (!pageDocument) throw new Error("현재 정보 범위 안에서 안전한 페이지 초안을 만들지 못했습니다.");

    const { error: updateError } = await supabase
      .from("projects")
      .update({ page_document: pageDocument })
      .eq("id", project.id)
      .eq("workspace_id", workspace.id);
    if (updateError) throw updateError;

    revalidatePath(`/projects/${project.id}/planner`);
    revalidatePath(`/projects/${project.id}/editor`);
    return {
      status: "success",
      message: `${pageDocument.sections.length}개 영역으로 간결한 상세페이지 초안을 만들었습니다.`,
    };
  } catch (error) {
    console.error("간소화 페이지 생성 실패:", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "상세페이지 초안을 만들지 못했습니다. 잠시 후 다시 시도해주세요.",
    };
  }
}

export async function generateFlexiblePageDocument(
  projectId: string,
  previousState: PlannerActionState,
  formData: FormData
): Promise<PlannerActionState> {
  let result = await generatePageDocument(projectId, previousState, formData);
  if (result.status === "error" && isSparseFactError(result.message)) {
    result = await generateSparsePage(projectId, formData);
  }

  if (result.status === "success") {
    try {
      await applyStorePolicyGuard(projectId);
      revalidatePath(`/projects/${projectId}/planner`);
      revalidatePath(`/projects/${projectId}/editor`);
    } catch (error) {
      console.error("스토어 정책 반영 실패:", error);
    }
  }

  return result;
}
