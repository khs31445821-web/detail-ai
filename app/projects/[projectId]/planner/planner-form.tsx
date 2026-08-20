"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { PageDocument } from "@/lib/page-document";

import {
  generatePageDocument,
  type PlannerActionState,
} from "./actions";

type PlannerFormProps = {
  projectId: string;
  providerConfigured: boolean;
  providerLabel: string;
  hasPageDocument: boolean;
  sectionCount: number;
  marketResearch: PageDocument["marketResearch"];
};

const initialState: PlannerActionState = { status: "idle" };

export function PlannerForm({
  projectId,
  providerConfigured,
  providerLabel,
  hasPageDocument,
  sectionCount,
  marketResearch,
}: PlannerFormProps) {
  const action = generatePageDocument.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">
            PageDocument · {providerLabel}
          </p>
          <h2 className="mt-2 text-xl font-bold text-neutral-950">
            상세페이지 초안 생성
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
            AI는 구조화된 JSON만 만들고, 실제 디자인은 미리 구현된 React Block이
            담당합니다.
          </p>
        </div>
        {hasPageDocument && (
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
            {sectionCount}개 블록 준비됨
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
            페이지 설계를 위해 선택 전략, 상품 기본정보와 CONFIRMED Fact가
            {` ${providerLabel} API`}로 전송되는 것에 동의합니다.
          </span>
        </label>
        <button
          type="submit"
          disabled={pending || !providerConfigured}
          className="mt-4 w-full rounded-2xl bg-violet-600 px-5 py-4 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          {pending
            ? "전환 구조와 블록을 설계하는 중..."
            : hasPageDocument
              ? "PageDocument 다시 생성"
              : "PageDocument 생성"}
        </button>
        {hasPageDocument && (
          <p className="mt-2 text-xs text-amber-700">
            다시 생성하면 현재 PageDocument 초안이 새 구조로 교체됩니다.
          </p>
        )}
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
        <details className="mt-5 overflow-hidden rounded-2xl border border-stone-200 bg-stone-50 open:bg-white">
          <summary className="cursor-pointer list-none px-4 py-3.5 text-xs font-black text-neutral-800">
            전략 단계에서 반영한 시장·리뷰 조사 · 출처 {marketResearch.sources.length}개
            <span className="ml-2 text-[10px] font-semibold text-neutral-400">
              펼쳐보기
            </span>
          </summary>
          <div className="border-t border-stone-200 px-4 py-4">
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-800">
              {marketResearch.caveat}
            </p>
            <p className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-[11px] leading-5 text-neutral-600">
              {marketResearch.summary}
            </p>
            <div className="mt-4 grid gap-2">
              {marketResearch.sources.map((source, index) => (
                <a
                  key={`${source.url}-${index}`}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate rounded-xl border border-stone-200 bg-white px-3 py-2 text-[10px] font-bold text-violet-700 hover:border-violet-300"
                >
                  {index + 1}. {source.title}
                </a>
              ))}
            </div>
          </div>
        </details>
      )}

      {hasPageDocument && (
        <Link
          href={`/projects/${projectId}/editor`}
          className="mt-5 block rounded-2xl bg-neutral-950 px-5 py-4 text-center text-sm font-bold text-white transition hover:bg-neutral-800"
        >
          블록 렌더링 결과 확인
        </Link>
      )}
    </section>
  );
}
