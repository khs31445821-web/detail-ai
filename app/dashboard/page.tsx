import Link from "next/link";
import { redirect } from "next/navigation";

import { pageDocumentSchema } from "@/lib/page-document";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace/get-or-create-workspace";

type DashboardProject = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  selected_strategy_id: string | null;
  page_document: unknown;
  products:
    | { id: string; name: string }
    | Array<{ id: string; name: string }>
    | null;
};

function getProjectDestination(project: DashboardProject, hasStrategies: boolean) {
  if (pageDocumentSchema.safeParse(project.page_document).success) {
    return {
      href: `/projects/${project.id}/editor`,
      stage: "상세페이지 초안 완성",
      action: "편집기 열기",
      color: "bg-emerald-50 text-emerald-700",
    };
  }
  if (project.selected_strategy_id) {
    return {
      href: `/projects/${project.id}/planner`,
      stage: "페이지 구조 설계",
      action: "페이지 설계 계속",
      color: "bg-blue-50 text-blue-700",
    };
  }
  if (hasStrategies) {
    return {
      href: `/projects/${project.id}/strategies`,
      stage: "판매전략 선택",
      action: "전략 선택 계속",
      color: "bg-violet-50 text-violet-700",
    };
  }
  return {
    href: `/projects/${project.id}/analyze`,
    stage: "상품 정보 정리",
    action: "상품 분석 계속",
    color: "bg-amber-50 text-amber-800",
  };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspace = await getOrCreateWorkspace();
  if (!workspace) redirect("/login");

  const { data: projectRows, error: projectsError } = await supabase
    .from("projects")
    .select(`
      id,
      name,
      status,
      created_at,
      selected_strategy_id,
      page_document,
      products (id, name)
    `)
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  if (projectsError) {
    throw new Error("프로젝트 목록을 불러오지 못했습니다.", {
      cause: projectsError,
    });
  }

  const projects = (projectRows ?? []) as DashboardProject[];
  let strategyProjectIds = new Set<string>();

  if (projects.length > 0) {
    const { data: strategyRows, error: strategiesError } = await supabase
      .from("strategies")
      .select("project_id")
      .in("project_id", projects.map((project) => project.id));
    if (strategiesError) {
      throw new Error("프로젝트 진행 상태를 불러오지 못했습니다.", {
        cause: strategiesError,
      });
    }
    strategyProjectIds = new Set(
      (strategyRows ?? []).map((strategy) => strategy.project_id)
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-violet-600">DETAIL AI</p>
            <h1 className="mt-1 text-xl font-bold text-neutral-900">
              {workspace.name}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/settings/store"
              className="rounded-xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              스토어 기본정보
            </Link>
            <Link
              href="/products/new"
              className="rounded-xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              + 새 상세페이지
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900">
            내 상세페이지
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            상품을 등록하고 AI 상세페이지를 만들어보세요.
          </p>
        </div>

        {!projects.length ? (
          <div className="rounded-3xl border border-dashed border-neutral-300 bg-white px-6 py-20 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-2xl">
              ✦
            </div>
            <h3 className="text-lg font-semibold text-neutral-900">
              아직 만든 상세페이지가 없습니다
            </h3>
            <p className="mt-2 text-sm text-neutral-500">
              첫 상품을 등록하고 AI가 상세페이지를 만드는 과정을 시작해보세요.
            </p>
            <Link
              href="/products/new"
              className="mt-6 inline-flex rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-700"
            >
              첫 상세페이지 만들기
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => {
              const destination = getProjectDestination(
                project,
                strategyProjectIds.has(project.id)
              );
              const productRelation = Array.isArray(project.products)
                ? project.products[0]
                : project.products;

              return (
                <Link
                  key={project.id}
                  href={destination.href}
                  className="group rounded-2xl border border-neutral-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="mb-7 flex aspect-[4/3] items-center justify-center rounded-xl bg-gradient-to-br from-violet-50 via-white to-neutral-100">
                    <span className="text-4xl text-violet-300">✦</span>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${destination.color}`}>
                    {destination.stage}
                  </span>
                  <h3 className="mt-3 font-semibold text-neutral-900">
                    {project.name}
                  </h3>
                  {productRelation?.name && (
                    <p className="mt-1 truncate text-xs text-neutral-400">
                      {productRelation.name}
                    </p>
                  )}
                  <p className="mt-5 text-sm font-bold text-violet-600 transition group-hover:text-violet-700">
                    {destination.action} →
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
