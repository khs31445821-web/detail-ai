"use client";

import { useActionState } from "react";

import type { StorePolicy } from "@/lib/store-policy";
import { saveStoreSettings, type StoreSettingsState } from "./actions";

const initialState: StoreSettingsState = { status: "idle" };

function numberValue(value: number | null | undefined) {
  return value ?? "";
}

export function StoreSettingsForm({
  productId,
  values,
  defaults,
}: {
  productId?: string;
  values: StorePolicy;
  defaults?: StorePolicy | null;
}) {
  const [state, formAction, pending] = useActionState(
    saveStoreSettings,
    initialState
  );
  const isOverride = Boolean(productId);

  const textPlaceholder = (key: keyof StorePolicy, fallback: string) => {
    if (!isOverride || !defaults) return fallback;
    const value = defaults[key];
    return value === null || value === undefined || value === ""
      ? fallback
      : `기본값: ${String(value)}`;
  };

  return (
    <form action={formAction} className="space-y-6">
      {productId && <input type="hidden" name="productId" value={productId} />}

      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-bold text-neutral-950">배송</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-500">
          모르는 항목은 비워두세요. 없는 정보는 상세페이지에 억지로 만들지 않습니다.
        </p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label="배송비" suffix="원">
            <input name="shippingFee" type="number" min={0} defaultValue={numberValue(values.shippingFee)} placeholder={textPlaceholder("shippingFee", "예: 3000")} className={inputClass} />
          </Field>
          <Field label="무료배송 조건" suffix="원 이상">
            <input name="freeShippingThreshold" type="number" min={0} defaultValue={numberValue(values.freeShippingThreshold)} placeholder={textPlaceholder("freeShippingThreshold", "예: 50000")} className={inputClass} />
          </Field>
          <Field label="평균 출고기간">
            <input name="averageDispatchTime" defaultValue={values.averageDispatchTime ?? ""} placeholder={textPlaceholder("averageDispatchTime", "예: 결제 후 1~2영업일")} className={inputClass} />
          </Field>
          <Field label="배송 방법 / 택배사">
            <input name="shippingMethod" defaultValue={values.shippingMethod ?? ""} placeholder={textPlaceholder("shippingMethod", "예: CJ대한통운 택배")} className={inputClass} />
          </Field>
          <Field label="제주 / 도서산간 추가비용" suffix="원">
            <input name="remoteAreaFee" type="number" min={0} defaultValue={numberValue(values.remoteAreaFee)} placeholder={textPlaceholder("remoteAreaFee", "예: 3000")} className={inputClass} />
          </Field>
        </div>
      </section>

      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-bold text-neutral-950">교환 · 반품 · 문의</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label="교환 / 반품 가능기간">
            <input name="returnExchangeWindow" defaultValue={values.returnExchangeWindow ?? ""} placeholder={textPlaceholder("returnExchangeWindow", "예: 상품 수령 후 7일 이내")} className={inputClass} />
          </Field>
          <Field label="반품 배송비" suffix="원">
            <input name="returnShippingFee" type="number" min={0} defaultValue={numberValue(values.returnShippingFee)} placeholder={textPlaceholder("returnShippingFee", "예: 3000")} className={inputClass} />
          </Field>
          <Field label="교환 배송비" suffix="원">
            <input name="exchangeShippingFee" type="number" min={0} defaultValue={numberValue(values.exchangeShippingFee)} placeholder={textPlaceholder("exchangeShippingFee", "예: 6000")} className={inputClass} />
          </Field>
          <Field label="고객센터 / 문의 정보">
            <input name="customerService" defaultValue={values.customerService ?? ""} placeholder={textPlaceholder("customerService", "예: 평일 10:00~17:00 / 채팅 문의")} className={inputClass} />
          </Field>
        </div>
      </section>

      {state.status !== "idle" && state.message && (
        <p className={`rounded-2xl px-4 py-3 text-sm ${state.status === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-neutral-950 px-5 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:bg-neutral-300"
      >
        {pending
          ? "저장하는 중..."
          : isOverride
            ? "이 상품만 변경 저장"
            : "스토어 기본정보 저장"}
      </button>
    </form>
  );
}

const inputClass =
  "mt-2.5 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-3 text-sm outline-none transition placeholder:text-neutral-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100";

function Field({
  label,
  suffix,
  children,
}: {
  label: string;
  suffix?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-bold text-neutral-800">
      <span className="flex items-center justify-between gap-3">
        {label}
        {suffix && <span className="text-xs font-normal text-neutral-400">{suffix}</span>}
      </span>
      {children}
    </label>
  );
}
