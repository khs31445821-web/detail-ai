"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace/get-or-create-workspace";

const moneyField = z
  .string()
  .trim()
  .max(12)
  .refine((value) => value === "" || /^\d+$/.test(value), "금액은 숫자로 입력해주세요.")
  .refine(
    (value) => value === "" || Number(value) <= 999_999_999,
    "금액은 999,999,999원 이하여야 해요."
  );

const storePolicySchema = z.object({
  productId: z.string().uuid().optional().or(z.literal("")),
  shippingFee: moneyField,
  freeShippingThreshold: moneyField,
  averageDispatchTime: z.string().trim().max(120),
  shippingMethod: z.string().trim().max(120),
  remoteAreaFee: moneyField,
  returnExchangeWindow: z.string().trim().max(120),
  returnShippingFee: moneyField,
  exchangeShippingFee: moneyField,
  customerService: z.string().trim().max(300),
});

export type StoreSettingsState = {
  status: "idle" | "success" | "error";
  message?: string;
};

function getValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function moneyOrNull(value: string) {
  return value ? Number(value) : null;
}

function textOrNull(value: string) {
  return value.trim() || null;
}

export async function saveStoreSettings(
  _previousState: StoreSettingsState,
  formData: FormData
): Promise<StoreSettingsState> {
  const parsed = storePolicySchema.safeParse({
    productId: getValue(formData, "productId"),
    shippingFee: getValue(formData, "shippingFee"),
    freeShippingThreshold: getValue(formData, "freeShippingThreshold"),
    averageDispatchTime: getValue(formData, "averageDispatchTime"),
    shippingMethod: getValue(formData, "shippingMethod"),
    remoteAreaFee: getValue(formData, "remoteAreaFee"),
    returnExchangeWindow: getValue(formData, "returnExchangeWindow"),
    returnShippingFee: getValue(formData, "returnShippingFee"),
    exchangeShippingFee: getValue(formData, "exchangeShippingFee"),
    customerService: getValue(formData, "customerService"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "입력한 내용을 확인해주세요.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "다시 로그인해주세요." };

  const workspace = await getOrCreateWorkspace();
  if (!workspace) return { status: "error", message: "작업공간을 찾지 못했습니다." };

  const values = parsed.data;
  const payload = {
    shipping_fee: moneyOrNull(values.shippingFee),
    free_shipping_threshold: moneyOrNull(values.freeShippingThreshold),
    average_dispatch_time: textOrNull(values.averageDispatchTime),
    shipping_method: textOrNull(values.shippingMethod),
    remote_area_fee: moneyOrNull(values.remoteAreaFee),
    return_exchange_window: textOrNull(values.returnExchangeWindow),
    return_shipping_fee: moneyOrNull(values.returnShippingFee),
    exchange_shipping_fee: moneyOrNull(values.exchangeShippingFee),
    customer_service: textOrNull(values.customerService),
    updated_at: new Date().toISOString(),
  };

  try {
    if (values.productId) {
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("id")
        .eq("id", values.productId)
        .eq("workspace_id", workspace.id)
        .maybeSingle();
      if (productError) throw productError;
      if (!product) {
        return { status: "error", message: "상품을 찾을 수 없습니다." };
      }

      const { error } = await supabase.from("product_store_overrides").upsert({
        product_id: product.id,
        workspace_id: workspace.id,
        ...payload,
      });
      if (error) throw error;
      revalidatePath("/settings/store");
      return { status: "success", message: "이 상품에만 적용할 정보를 저장했습니다." };
    }

    const { error } = await supabase.from("store_profiles").upsert({
      workspace_id: workspace.id,
      ...payload,
    });
    if (error) throw error;
    revalidatePath("/settings/store");
    return { status: "success", message: "스토어 기본정보를 저장했습니다." };
  } catch (error) {
    console.error("스토어 기본정보 저장 실패:", error);
    return {
      status: "error",
      message: "스토어 기본정보를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.",
    };
  }
}

export async function resetProductStoreOverride(formData: FormData) {
  const productId = z.string().uuid().safeParse(formData.get("productId"));
  if (!productId.success) return;

  const supabase = await createClient();
  const workspace = await getOrCreateWorkspace();
  if (!workspace) return;

  const { error } = await supabase
    .from("product_store_overrides")
    .delete()
    .eq("product_id", productId.data)
    .eq("workspace_id", workspace.id);
  if (error) throw error;
  revalidatePath("/settings/store");
}
