"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  reviewProductFact,
  selectProductCategory,
  type AnalyzerActionState,
} from "./actions";
import { prepareSmartAnalysis, saveSmartAnswers } from "./smart-actions";
import type { AnalyzerFact } from "./analyzer-forms";

type CategoryOption = {
  key: string;
  displayName: string;
  parentKey: string | null;
};

const initialState: AnalyzerActionState = { status: "idle" };

function getDisplayValue(value: unknown) {
  if (value === true) return "예";
  if (value === false) return "아니오";
  if (value === null || value === undefined || value === "") return "-";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function importanceRank(value: string | null) {
  const normalized = value?.toUpperCase();
  if (normalized === "REQUIRED" || normalized === "CORE") return 0;
  if (normalized === "RECOMMENDED" || normalized === "IMPORTANT") return 1;
  return 2;
}

function ActionMessage({ state }: { state: AnalyzerActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return (
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
  );
}

function SmartQuestion({ fact, index }: { fact: AnalyzerFact; index: number }) {
  const [unknown, setUnknown] = useState(false);
  const normalizedType = fact.valueType.toUpperCase();
  const inputName = `fact_${fact.definitionId}`;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-black text-violet-700">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <label className="text-sm font-bold text-neutral-900">
            {fact.displayName}을 알려주실 수 있나요?
          </label>
          {fact.description && (
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              {fact.description}
            </p>
          )}

          {normalizedType.includes("BOOLEAN") ? (
            <select
              name={inputName}
              disabled={unknown}
              defaultValue=""
              className="mt-3 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-3 text-sm outline-none disabled:opacity-40"
            >
              <option value="">선택해주세요</option>
              <option value="true">예</option>
              <option value="false">아니오</option>
            </select>
          ) : (
            <input
              name={inputName}
              type={
                normalizedType.includes("NUMBER") ||
                normalizedType.includes("INTEGER") ||
                normalizedType.includes("DECIMAL")
                  ? "number"
                  : "text"
              }
              disabled={unknown}
              placeholder="아는 내용만 입력해주세요"
              className="mt-3 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-3 text-sm outline-none placeholder:text-neutral-400 disabled:opacity-40"
            />
          )}

          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-neutral-500">
            <input
              type="checkbox"
              checked={unknown}
              onChange={(event) => setUnknown(event.target.checked)}
              className="h-4 w-4 accent-violet-600"
            />
            잘 모르겠어요
          </label>
        </div>
      </div>
    </div>
  );
}

function CandidateReview({
  fact,
  projectId,
}: {
  fact: AnalyzerFact;
  projectId: string;
}) {
  const reviewAction = reviewProductFact.bind(null, projectId);
  const [state, formAction, pending] = useActionState(reviewAction, initialState);
  const conflictValues = [
    fact.value,
    ...fact.evidence.map((evidence) => evidence.value),
  ].filter(
    (value, index, all) =>
      value !== null &&
      value !== undefined &&
      all.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(value)) === index
  );

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
      <p className="text-xs font-bold text-amber-800">사진에서 찾은 정보</p>
      <p className="mt-2 text-sm font-bold text-neutral-900">
        {fact.displayName}: {getDisplayValue(fact.value)}
      </p>
      {fact.evidence[0]?.observation && (
        <p className="mt-1 text-xs leading-5 text-neutral-500">
          {fact.evidence[0].observation}
        </p>
      )}
      <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
        <input type="hidden" name="factId" value={fact.factId ?? ""} />
        {fact.status === "CONFLICTED" && (
          <select
            name="selectedValue"
            defaultValue={JSON.stringify(conflictValues[0])}
            className="min-w-36 rounded-lg border border-amber-200 bg-white px-2.5 py-2 text-xs"
          >
            {conflictValues.map((value) => (
              <option key={JSON.stringify(value)} value={JSON.stringify(value)}>
                {getDisplayValue(value)}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          name="decision"
          value="confirm"
          disabled={pending}
          className="rounded-lg bg-neutral-950 px-3 py-2 text-xs font-bold text-white"
        >
          맞아요
        </button>
        <button
          type="submit"
          name="decision"
          value="reject"
          disabled={pending}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-600"
        >
          아니에요
        </button>
      </form>
      <ActionMessage state={state} />
    </div>
  );
}

export function SimpleAnalyzer({
  projectId,
  productId,
  categories,
  selectedCategoryKey,
  selectedCategoryName,
  facts,
  assetCount,
  openAIConfigured,
}: {
  projectId: string;
  productId: string;
  categories: CategoryOption[];
  selectedCategoryKey: string | null;
  selectedCategoryName: string | null;
  facts: AnalyzerFact[];
  assetCount: number;
  openAIConfigured: boolean;
}) {
  const categoryAction = selectProductCategory.bind(null, projectId);
  const analyzeAction = prepareSmartAnalysis.bind(null, projectId);
  const answersAction = saveSmartAnswers.bind(null, projectId);
  const [categoryState, categoryFormAction, categoryPending] = useActionState(
    categoryAction,
    initialState
  );
  const [analysisState, analysisFormAction, analysisPending] = useActionState(
    analyzeAction,
    initialState
  );
  const [answerState, answerFormAction, answerPending] = useActionState(
    answersAction,
    initialState
  );

  const confirmedFacts = facts.filter((fact) => fact.status === "CONFIRMED");
  const reviewFacts = facts.filter(
    (fact) =>
      fact.factId &&
      (fact.status === "CANDIDATE" || fact.status === "CONFLICTED")
  );
  const smartQuestions = facts
    .filter(
      (fact) =>
        fact.askUser &&
        fact.status !== "CONFIRMED" &&
        fact.status !== "CANDIDATE" &&
        fact.status !== "CONFLICTED" &&
        fact.status !== "REJECTED"
    )
    .sort((a, b) => {
      const rank = importanceRank(a.importance) - importanceRank(b.importance);
      return rank || a.displayName.localeCompare(b.displayName, "ko");
    })
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {!selectedCategoryKey ? (
        <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <span className="inline-flex rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">
            한 가지만 먼저 확인할게요
          </span>
          <h2 className="mt-4 text-xl font-bold text-neutral-950">
            어떤 종류의 상품인가요?
          </h2>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            정확한 분석을 위해 가장 가까운 카테고리만 선택해주세요.
          </p>
          <form action={categoryFormAction} className="mt-5">
            <select
              name="categoryKey"
              required
              defaultValue=""
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3.5 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
            >
              <option value="" disabled>
                카테고리 선택
              </option>
              {categories.map((category) => (
                <option key={category.key} value={category.key}>
                  {category.parentKey ? "↳ " : ""}
                  {category.displayName}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={categoryPending}
              className="mt-3 w-full rounded-2xl bg-neutral-950 px-5 py-3.5 text-sm font-bold text-white disabled:bg-neutral-300"
            >
              {categoryPending ? "저장하는 중..." : "이 카테고리로 분석하기"}
            </button>
          </form>
          <ActionMessage state={categoryState} />
        </section>
      ) : (
        <>
          <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-violet-600">
                  {selectedCategoryName ?? "상품"} · {assetCount > 0 ? `사진 ${assetCount}장` : "사진 없음"}
                </p>
                <h2 className="mt-2 text-xl font-bold text-neutral-950">
                  먼저 AI가 상품 정보를 정리할게요
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
                  직접 적은 설명과 사진에서 확인 가능한 내용을 정리합니다. 추측이 필요한 내용은 확정하지 않습니다.
                </p>
              </div>
              <Link
                href={`/settings/store?productId=${productId}`}
                className="text-xs font-bold text-neutral-500 underline decoration-neutral-300 underline-offset-4"
              >
                이 상품만 배송·교환 정보 변경
              </Link>
            </div>

            <form action={analysisFormAction} className="mt-5">
              <label className="flex items-start gap-3 rounded-2xl bg-neutral-50 px-4 py-3 text-xs leading-5 text-neutral-600">
                <input
                  type="checkbox"
                  name="externalAnalysisConsent"
                  value="accepted"
                  required
                  className="mt-0.5 h-4 w-4 accent-violet-600"
                />
                상품 분석을 위해 입력한 상품 정보와 이미지를 AI 분석 서비스로 전송하는 데 동의합니다.
              </label>
              <button
                type="submit"
                disabled={analysisPending || !openAIConfigured}
                className="mt-3 w-full rounded-2xl bg-violet-600 px-5 py-4 text-sm font-bold text-white transition hover:bg-violet-700 disabled:bg-neutral-300"
              >
                {analysisPending
                  ? "상품 정보를 정리하는 중..."
                  : confirmedFacts.length > 0
                    ? "AI로 다시 정리하기"
                    : "AI가 상품 정보 정리하기"}
              </button>
            </form>
            {!openAIConfigured && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                현재 AI 분석 설정이 없어 수동 정보 입력만 사용할 수 있습니다.
              </p>
            )}
            <ActionMessage state={analysisState} />
          </section>

          {confirmedFacts.length > 0 && (
            <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-emerald-700">정리 완료</p>
                  <h2 className="mt-2 text-xl font-bold text-neutral-950">
                    이렇게 이해했어요
                  </h2>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                  {confirmedFacts.length}개
                </span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {confirmedFacts.map((fact) => (
                  <div key={fact.definitionId} className="rounded-2xl bg-neutral-50 px-4 py-3.5">
                    <p className="text-xs font-semibold text-neutral-400">
                      {fact.displayName}
                    </p>
                    <p className="mt-1.5 text-sm font-bold text-neutral-900">
                      {getDisplayValue(fact.value)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {reviewFacts.length > 0 && (
            <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-lg font-bold text-neutral-950">
                사진에서 찾은 내용만 확인해주세요
              </h2>
              <p className="mt-2 text-sm text-neutral-500">
                맞으면 확정하고, 아니면 제외합니다. 확인하지 않고 넘어가도 됩니다.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {reviewFacts.map((fact) => (
                  <CandidateReview key={fact.factId} fact={fact} projectId={projectId} />
                ))}
              </div>
            </section>
          )}

          {smartQuestions.length > 0 ? (
            <section className="rounded-3xl border border-violet-200 bg-violet-50/40 p-6 sm:p-8">
              <span className="inline-flex rounded-full bg-white px-3 py-1.5 text-xs font-bold text-violet-700">
                최대 3개만 확인
              </span>
              <h2 className="mt-4 text-xl font-bold text-neutral-950">
                더 좋은 상세페이지를 위해 몇 가지만 알려주세요
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                모르거나 번거로운 항목은 건너뛰어도 됩니다.
              </p>
              <form action={answerFormAction} className="mt-5 space-y-3">
                {smartQuestions.map((fact, index) => (
                  <SmartQuestion key={fact.definitionId} fact={fact} index={index} />
                ))}
                <button
                  type="submit"
                  disabled={answerPending}
                  className="w-full rounded-2xl bg-neutral-950 px-5 py-3.5 text-sm font-bold text-white disabled:bg-neutral-300"
                >
                  {answerPending ? "저장하는 중..." : "답변 저장"}
                </button>
              </form>
              <ActionMessage state={answerState} />
            </section>
          ) : (
            <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
              <p className="text-sm font-bold text-emerald-900">
                지금 정보면 충분해요. 추가 질문 없이 계속 만들 수 있습니다.
              </p>
            </section>
          )}

          <section className="rounded-3xl bg-neutral-950 p-6 text-white sm:flex sm:items-center sm:justify-between sm:gap-5 sm:p-8">
            <div>
              <h2 className="text-xl font-bold">지금 정보로 만들까요?</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                모르는 내용은 비워둔 채로 진행하고, 확인된 정보 안에서만 상세페이지를 만듭니다.
              </p>
            </div>
            <Link
              href={`/projects/${projectId}/strategies`}
              className="mt-5 block shrink-0 rounded-2xl bg-white px-5 py-4 text-center text-sm font-bold text-neutral-950 transition hover:bg-violet-100 sm:mt-0"
            >
              지금 정보로 만들기 →
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
