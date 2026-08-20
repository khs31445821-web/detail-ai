import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  loadResolvedCategoryFacts,
  resolveCategoryLineageKeys,
} from "@/lib/category-facts";
import { isOpenAIConfigured } from "@/lib/openai";
import { storedAssetAnalysisSchema } from "@/lib/product-image-analysis";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace/get-or-create-workspace";

import {
  AnalyzerForms,
  type AnalyzerFact,
  type AssetAnalysisSummary,
} from "./analyzer-forms";
import { SimpleAnalyzer } from "./simple-analyzer";

export const maxDuration = 300;

type ProductSummary = {
  id: string;
  name: string;
  description: string | null;
  base_price: number | null;
  currency: string | null;
  category_key: string | null;
};

type CategoryRow = {
  key: string;
  parent_key: string | null;
  display_name: string;
  sort_order: number | null;
};

type FactDefinition = {
  id: string;
  key: string;
  display_name: string;
  value_type: string;
  description: string | null;
};

type CategoryFactRow = {
  category_key: string;
  fact_definition_id: string;
  importance: string | null;
  ask_user: boolean;
  fact_definitions: FactDefinition | FactDefinition[] | null;
};

type ProductFactRow = {
  id: string;
  fact_definition_id: string;
  value_json: unknown;
  source: string;
  status: string;
  confidence: number | null;
  locked: boolean;
};

type FactEvidenceRow = {
  fact_id: string;
  asset_id: string | null;
  metadata: unknown;
};

type ProductAssetRow = {
  id: string;
  storage_path: string;
  mime_type: string | null;
  metadata: unknown;
};

type AssetAnalysisRow = {
  id: string;
  asset_id: string;
  observations: unknown;
  created_at: string;
};

type AnalyzePageProps = {
  params: Promise<{ projectId: string }>;
};

function getOriginalFileName(metadata: unknown, fallback: string) {
  if (
    metadata &&
    typeof metadata === "object" &&
    "original_filename" in metadata &&
    typeof metadata.original_filename === "string"
  ) {
    return metadata.original_filename;
  }
  return fallback;
}

function isPrimitive(value: unknown): value is string | number | boolean {
  return ["string", "number", "boolean"].includes(typeof value);
}

function getEvidenceDetail(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null;
  const record = metadata as Record<string, unknown>;
  if (!isPrimitive(record.observedValue)) return null;
  return {
    value: record.observedValue,
    observation:
      typeof record.observation === "string" ? record.observation : null,
    confidence:
      typeof record.confidence === "number" ? record.confidence : null,
  };
}

