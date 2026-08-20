import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  loadCategoryLineageKeys,
  loadResolvedCategoryFacts,
} from "@/lib/category-facts";
import { isOpenAIConfigured } from "@/lib/openai";
import { storedStrategySchema, type StoredStrategy } from "@/lib/strategy";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace/get-or-create-workspace";

import { StrategyActions } from "./strategy-actions";

export const maxDuration = 300;

type StrategiesPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

type ProductSummary = {
  id: string;
  name: string;
  category_key: string | null;
};

type FactDefinition = {
  id: string;
  display_name: string;
};

type CategoryFactRow = {
  category_key: string;
  fact_definition_id: string;
  importance: string | null;
  fact_definitions: FactDefinition | FactDefinition[] | null;
};

type ProductFactRow = {
  id: string;
  fact_definition_id: string;
  value_json: unknown;
  status: string;
  locked: boolean;
  fact_definitions: FactDefinition | FactDefinition[] | null;
};

type StrategyRow = {
  id: string;
  archetype: string;
  name: string;
  selected: boolean;
  strategy_json: unknown;
};

function isRequired(importance: string | null) {
  const normalized = importance?.toUpperCase();
  return normalized === "REQUIRED" || normalized === "CORE";
}

function getDefinition(
  relation: FactDefinition | FactDefinition[] | null
) {
  return Array.isArray(relation) ? relation[0] : relation;
}

