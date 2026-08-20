import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { pageDocumentSchema } from "@/lib/page-document";
import {
  getPagePlannerProviderLabel,
  isPagePlannerConfigured,
} from "@/lib/page-planner-provider";
import { storedStrategySchema } from "@/lib/strategy";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace/get-or-create-workspace";

import { PlannerForm } from "./planner-form";

export const maxDuration = 300;

type PlannerPageProps = {
  params: Promise<{ projectId: string }>;
};

type ProductRelation = {
  id: string;
  name: string;
};

export default async function PlannerPage({ params }: PlannerPageProps) {
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
      page_document,
      products (
        id,
        name
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
    | ProductRelation
    | ProductRelation[]
    | null;
  const product = Array.isArray(productRelation)
    ? productRelation[0]
    : productRelation;
  if (!product) {
    notFound();
  }

  const strategyResult = project.selected_strategy_id
    ? await supabase
        .from("strategies")
        .select("id, archetype, name, strategy_json")
        .eq("id", project.selected_strategy_id)
        .eq("project_id", project.id)
        .maybeSingle()
    : { data: null, error: null };

  if (strategyResult.error) {
    throw new Error("선택한 판매전략을 불러오지 못했습니다.", {
      cause: strategyResult.error,
    });
  }

  const parsedStrategy = strategyResult.data
    ? storedStrategySchema.safeParse(strategyResult.data.strategy_json)
    : null;
  const parsedDocument = pageDocumentSchema.safeParse(project.page_document);
  const strategy = parsedStrategy?.success ? parsedStrategy.data : null;

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-950">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-violet-600">DETAIL AI</p>
            <p className="mt-1 text-sm text-neutral-500">Page Planner</p>
          </div>
          <Link
            href={`/projects/${projectId}/strategies`}
            className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            판매전략으로 돌아가기
          </Link>
        </div>
      </header>

      <div className="border-b border-neutral-200 bg-neutral-950 text-white">
        <div className="mx-auto max-w-6xl px-6 py-9">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
              Product Brain
            </span>
            <span className="text-xs text-neutral-500">→</span>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
              판매 전략
            </span>
            <span className="text-xs text-neutral-500">→</span>
            <span className="rounded-full bg-violet-500 px-3 py-1.5 text-xs font-bold text-white">
              Page Planner
            </span>
          </div>
          <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
            {product.name}의 페이지 구조 설계
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
            판매전략을 전환 역할과 미리 정의된 Block 조합으로 변환합니다.
          </p>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-7 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          {strategy && strategyResult.data ? (
            <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">
                Selected Strategy · {strategyResult.data.archetype}
              </p>
              <h2 className="mt-3 text-2xl font-bold text-neutral-950">
                {strategyResult.data.name}
              </h2>
              <p className="mt-2 text-base font-semibold text-violet-700">
                {strategy.oneLiner}
              </p>
              <p className="mt-4 text-sm leading-6 text-neutral-500">
                {strategy.coreMessage}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {strategy.benefits.map((benefit, benefitIndex) => (
                  <div
                    key={`selected-strategy-benefit-${benefitIndex}`}
                    className="rounded-2xl bg-neutral-50 p-4"
                  >
                    <p className="text-sm font-bold text-neutral-800">
                      {benefit.title}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-neutral-500">
                      {benefit.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="rounded-3xl border border-amber-200 bg-white p-7 shadow-sm">
              <h2 className="text-xl font-bold text-neutral-950">
                선택된 판매전략이 없습니다
              </h2>
              <p className="mt-2 text-sm text-neutral-500">
                판매전략을 생성하고 하나를 선택한 뒤 다시 진행해주세요.
              </p>
              <Link
                href={`/projects/${projectId}/strategies`}
                className="mt-5 inline-flex rounded-xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white"
              >
                판매전략 선택하기
              </Link>
            </section>
          )}
        </div>

        <div>
          {strategy ? (
            <PlannerForm
              projectId={projectId}
              providerConfigured={isPagePlannerConfigured()}
              providerLabel={getPagePlannerProviderLabel()}
              hasPageDocument={parsedDocument.success}
              sectionCount={
                parsedDocument.success ? parsedDocument.data.sections.length : 0
              }
              marketResearch={
                parsedDocument.success
                  ? parsedDocument.data.marketResearch
                  : strategy.marketResearch
              }
            />
          ) : (
            <section className="rounded-3xl bg-neutral-200 p-6 text-sm text-neutral-500">
              판매전략 선택 후 PageDocument를 생성할 수 있습니다.
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
