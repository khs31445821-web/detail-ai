"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { PageDocument } from "@/lib/page-document";
import {
  generateFlexiblePageDocument,
} from "./flexible-actions";
import type { PlannerActionState } from "./actions";

type PlannerFormProps = {
  projectId: string;
  providerConfigured: boolean;
  hasPageDocument: boolean;
  sectionCount: number;
  marketResearch: PageDocument["marketResearch"];
};

const initialState: PlannerActionState = { status: "idle" };

export function PlannerForm({
  projectId,
  providerConfigured,
  hasPageDocument,
  sectionCount,
  marketResearch,
}: PlannerFormProps) {
  const action = generateFlexiblePageDocument.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">
            상세페이지 만들기
          </p>
          <h2 className="mt-2 text-xl font-bold text-neutral-950">
            선택한 판매 방향으로 초안을 만들게요
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
            지금 확인된 상품 정보만 사용해 카피와 디자인 구성을 자동으로 만듭니다.
          </p>
        </div>
        {hasPageDocument && (
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
            초안 {sectionCount}개 영역
          </span>
        )}
      </div>

      <form action={formAction} className="mt-6">
        <label className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3.5 text-xs leading-5 text-neutral-600">
          <input
            type="checkbox"
            name="externalPlanningConsent"
            value="accepted"
            required
            className="mt-0.5 h-4 w-4 shrink-0 accent-violet-600"
          />
          <span>
            상세페이지 초안을 만들기 위해 선택한 판매 방향과 확인된 상품 정보를 AI 생성 서비스에 전송하는 데 동의합니다.
          </span>
        </label>
        <button
          type="submit"
          disabled={pending || !providerConfigured}
          className="mt-4 w-full rounded-2xl bg-violet-600 px-5 py-4 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          {pending
            ? "카피와 디자인 구성을 만드는 중..."
            : hasPageDocument
              ? "상세페이지 초안 다시 만들기"
              : "상세페이지 초안 만들기"}
        </button>
      </form>

      {state.status !== "idle" && state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`mt-4 rounded-xl px-4 py-3 text-sm ${
            state.status === "error"
              ? "bg-red-50 text-red-700"
              : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {state.message}
        </p>
      )}

      {marketResearch && (
        <details className="mt-5 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 open:bg-white">
          <summary className="cursor-pointer list-none px-4 py-3.5 text-xs font-bold text-neutral-700">
            AI가 참고한 시장·리뷰 정보 보기
          </summary>
          <div className="border-t border-neutral-200 px-4 py-4">
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-800">
              {marketResearch.caveat}
            </p>
            <p className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-[11px] leading-5 text-neutral-600">
              {marketResearch.summary}
            </p>
          </div>
        </details>
      )}

      {hasPageDocument && (
        <Link
          href={`/projects/${projectId}/editor`}
          className="mt-5 block rounded-2xl bg-neutral-950 px-5 py-4 text-center text-sm font-bold text-white transition hover:bg-neutral-800"
        >
          편집 시작하기 →
        </Link>
      )}
    </section>
  );
}
