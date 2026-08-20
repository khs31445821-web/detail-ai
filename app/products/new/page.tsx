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

      <div className="mx-auto max-w-6xl px-6 py-10 lg:py-16">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">
            1~3분 AI 상세페이지 제작
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
            사진 한 장이면,
            <br className="hidden sm:block" /> 상세페이지가 시작됩니다
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-neutral-500 sm:text-lg">
            사진 한 장 또는 상품명만 입력하세요. AI가 상품을 분석하고 판매기획,
            카피라이팅, 디자인 레이아웃까지 자동으로 이어갑니다.
          </p>
        </div>

        <ProductForm />
      </div>
    </main>
  );
}