export default async function AnalyzePage({ params }: AnalyzePageProps) {
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
      name,
      status,
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

  if (projectError) {
    throw new Error("프로젝트 정보를 불러오지 못했습니다.", {
      cause: projectError,
    });
  }
  if (!project) notFound();

  const productRelation = project.products as ProductSummary | ProductSummary[] | null;
  const product = Array.isArray(productRelation) ? productRelation[0] : productRelation;
  if (!product) notFound();

  const [categoriesResult, assetsResult, productFactsResult] = await Promise.all([
    supabase
      .from("categories")
      .select("key, parent_key, display_name, sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("product_assets")
      .select("id, storage_path, mime_type, metadata")
      .eq("product_id", product.id)
      .like("storage_path", `${workspace.id}/products/${product.id}/original/%`)
      .order("created_at", { ascending: true }),
    supabase
      .from("product_facts")
      .select("id, fact_definition_id, value_json, source, status, confidence, locked")
      .eq("product_id", product.id),
  ]);

  if (categoriesResult.error) throw categoriesResult.error;
  if (assetsResult.error) throw assetsResult.error;
  if (productFactsResult.error) throw productFactsResult.error;

  const categories = (categoriesResult.data ?? []) as CategoryRow[];
  let categoryFactRows: CategoryFactRow[] = [];
  let missingRequiredBlueprintNames: string[] = [];

  if (product.category_key) {
    const lineageKeys = resolveCategoryLineageKeys(categories, product.category_key);
    const categoryCatalog = await loadResolvedCategoryFacts(supabase, lineageKeys);
    categoryFactRows = categoryCatalog.facts as CategoryFactRow[];
    missingRequiredBlueprintNames = categoryCatalog.missingBlueprints
      .filter((blueprint) => blueprint.importance === "REQUIRED")
      .map((blueprint) => blueprint.displayName);
  }

  const assets = (assetsResult.data ?? []) as ProductAssetRow[];
  const productFacts = (productFactsResult.data ?? []) as ProductFactRow[];
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  let assetAnalysisRows: AssetAnalysisRow[] = [];
  let factEvidenceRows: FactEvidenceRow[] = [];

  if (assets.length > 0) {
    const { data, error } = await supabase
      .from("asset_analyses")
      .select("id, asset_id, observations, created_at")
      .in("asset_id", assets.map((asset) => asset.id))
      .order("created_at", { ascending: false });
    if (error) throw error;
    assetAnalysisRows = (data ?? []) as AssetAnalysisRow[];
  }

  if (productFacts.length > 0) {
    const { data, error } = await supabase
      .from("fact_evidence")
      .select("fact_id, asset_id, metadata")
      .in("fact_id", productFacts.map((fact) => fact.id));
    if (error) throw error;
    factEvidenceRows = (data ?? []) as FactEvidenceRow[];
  }

  const evidenceByFact = new Map<
    string,
    Array<{
      value: string | number | boolean;
      observation: string | null;
      confidence: number | null;
      fileName: string | null;
    }>
  >();

  factEvidenceRows.forEach((row) => {
    const detail = getEvidenceDetail(row.metadata);
    if (!detail) return;
    const asset = row.asset_id ? assetById.get(row.asset_id) : undefined;
    const current = evidenceByFact.get(row.fact_id) ?? [];
    current.push({
      ...detail,
      fileName: asset ? getOriginalFileName(asset.metadata, "상품 이미지") : null,
    });
    evidenceByFact.set(row.fact_id, current);
  });

  const productFactByDefinition = new Map(
    productFacts.map((fact) => [fact.fact_definition_id, fact])
  );

  const analyzerFacts = categoryFactRows
    .reduce<AnalyzerFact[]>((facts, categoryFact) => {
      const relation = categoryFact.fact_definitions;
      const definition = Array.isArray(relation) ? relation[0] : relation;
      if (!definition) return facts;
      const savedFact = productFactByDefinition.get(definition.id);
      facts.push({
        factId: savedFact?.id ?? null,
        definitionId: definition.id,
        key: definition.key,
        displayName: definition.display_name,
        valueType: definition.value_type,
        description: definition.description,
        importance: categoryFact.importance,
        askUser: categoryFact.ask_user,
        value: savedFact ? savedFact.value_json : null,
        source: savedFact?.source ?? null,
        status: savedFact?.status ?? null,
        confidence: savedFact?.confidence ?? null,
        locked: savedFact?.locked ?? false,
        evidence: savedFact ? evidenceByFact.get(savedFact.id) ?? [] : [],
      });
      return facts;
    }, [])
    .sort((first, second) => {
      if (first.askUser !== second.askUser) return first.askUser ? -1 : 1;
      return first.displayName.localeCompare(second.displayName, "ko");
    });

  const selectedCategory = categories.find(
    (category) => category.key === product.category_key
  );

  const seenAnalysisAssets = new Set<string>();
  const analysisSummaries = assetAnalysisRows.reduce<AssetAnalysisSummary[]>(
    (summaries, row) => {
      if (seenAnalysisAssets.has(row.asset_id)) return summaries;
      const parsed = storedAssetAnalysisSchema.safeParse(row.observations);
      if (!parsed.success) return summaries;
      seenAnalysisAssets.add(row.asset_id);
      const asset = assetById.get(row.asset_id);
      summaries.push({
        assetId: row.asset_id,
        fileName: getOriginalFileName(
          asset?.metadata,
          `상품 이미지 ${summaries.length + 1}`
        ),
        analyzedAt: parsed.data.analyzedAt || row.created_at,
        model: parsed.data.model,
        isProductRelevant: parsed.data.isProductRelevant ?? null,
        relevanceReason: parsed.data.relevanceReason ?? null,
        summary: parsed.data.summary,
        visibleDetails: parsed.data.visibleDetails,
        warnings: parsed.data.warnings,
        candidateFacts: parsed.data.candidateFacts.map((fact) => ({
          displayName: fact.displayName,
          value: String(fact.value),
          confidence: fact.confidence,
          outcome: fact.outcome,
        })),
      });
      return summaries;
    },
    []
  );

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-950">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-violet-600">DETAIL AI</p>
            <p className="mt-1 text-sm text-neutral-500">상품 정보 정리</p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            대시보드
          </Link>
        </div>
      </header>

      <div className="border-b border-neutral-200 bg-neutral-950 text-white">
        <div className="mx-auto max-w-6xl px-6 py-9">
          <span className="inline-flex rounded-full bg-violet-500 px-3 py-1.5 text-xs font-bold">
            AI 상품 분석
          </span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
            먼저 정리하고, 필요한 것만 물어볼게요
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
            아는 만큼 입력한 내용을 정리하고 사진에서 확인 가능한 정보를 더합니다. 모르는 정보는 비워둔 채로 진행할 수 있습니다.
          </p>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-7 px-6 py-10 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="h-fit rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
          <p className="text-xs font-semibold text-neutral-400">현재 상품</p>
          <h2 className="mt-2 text-lg font-bold text-neutral-950">{product.name}</h2>
          {product.base_price !== null && (
            <p className="mt-1 text-sm font-bold text-violet-600">
              {new Intl.NumberFormat("ko-KR").format(product.base_price)}원
            </p>
          )}
          {product.description && (
            <p className="mt-4 line-clamp-6 whitespace-pre-wrap text-xs leading-5 text-neutral-500">
              {product.description}
            </p>
          )}
          <div className="mt-5 border-t border-neutral-100 pt-4 text-xs text-neutral-500">
            등록 이미지 {assets.length}장
          </div>
        </aside>

        <div>
          <SimpleAnalyzer
            projectId={projectId}
            productId={product.id}
            categories={categories.map((category) => ({
              key: category.key,
              displayName: category.display_name,
              parentKey: category.parent_key,
            }))}
            selectedCategoryKey={product.category_key}
            selectedCategoryName={selectedCategory?.display_name ?? null}
            facts={analyzerFacts}
            assetCount={assets.length}
            openAIConfigured={isOpenAIConfigured()}
          />

          <details className="mt-8 rounded-3xl border border-neutral-200 bg-white">
            <summary className="cursor-pointer list-none px-6 py-5 text-sm font-bold text-neutral-600">
              고급 상품 정보 관리
              <span className="ml-2 text-xs font-normal text-neutral-400">
                전체 항목 · 분석 근거 · 잠금 등
              </span>
            </summary>
            <div className="border-t border-neutral-200 p-5 sm:p-6">
              <AnalyzerForms
                projectId={projectId}
                categories={categories.map((category) => ({
                  key: category.key,
                  displayName: category.display_name,
                  parentKey: category.parent_key,
                }))}
                selectedCategoryKey={product.category_key}
                selectedCategoryName={selectedCategory?.display_name ?? null}
                facts={analyzerFacts}
                assetCount={assets.length}
                openAIConfigured={isOpenAIConfigured()}
                analysisSummaries={analysisSummaries}
                missingRequiredBlueprintNames={missingRequiredBlueprintNames}
              />
            </div>
          </details>
        </div>
      </div>
    </main>
  );
}
