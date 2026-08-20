import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { isOpenAIConfigured } from "@/lib/openai";
import { storedStrategySchema, type StoredStrategy } from "@/lib/strategy";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace/get-or-create-workspace";

import { SimpleStrategyActions } from "./simple-strategy-actions";

export const maxDuration = 300;

type StrategiesPageProps = {
  params: Promise<{ projectId: string }>;
};

type ProductSummary = {
  id: string;
  name: string;
  category_key: string | null;
};

type StrategyRow = {
  id: string;
  name: string;
  selected: boolean;
  strategy_json: unknown;
};

export default async function StrategiesPage({ params }: StrategiesPageProps) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspace = await getOrCreateWorkspace();
  if (!workspace) redirect("/login");

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(`
      id,
      selected_strategy_id,
      products (id, name, category_key)
    `)
    .eq("id", projectId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (projectError) throw projectError;
  if (!project) notFound();

  const productRelation = project.products as ProductSummary | ProductSummary[] | null;
  const product = Array.isArray(productRelation) ? productRelation[0] : productRelation;
  if (!product) notFound();

  if (!product.category_key) {
    redirect(`/projects/${projectId}/analyze`);
  }

  const [factsResult, strategiesResult] = await Promise.all([
    supabase
      .from("product_facts")
      .select("id")
      .eq("product_id", product.id)
      .eq("status", "CONFIRMED"),
    supabase
      .from("strategies")
      .select("id, name, selected, strategy_json")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
  ]);
  if (factsResult.error) throw factsResult.error;
  if (strategiesResult.error) throw strategiesResult.error;

  const confirmedFactCount = factsResult.data?.length ?? 0;
  const strategies = (strategiesResult.data ?? []) as StrategyRow[];
  const strategyViews = strategies.reduce<
    Array<{
      id: string;
      name: string;
      selected: boolean;
      detail: StoredStrategy;
    }>
  >((result, strategy) => {
    const parsed = storedStrategySchema.safeParse(strategy.strategy_json);
    if (parsed.success) {
      result.push({
        id: strategy.id,
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
            <p className="mt-1 text-sm text-neutral-500">판매 방향 선택</p>
          </div>
          <Link
            href={`/projects/${projectId}/analyze`}
            className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            상품 정보로 돌아가기
          </Link>
        </div>
      </header>

      <div className="border-b border-neutral-200 bg-neutral-950 text-white">
        <div className="mx-auto max-w-6xl px-6 py-9">
          <span className="inline-flex rounded-full bg-violet-500 px-3 py-1.5 text-xs font-bold">
            확인된 정보 {confirmedFactCount}개
          </span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
            {product.name}, 어떤 방향으로 팔까요?
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
            정보가 적어도 괜찮습니다. 지금 확인된 범위 안에서만 안전하게 판매 방향을 제안합니다.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <SimpleStrategyActions
          projectId={projectId}
          configured={isOpenAIConfigured()}
          strategies={strategyViews}
          selectedStrategyId={project.selected_strategy_id}
        />
      </div>
    </main>
  );
}
