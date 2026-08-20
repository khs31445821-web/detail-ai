import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { rowToStorePolicy } from "@/lib/store-policy";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace/get-or-create-workspace";

import { resetProductStoreOverride } from "./actions";
import { StoreSettingsForm } from "./store-settings-form";

type StoreSettingsPageProps = {
  searchParams: Promise<{ productId?: string }>;
};

const SELECT_FIELDS =
  "shipping_fee, free_shipping_threshold, average_dispatch_time, shipping_method, remote_area_fee, return_exchange_window, return_shipping_fee, exchange_shipping_fee, customer_service";

export default async function StoreSettingsPage({
  searchParams,
}: StoreSettingsPageProps) {
  const { productId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspace = await getOrCreateWorkspace();
  if (!workspace) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("store_profiles")
    .select(SELECT_FIELDS)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(
      "스토어 기본정보를 불러오지 못했습니다. 새 Supabase 마이그레이션을 먼저 적용해주세요.",
      { cause: profileError }
    );
  }

  const defaults = rowToStorePolicy(profile);
  let productName: string | null = null;
  let override = rowToStorePolicy(null);
  let hasOverride = false;

  if (productId) {
    const [{ data: product, error: productError }, overrideResult] =
      await Promise.all([
        supabase
          .from("products")
          .select("id, name")
          .eq("id", productId)
          .eq("workspace_id", workspace.id)
          .maybeSingle(),
        supabase
          .from("product_store_overrides")
          .select(SELECT_FIELDS)
          .eq("workspace_id", workspace.id)
          .eq("product_id", productId)
          .maybeSingle(),
      ]);

    if (productError || overrideResult.error) {
      throw new Error("상품별 배송 정보를 불러오지 못했습니다.", {
        cause: productError ?? overrideResult.error,
      });
    }
    if (!product) notFound();
    productName = product.name;
    hasOverride = Boolean(overrideResult.data);
    override = rowToStorePolicy(overrideResult.data);
  }

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-950">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-violet-600">DETAIL AI</p>
            <p className="mt-1 text-sm text-neutral-500">
              {productId ? "상품별 배송 · 교환 정보" : "스토어 기본정보"}
            </p>
          </div>
          <Link
            href={productId ? "/dashboard" : "/dashboard"}
            className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            대시보드
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8">
          <span className="inline-flex rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">
            한 번 저장하면 자동 사용
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">
            {productId
              ? `${productName}만 다른 정보가 있나요?`
              : "배송 · 교환 정보를 매번 입력하지 마세요"}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-500">
            {productId
              ? "비워둔 항목은 스토어 기본값을 그대로 사용합니다. 이 상품만 다른 내용만 입력하세요."
              : "스토어 공통 정책을 한 번 저장하면 상세페이지 제작 때 자동으로 사용합니다. 아직 정해지지 않은 항목은 비워둬도 됩니다."}
          </p>
        </div>

        <StoreSettingsForm
          productId={productId}
          values={productId ? override : defaults}
          defaults={productId ? defaults : null}
        />

        {productId && hasOverride && (
          <form action={resetProductStoreOverride} className="mt-4">
            <input type="hidden" name="productId" value={productId} />
            <button
              type="submit"
              className="w-full rounded-2xl border border-neutral-200 bg-white px-5 py-3.5 text-sm font-bold text-neutral-600 hover:bg-neutral-50"
            >
              이 상품 변경값 삭제하고 기본값 사용
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
