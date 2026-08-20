import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace/get-or-create-workspace";

import { ProductForm } from "./product-form";

type CategoryRow = {
  key: string;
  parent_key: string | null;
  display_name: string;
};

export default async function NewProductPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const workspace = await getOrCreateWorkspace();
  if (!workspace) redirect("/login");

  const { data: categoryRows, error: categoryError } = await supabase
    .from("categories")
    .select("key, parent_key, display_name")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (categoryError) {
    throw new Error("상품 카테고리를 불러오지 못했습니다.", {
      cause: categoryError,
    });
  }

  const categories = (categoryRows ?? []) as CategoryRow[];

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-950">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-violet-600">DETAIL AI</p>
            <p className="mt-1 text-sm text-neutral-500">{workspace.name}</p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
          >
            대시보드로 돌아가기
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10 lg:py-16">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">
            빠르게 시작하기
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
            상품에 대해 아는 만큼만 알려주세요
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-neutral-500 sm:text-lg">
            사진, 상품명, 가격, 특징 중 아는 내용만 입력하면 AI가 먼저 정리하고
            부족한 정보만 짧게 확인합니다.
          </p>
        </div>

        <ProductForm
          categories={categories.map((category) => ({
            key: category.key,
            displayName: category.display_name,
            parentKey: category.parent_key,
          }))}
        />
      </div>
    </main>
  );
}