function getDisplayValue(value: unknown) {
  if (value === true) {
    return "예";
  }

  if (value === false) {
    return "아니오";
  }

  if (value === null || value === undefined) {
    return "값 없음";
  }

  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export default async function StrategiesPage({ params }: StrategiesPageProps) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const workspace = await getOrCreateWorkspace();
  if (!workspace) {
    redirect("/login");
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(`
      id,
      name,
      selected_strategy_id,
      products (
        id,
        name,
        category_key
      )
    `)
    .eq("id", projectId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (projectError) {
    throw new Error("프로젝트 정보를 불러오지 못했습니다.", {
      cause: projectError,
    });
  }

  if (!project) {
    notFound();
  }

  const productRelation = project.products as
    | ProductSummary
    | ProductSummary[]
    | null;
  const product = Array.isArray(productRelation)
    ? productRelation[0]
    : productRelation;

  if (!product) {
    notFound();
  }

  const categoryLineageKeys = product.category_key
    ? await loadCategoryLineageKeys(supabase, product.category_key)
    : [];

  const [categoryCatalog, productFactsResult, strategiesResult] =
    await Promise.all([
      product.category_key
        ? loadResolvedCategoryFacts(supabase, categoryLineageKeys)
        : Promise.resolve({ facts: [], missingBlueprints: [] }),
      supabase
        .from("product_facts")
        .select(`
          id,
          fact_definition_id,
          value_json,
          status,
          locked,
          fact_definitions (
            id,
            display_name
          )
        `)
        .eq("product_id", product.id),
      supabase
        .from("strategies")
        .select("id, archetype, name, selected, strategy_json")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true }),
    ]);

  if (productFactsResult.error) {
    throw new Error("Product Brain을 불러오지 못했습니다.", {
      cause: productFactsResult.error,
    });
  }

  if (strategiesResult.error) {
    throw new Error("판매전략을 불러오지 못했습니다.", {
      cause: strategiesResult.error,
    });
  }

  const categoryFacts = categoryCatalog.facts as CategoryFactRow[];
  const productFacts = (productFactsResult.data ?? []) as ProductFactRow[];
  const strategies = (strategiesResult.data ?? []) as StrategyRow[];
  const confirmedFacts = productFacts.filter(
    (fact) => fact.status === "CONFIRMED"
  );
  const confirmedDefinitionIds = new Set(
    confirmedFacts.map((fact) => fact.fact_definition_id)
  );
  const missingRequiredFacts = categoryFacts.filter(
    (fact) =>
      isRequired(fact.importance) &&
      !confirmedDefinitionIds.has(fact.fact_definition_id)
  );
  const missingRequiredBlueprints = categoryCatalog.missingBlueprints.filter(
    (blueprint) => blueprint.importance === "REQUIRED"
  );
  const reviewFactCount = productFacts.filter(
    (fact) => fact.status === "CANDIDATE" || fact.status === "CONFLICTED"
  ).length;
  const readyForStrategy =
    Boolean(product.category_key) &&
    confirmedFacts.length > 0 &&
    missingRequiredFacts.length === 0 &&
    missingRequiredBlueprints.length === 0 &&
    reviewFactCount === 0;
  const strategyViews = strategies.reduce<
    Array<{
      id: string;
      archetype: string;
      name: string;
      selected: boolean;
      detail: StoredStrategy;
    }>
  >((result, strategy) => {
    const parsed = storedStrategySchema.safeParse(strategy.strategy_json);
    if (parsed.success) {
      result.push({
        id: strategy.id,
        archetype: strategy.archetype,
        name: strategy.name,
        selected: strategy.selected,
        detail: parsed.data,
      });
    }

    return result;
  }, []);
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-950">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-violet-600">DETAIL AI</p>
            <p className="mt-1 text-sm text-neutral-500">Strategy Engine</p>
          </div>
          <Link
            href={`/projects/${projectId}/analyze`}
            className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            Product Brain으로 돌아가기
          </Link>
        </div>
      </header>

      <div className="border-b border-neutral-200 bg-neutral-950 text-white">
        <div className="mx-auto max-w-6xl px-6 py-9">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
              상품 등록 완료
            </span>
            <span className="text-xs text-neutral-500">→</span>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
              Product Brain 구축
            </span>
            <span className="text-xs text-neutral-500">→</span>
            <span className="rounded-full bg-violet-500 px-3 py-1.5 text-xs font-bold text-white">
              판매 전략
            </span>
          </div>
          <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
            {product.name}의 판매전략
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
            상품 정보와 상위 노출 상품의 상세페이지, 공개 리뷰의 만족·불만을
            종합해 서로 다른 구매 전략 3개를 설계합니다.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-10">
        {!readyForStrategy ? (
          <section className="rounded-3xl border border-amber-200 bg-white p-7 shadow-sm sm:p-9">
            <span className="inline-flex rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
              준비 조건 미완료
            </span>
            <h2 className="mt-4 text-2xl font-bold text-neutral-950">
              Product Brain을 먼저 완성해주세요
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-500">
              판매전략에는 확정된 Fact만 사용할 수 있습니다. 아래 항목을 처리하면
              이 단계가 열립니다.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-neutral-50 p-4">
                <p className="text-xs text-neutral-400">확정 Fact</p>
                <p className="mt-2 text-xl font-bold text-neutral-900">
                  {confirmedFacts.length}개
                </p>
              </div>
              <div className="rounded-2xl bg-neutral-50 p-4">
                <p className="text-xs text-neutral-400">필수 미입력</p>
                <p className="mt-2 text-xl font-bold text-neutral-900">
                  {missingRequiredFacts.length + missingRequiredBlueprints.length}개
                </p>
              </div>
              <div className="rounded-2xl bg-neutral-50 p-4">
                <p className="text-xs text-neutral-400">후보 미검수</p>
                <p className="mt-2 text-xl font-bold text-neutral-900">
                  {reviewFactCount}개
                </p>
              </div>
            </div>
            {(missingRequiredFacts.length > 0 ||
              missingRequiredBlueprints.length > 0) && (
              <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
                필수 확인: {[
                  ...missingRequiredFacts
                    .map(
                      (fact) =>
                        getDefinition(fact.fact_definitions)?.display_name
                    )
                    .filter((name): name is string => Boolean(name)),
                  ...missingRequiredBlueprints.map(
                    (blueprint) => `${blueprint.displayName} (DB 연결 필요)`
                  ),
                ].join(", ")}
              </p>
            )}
            <Link
              href={`/projects/${projectId}/analyze`}
              className="mt-6 inline-flex rounded-xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-neutral-800"
            >
              Product Brain 계속 작성
            </Link>
          </section>
        ) : (
          <>
            <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
                    Ready
                  </p>
                  <h2 className="mt-2 text-xl font-bold text-emerald-950">
                    Product Brain 준비 완료
                  </h2>
                </div>
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-emerald-700">
                  확정 Fact {confirmedFacts.length}개
                </span>
              </div>
            </section>

            <section className="mt-7 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">
                  Fact Snapshot
                </p>
                <h2 className="mt-2 text-xl font-bold text-neutral-950">
                  전략에 사용할 확정 정보
                </h2>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {confirmedFacts.map((fact) => {
                  const definition = getDefinition(fact.fact_definitions);

                  return (
                    <div
                      key={fact.id}
                      className="rounded-2xl border border-neutral-200 px-4 py-3.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-neutral-500">
                          {definition?.display_name ?? "상품 Fact"}
                        </p>
                        {fact.locked && (
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                            잠금
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-neutral-900">
                        {getDisplayValue(fact.value_json)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            <StrategyActions
              projectId={projectId}
              openAIConfigured={isOpenAIConfigured()}
              strategies={strategyViews}
              selectedStrategyId={project.selected_strategy_id}
            />
          </>
        )}
      </div>
    </main>
  );
}
