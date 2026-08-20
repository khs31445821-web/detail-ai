import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace/get-or-create-workspace";

import { ProductForm } from "./product-form";

export default async function NewProductPage() {
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

      <div className="mx-auto max-w-7xl px-6 py-10 lg:py-14">
        <div className="mb-9 max-w-2xl">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-violet-600">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100">
              1
            </span>
            상품 등록
          </div>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            어떤 상품의 상세페이지를 만들까요?
          </h1>
          <p className="mt-3 text-base leading-7 text-neutral-500">
            정확한 상품 정보와 원본 이미지를 등록해주세요. 다음 단계에서 AI가
            상품을 분석하고 판매 전략을 제안합니다.
          </p>
        </div>

        <ProductForm />
      </div>
    </main>
  );
}
