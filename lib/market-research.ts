import "server-only";

import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import { getMarketResearchModel, getOpenAIClient } from "@/lib/openai";
import {
  marketResearchSchema,
  type PageDocument,
} from "@/lib/page-document";

type MarketResearch = NonNullable<PageDocument["marketResearch"]>;

const marketResearchInsightsSchema = z
  .object({
    popularitySignals: z.array(z.string().trim().min(1).max(300)).max(8),
    reviewSatisfactions: z.array(z.string().trim().min(1).max(300)).max(8),
    reviewComplaints: z.array(z.string().trim().min(1).max(300)).max(8),
    detailPagePatterns: z.array(z.string().trim().min(1).max(300)).max(8),
    strategyOpportunities: z.array(z.string().trim().min(1).max(300)).max(8),
  })
  .strict();

function getSourceTitle(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "웹 참고자료";
  }
}

export function getPublicResearchCategory(
  categoryName: string,
  facts: Array<{ key: string; value: string }>
) {
  const garmentType = facts.find((fact) => fact.key === "garment_type")?.value;
  if (!garmentType) return categoryName;

  const normalized = garmentType.toLocaleLowerCase("ko-KR");
  const publicTaxonomy: Array<[string[], string]> = [
    [["재킷", "자켓", "블루종", "점퍼"], "재킷·점퍼"],
    [["코트", "트렌치"], "코트"],
    [["셔츠", "남방"], "셔츠"],
    [["블라우스"], "블라우스"],
    [["니트", "스웨터", "카디건", "가디건"], "니트·카디건"],
    [["후디", "후드"], "후디"],
    [["스웨트", "맨투맨"], "스웨트셔츠"],
    [["티셔츠", "티", "반팔", "긴팔"], "티셔츠"],
    [["베스트", "조끼"], "베스트"],
  ];
  const matched = publicTaxonomy.find(([keywords]) =>
    keywords.some((keyword) => normalized.includes(keyword))
  );
  return matched ? `${categoryName} · ${matched[1]}` : categoryName;
}

export async function researchMarketAndReviews({
  openAI,
  categoryKey,
  categoryName,
}: {
  openAI: NonNullable<ReturnType<typeof getOpenAIClient>>;
  categoryKey: string;
  categoryName: string;
}): Promise<MarketResearch> {
  const model = getMarketResearchModel();
  const query = `${categoryName} (${categoryKey}) 상위 노출 상품 상세페이지와 공개 리뷰 만족·불만 조사`;
  const response = await openAI.responses.create({
    model,
    store: false,
    tools: [
      {
        type: "web_search",
        search_context_size: "high",
        user_location: {
          type: "approximate",
          country: "KR",
          timezone: "Asia/Seoul",
        },
      },
    ],
    include: ["web_search_call.action.sources"],
    reasoning: { effort: "low" },
    max_output_tokens: 5600,
    input: [
      "당신은 한국 이커머스 시장·VOC 리서처입니다. 아래 비식별 제품군의 공개 자료를 조사하세요.",
      "검색 결과 상단, 카테고리 랭킹·베스트 영역, 리뷰·평점 규모 등 공개적으로 확인 가능한 인기 신호가 강한 상품을 최대 5개 찾으세요. 실제 판매량이 공개되지 않았다면 판매 1위처럼 단정하지 마세요.",
      "각 후보의 상품 상세페이지를 열어 상단 구매정보, 섹션 순서, 이미지 전개, 사이즈·규격, 신뢰 요소, FAQ와 CTA를 분석하세요. 문구와 고유 디자인을 복제하지 말고 구조적 패턴만 기록하세요.",
      "접근 가능한 공개 리뷰에서 반복되는 만족 사항과 불만 사항을 각각 조사하세요. 리뷰 원문을 길게 인용하거나 특정 경쟁사의 주장을 우리 상품 사실처럼 옮기지 마세요.",
      "보고서는 반드시 ① 상위 노출·인기 신호 ② 상세페이지 공통 패턴 ③ 리뷰 만족 사항 ④ 리뷰 불만 사항 ⑤ 미충족 요구 ⑥ 판매전략 기회 순서로 작성하세요.",
      "각 판단에는 웹 출처를 인용하고, 공개 근거가 없는 항목은 없다고 명시하세요. 전체 보고서는 한국어 5,000자 이내로 완결하세요.",
      `공개 제품군: ${categoryName} (${categoryKey})`,
    ].join("\n"),
  });

  if (response.status === "incomplete") {
    throw new Error(
      "MARKET_RESEARCH: 시장·리뷰 리서치가 길이 제한 안에서 끝나지 않았습니다. 잠시 후 다시 시도해주세요."
    );
  }

  const citationSourceMap = new Map<string, string>();
  const discoveredSourceMap = new Map<string, string>();
  for (const item of response.output) {
    if (item.type === "message") {
      for (const content of item.content) {
        if (content.type !== "output_text") continue;
        for (const annotation of content.annotations) {
          if (annotation.type === "url_citation") {
            citationSourceMap.set(
              annotation.url,
              annotation.title || getSourceTitle(annotation.url)
            );
          }
        }
      }
      continue;
    }
    if (item.type === "web_search_call" && item.action.type === "search") {
      for (const source of item.action.sources ?? []) {
        if (!discoveredSourceMap.has(source.url)) {
          discoveredSourceMap.set(source.url, getSourceTitle(source.url));
        }
      }
    }
  }

  const sources = [
    ...citationSourceMap,
    ...[...discoveredSourceMap].filter(
      ([url]) => !citationSourceMap.has(url)
    ),
  ]
    .filter(([url]) => /^https?:\/\//i.test(url))
    .slice(0, 10)
    .map(([url, title]) => ({ title: title.slice(0, 240), url }));
  const summary = response.output_text.trim().slice(0, 12000);
  if (!summary || sources.length === 0) {
    throw new Error(
      "MARKET_RESEARCH: 출처가 있는 상위 상품·리뷰 자료를 찾지 못했습니다. 상품 카테고리를 더 구체적으로 선택해주세요."
    );
  }

  const insightResponse = await openAI.responses.parse({
    model,
    store: false,
    instructions:
      "당신은 리서치 보고서의 근거 있는 결론만 분류하는 분석가입니다. 보고서에 없는 내용을 만들지 말고, 자료가 없으면 해당 배열을 비워두세요. 경쟁 상품의 주장을 대상 상품의 사실로 바꾸지 마세요.",
    input: `다음 보고서에서 공개 인기 신호, 리뷰 만족, 리뷰 불만, 상세페이지 패턴, 판매전략 기회를 중복 없이 추출하세요. 각 항목은 출처 설명이 아니라 판매 의사결정에 쓸 수 있는 한 문장이어야 합니다.\n\n${summary}`,
    text: {
      format: zodTextFormat(
        marketResearchInsightsSchema,
        "market_review_insights"
      ),
    },
    reasoning: { effort: "low" },
    max_output_tokens: 2600,
  });
  if (!insightResponse.output_parsed) {
    throw new Error(
      "MARKET_RESEARCH: 시장·리뷰 리서치 결과를 구조화하지 못했습니다. 잠시 후 다시 시도해주세요."
    );
  }

  return marketResearchSchema.parse({
    generatedAt: new Date().toISOString(),
    model,
    responseId: response.id,
    query,
    summary,
    caveat:
      "공개 판매량이 없는 경우 랭킹·베스트 라벨, 노출 위치, 리뷰 규모 같은 관찰 가능한 신호를 사용한 결과이며 절대 판매 순위를 뜻하지 않습니다.",
    sources,
    ...insightResponse.output_parsed,
  });
}
