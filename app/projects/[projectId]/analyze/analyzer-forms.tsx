"use client";

import Link from "next/link";
import { useActionState } from "react";

import { ProductMeasurementInput } from "@/components/product-measurement-input";

import {
  analyzeProductImages,
  reviewProductFact,
  saveProductFacts,
  selectProductCategory,
  toggleProductFactLock,
  type AnalyzerActionState,
} from "./actions";

type CategoryOption = {
  key: string;
  displayName: string;
  parentKey: string | null;
};

export type AnalyzerFact = {
  factId: string | null;
  definitionId: string;
  key: string;
  displayName: string;
  valueType: string;
  description: string | null;
  importance: string | null;
  askUser: boolean;
  value: unknown;
  source: string | null;
  status: string | null;
  confidence: number | null;
  locked: boolean;
  evidence: Array<{
    value: string | number | boolean;
    observation: string | null;
    confidence: number | null;
    fileName: string | null;
  }>;
};

export type AssetAnalysisSummary = {
  assetId: string;
  fileName: string;
  analyzedAt: string;
  model: string;
  isProductRelevant: boolean | null;
  relevanceReason: string | null;
  summary: string;
  visibleDetails: string[];
  warnings: string[];
  candidateFacts: Array<{
    displayName: string;
    value: string;
    confidence: number;
    outcome: "CANDIDATE" | "CONFLICTED" | "PROTECTED" | "UNMAPPED";
  }>;
};

type AnalyzerFormsProps = {
  projectId: string;
  categories: CategoryOption[];
  selectedCategoryKey: string | null;
  selectedCategoryName: string | null;
  facts: AnalyzerFact[];
  assetCount: number;
  openAIConfigured: boolean;
  analysisSummaries: AssetAnalysisSummary[];
  missingRequiredBlueprintNames: string[];
};

const initialState: AnalyzerActionState = {
  status: "idle",
};

function getDefaultValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function getImportanceLabel(importance: string | null) {
  const normalized = importance?.toUpperCase();

  if (normalized === "REQUIRED" || normalized === "CORE") {
    return "필수";
  }

  if (normalized === "RECOMMENDED" || normalized === "IMPORTANT") {
    return "권장";
  }

  return null;
}

function isRequiredFact(fact: AnalyzerFact) {
  const normalized = fact.importance?.toUpperCase();
  return normalized === "REQUIRED" || normalized === "CORE";
}

function getFactDisplayValue(value: unknown) {
  if (value === true) {
    return "예";
  }

  if (value === false) {
    return "아니오";
  }

  return getDefaultValue(value) || "값 없음";
}

function isPrimitive(value: unknown): value is string | number | boolean {
  return ["string", "number", "boolean"].includes(typeof value);
}

function getReviewValues(fact: AnalyzerFact) {
  const values = [fact.value, ...fact.evidence.map((item) => item.value)].filter(
    isPrimitive
  );
  const seen = new Set<string>();

  return values.filter((value) => {
    const key = `${typeof value}:${JSON.stringify(value)}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getFactStatusStyle(status: string | null) {
  if (status === "CANDIDATE") {
    return "bg-amber-50 text-amber-700";
  }

  if (status === "CONFLICTED") {
    return "bg-red-50 text-red-700";
  }

  if (status === "REJECTED") {
    return "bg-neutral-100 text-neutral-500";
  }

  return "bg-emerald-50 text-emerald-700";
}

function getFactStatusLabel(status: string | null) {
  if (status === "CANDIDATE") {
    return "AI 후보";
  }

  if (status === "CONFLICTED") {
    return "값 충돌";
  }

  if (status === "REJECTED") {
    return "거절됨";
  }

  return status;
}

function getOutcomeLabel(outcome: AssetAnalysisSummary["candidateFacts"][number]["outcome"]) {
  if (outcome === "UNMAPPED") {
    return "카탈로그 연결 필요";
  }

  if (outcome === "CONFLICTED") {
    return "기존 값과 충돌";
  }

  if (outcome === "PROTECTED") {
    return "확정 Fact 보호";
  }

  return "AI 후보";
}

function FactInput({
  fact,
  sellingSizeValue,
}: {
  fact: AnalyzerFact;
  sellingSizeValue: unknown;
}) {
  const inputName = `fact_${fact.definitionId}`;
  const normalizedType = fact.valueType.toUpperCase();
  const defaultValue = getDefaultValue(fact.value);

  if (normalizedType.includes("BOOLEAN")) {
    return (
      <select
        id={inputName}
        name={inputName}
        defaultValue={defaultValue}
        disabled={fact.locked}
        className="mt-2.5 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-sm text-neutral-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
      >
        <option value="">선택해주세요</option>
        <option value="true">예</option>
        <option value="false">아니오</option>
      </select>
    );
  }

  const isNumber =
    normalizedType.includes("NUMBER") ||
    normalizedType.includes("INTEGER") ||
    normalizedType.includes("DECIMAL");
  const isMeasurements = fact.key === "measurements";

  if (isMeasurements) {
    return (
      <ProductMeasurementInput
        inputId={inputName}
        value={defaultValue}
        sellingSizeValue={sellingSizeValue}
        disabled={fact.locked}
      />
    );
  }

  return (
    <input
      id={inputName}
      name={inputName}
      type={isNumber ? "number" : "text"}
      step={isNumber ? "any" : undefined}
      defaultValue={defaultValue}
      disabled={fact.locked}
      placeholder={`${fact.displayName} 정보를 입력해주세요`}
      maxLength={1000}
      className="mt-2.5 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
    />
  );
}

function ActionMessage({ state }: { state: AnalyzerActionState }) {
  if (state.status === "idle" || !state.message) {
    return null;
  }

  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={`mt-3 rounded-xl px-3.5 py-3 text-sm ${
        state.status === "error"
          ? "bg-red-50 text-red-700"
          : "bg-emerald-50 text-emerald-700"
      }`}
    >
      {state.message}
    </p>
  );
}

export function AnalyzerForms({
  projectId,
  categories,
  selectedCategoryKey,
  selectedCategoryName,
  facts,
  assetCount,
  openAIConfigured,
  analysisSummaries,
  missingRequiredBlueprintNames,
}: AnalyzerFormsProps) {
  const selectCategoryAction = selectProductCategory.bind(null, projectId);
  const saveFactsAction = saveProductFacts.bind(null, projectId);
  const analyzeImagesAction = analyzeProductImages.bind(null, projectId);
  const reviewFactAction = reviewProductFact.bind(null, projectId);
  const toggleLockAction = toggleProductFactLock.bind(null, projectId);
  const [categoryState, categoryFormAction, categoryPending] = useActionState(
    selectCategoryAction,
    initialState
  );
  const [factsState, factsFormAction, factsPending] = useActionState(
    saveFactsAction,
    initialState
  );
  const [analysisState, analysisFormAction, analysisPending] = useActionState(
    analyzeImagesAction,
    initialState
  );
  const [reviewState, reviewFormAction, reviewPending] = useActionState(
    reviewFactAction,
    initialState
  );
  const [lockState, lockFormAction, lockPending] = useActionState(
    toggleLockAction,
    initialState
  );

  const userFacts = facts.filter((fact) => fact.askUser);
  const sellingSizeValue = userFacts.find(
    (fact) => fact.key === "size_options"
  )?.value;
  const analysisFacts = facts.filter((fact) => !fact.askUser);
  const reviewFacts = facts.filter(
    (fact) => fact.status === "CANDIDATE" || fact.status === "CONFLICTED"
  );
  const confirmedFacts = facts.filter((fact) => fact.status === "CONFIRMED");
  const requiredFacts = facts.filter(isRequiredFact);
  const missingRequiredFacts = requiredFacts.filter(
    (fact) => fact.status !== "CONFIRMED"
  );
  const readyForStrategy =
    Boolean(selectedCategoryKey) &&
    confirmedFacts.length > 0 &&
    missingRequiredFacts.length === 0 &&
    missingRequiredBlueprintNames.length === 0 &&
    reviewFacts.length === 0;
  const requiredIssueCount =
    missingRequiredFacts.length + missingRequiredBlueprintNames.length;
  const completionRate =
    facts.length + missingRequiredBlueprintNames.length > 0
      ? Math.round(
          (confirmedFacts.length /
            (facts.length + missingRequiredBlueprintNames.length)) *
            100
        )
      : 0;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">
              Category
            </p>
            <h2 className="mt-2 text-xl font-bold text-neutral-950">
              상품 카테고리
            </h2>
          </div>
          {selectedCategoryName && (
            <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
              {selectedCategoryName}
            </span>
          )}
        </div>

        <p className="mt-3 text-sm leading-6 text-neutral-500">
          카테고리에 따라 AI가 확인할 Fact와 사용자에게 물어볼 항목이 달라져요.
        </p>

        <form action={categoryFormAction} className="mt-5 sm:flex sm:gap-3">
          <select
            key={selectedCategoryKey ?? "unselected"}
            name="categoryKey"
            required
            defaultValue={selectedCategoryKey ?? ""}
            className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-sm text-neutral-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
          >
            <option value="" disabled>
              카테고리를 선택해주세요
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
            className="mt-3 w-full shrink-0 rounded-xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300 sm:mt-0 sm:w-auto"
          >
            {categoryPending ? "저장 중..." : "카테고리 저장"}
          </button>
        </form>
        <ActionMessage state={categoryState} />
      </section>

      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">
              AI Vision
            </p>
            <h2 className="mt-2 text-xl font-bold text-neutral-950">
              상품 이미지 관찰
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
              이미지에서 직접 확인되는 내용만 후보 Fact로 만들고, 어떤 사진이
              근거인지 함께 저장합니다.
            </p>
          </div>
          <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-600">
            {analysisSummaries.length}/{assetCount}장 분석됨
          </span>
        </div>

        {!openAIConfigured && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm leading-6 text-amber-800">
            서버에 <code className="font-bold">OPENAI_API_KEY</code>가 설정되지
            않았습니다. 키를 추가한 뒤 서버를 다시 시작해주세요.
          </div>
        )}

        <form action={analysisFormAction} className="mt-5">
          <label className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3.5 text-xs leading-5 text-neutral-600">
            <input
              type="checkbox"
              name="externalAnalysisConsent"
              value="accepted"
              required
              className="mt-0.5 h-4 w-4 shrink-0 accent-violet-600"
            />
            <span>
              분석을 위해 등록한 상품 이미지, 상품명과 설명이 OpenAI API로
              전송되는 것에 동의합니다. 결과는 확정값이 아닌 후보로 저장됩니다.
            </span>
          </label>
          <button
            type="submit"
            disabled={
              analysisPending ||
              !selectedCategoryKey ||
              assetCount === 0 ||
              !openAIConfigured
            }
            className="mt-4 w-full rounded-2xl bg-neutral-950 px-5 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {analysisPending
              ? `이미지 ${assetCount}장을 분석하는 중...`
              : analysisSummaries.length > 0
                ? "동의하고 이미지 다시 분석"
                : "동의하고 AI 이미지 분석 시작"}
          </button>
          {!selectedCategoryKey && (
            <p className="mt-2 text-xs text-amber-700">
              먼저 상품 카테고리를 저장해주세요.
            </p>
          )}
          <ActionMessage state={analysisState} />
        </form>

        {analysisSummaries.length > 0 && (
          <div className="mt-7 space-y-4 border-t border-neutral-200 pt-6">
            {analysisSummaries.map((analysis) => (
              <article
                key={analysis.assetId}
                className="rounded-2xl border border-neutral-200 p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-neutral-800">
                    {analysis.fileName}
                  </h3>
                  <span className="text-[11px] text-neutral-400">
                    {new Intl.DateTimeFormat("ko-KR", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(analysis.analyzedAt))}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-neutral-600">
                  {analysis.summary}
                </p>

                <div
                  className={`mt-3 rounded-xl px-3.5 py-3 text-xs leading-5 ${
                    analysis.isProductRelevant === true
                      ? "bg-emerald-50 text-emerald-700"
                      : analysis.isProductRelevant === false
                        ? "bg-red-50 text-red-700"
                        : "bg-amber-50 text-amber-800"
                  }`}
                >
                  <strong>
                    {analysis.isProductRelevant === true
                      ? "상세페이지 사용 가능"
                      : analysis.isProductRelevant === false
                        ? "상세페이지 자동 배치 제외"
                        : "이미지 적합성 재분석 필요"}
                  </strong>
                  {analysis.relevanceReason && (
                    <p className="mt-1">{analysis.relevanceReason}</p>
                  )}
                </div>

                {analysis.visibleDetails.length > 0 && (
                  <ul className="mt-3 space-y-1.5 text-xs leading-5 text-neutral-500">
                    {analysis.visibleDetails.map((detail, index) => (
                      <li key={`${analysis.assetId}-detail-${index}`}>
                        · {detail}
                      </li>
                    ))}
                  </ul>
                )}

                {analysis.candidateFacts.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {analysis.candidateFacts.map((fact, index) => (
                      <span
                        key={`${analysis.assetId}-fact-${index}`}
                        className={`rounded-xl px-3 py-2 text-xs ${
                          fact.outcome === "CONFLICTED"
                            ? "bg-red-50 text-red-700"
                            : fact.outcome === "UNMAPPED"
                              ? "bg-violet-50 text-violet-700"
                            : fact.outcome === "PROTECTED"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-800"
                        }`}
                      >
                        <strong>{fact.displayName}</strong> {fact.value} ·{" "}
                        {Math.round(fact.confidence * 100)}% ·{" "}
                        {getOutcomeLabel(fact.outcome)}
                      </span>
                    ))}
                  </div>
                )}

                {analysis.warnings.length > 0 && (
                  <div className="mt-4 rounded-xl bg-neutral-50 px-3.5 py-3 text-xs leading-5 text-neutral-500">
                    {analysis.warnings.slice(0, 3).map((warning, index) => (
                      <p key={`${analysis.assetId}-warning-${index}`}>
                        확인 필요: {warning}
                      </p>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-[10px] text-neutral-300">
                  Model: {analysis.model}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      {reviewFacts.length > 0 && (
        <section className="rounded-3xl border border-amber-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">
                Fact Review
              </p>
              <h2 className="mt-2 text-xl font-bold text-neutral-950">
                AI 후보 Fact 검수
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
                이미지에서 찾은 값은 아직 확정 정보가 아닙니다. 사진 근거를
                확인한 뒤 확정하거나 거절해주세요.
              </p>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
              {reviewFacts.length}개 확인 필요
            </span>
          </div>

          <div className="mt-6 space-y-4">
            {reviewFacts.map((fact) => {
              const reviewValues = getReviewValues(fact);

              return (
                <article
                  key={fact.definitionId}
                  className="rounded-2xl border border-neutral-200 p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-neutral-900">
                        {fact.displayName}
                      </h3>
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold ${getFactStatusStyle(fact.status)}`}
                      >
                        {getFactStatusLabel(fact.status)}
                      </span>
                    </div>
                    {fact.confidence !== null && (
                      <span className="text-xs text-neutral-400">
                        AI 신뢰도 {Math.round(fact.confidence * 100)}%
                      </span>
                    )}
                  </div>

                  {fact.status === "CONFLICTED" ? (
                    <p className="mt-3 text-xs leading-5 text-red-700">
                      기존 값과 새 이미지 관찰값이 다릅니다. 실제 상품 정보와
                      일치하는 값을 선택해주세요.
                    </p>
                  ) : (
                    <p className="mt-3 text-sm font-semibold text-neutral-700">
                      제안 값: {getFactDisplayValue(fact.value)}
                    </p>
                  )}

                  {fact.evidence.length > 0 && (
                    <div className="mt-3 space-y-2 rounded-xl bg-neutral-50 px-3.5 py-3">
                      {fact.evidence.map((evidence, index) => (
                        <div
                          key={`${fact.definitionId}-evidence-${index}`}
                          className="text-xs leading-5 text-neutral-600"
                        >
                          <p>
                            <strong className="text-neutral-800">
                              {evidence.fileName ?? "상품 이미지"}
                            </strong>
                            {evidence.confidence !== null
                              ? ` · ${Math.round(evidence.confidence * 100)}%`
                              : ""}
                          </p>
                          <p className="text-neutral-500">
                            {evidence.observation ??
                              `관찰값: ${getFactDisplayValue(evidence.value)}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {fact.factId && (
                    <form action={reviewFormAction} className="mt-4">
                      <input type="hidden" name="factId" value={fact.factId} />
                      {fact.status === "CONFLICTED" && (
                        <fieldset className="mb-4 grid gap-2 sm:grid-cols-2">
                          <legend className="mb-2 text-xs font-bold text-neutral-700">
                            확정할 값
                          </legend>
                          {reviewValues.map((value, index) => (
                            <label
                              key={`${fact.definitionId}-value-${typeof value}-${String(value)}`}
                              className="flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm text-neutral-700 has-[:checked]:border-violet-400 has-[:checked]:bg-violet-50"
                            >
                              <input
                                type="radio"
                                name="selectedValue"
                                value={JSON.stringify(value)}
                                defaultChecked={index === 0}
                                className="accent-violet-600"
                              />
                              {getFactDisplayValue(value)}
                            </label>
                          ))}
                        </fieldset>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="submit"
                          name="decision"
                          value="reject"
                          disabled={reviewPending}
                          className="rounded-xl border border-neutral-200 px-4 py-3 text-sm font-bold text-neutral-600 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          후보 거절
                        </button>
                        <button
                          type="submit"
                          name="decision"
                          value="confirm"
                          disabled={reviewPending || reviewValues.length === 0}
                          className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
                        >
                          선택 값 확정
                        </button>
                      </div>
                    </form>
                  )}
                </article>
              );
            })}
          </div>
          <ActionMessage state={reviewState} />
        </section>
      )}

      {!selectedCategoryKey ? (
        <section className="rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-14 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl shadow-sm">
            ?
          </div>
          <h2 className="mt-4 text-lg font-bold text-neutral-900">
            카테고리를 먼저 선택해주세요
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            선택하면 해당 상품에 필요한 Fact 질문을 불러옵니다.
          </p>
        </section>
      ) : (
        <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">
                Product Brain
              </p>
              <h2 className="mt-2 text-xl font-bold text-neutral-950">
                상품 Fact 인터뷰
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                사진만으로 확정할 수 없는 정보는 판매자가 직접 알려주세요.
              </p>
            </div>
            <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-600">
              {confirmedFacts.length}/{facts.length} 확정 · {completionRate}%
            </span>
          </div>

          {userFacts.length > 0 ? (
            <form action={factsFormAction} className="mt-7">
              <div className="grid gap-5 sm:grid-cols-2">
                {userFacts.map((fact) => {
                  const importanceLabel = getImportanceLabel(fact.importance);

                  return (
                    <div
                      key={fact.definitionId}
                      className={`rounded-2xl border border-neutral-200 p-4 ${
                        fact.key === "measurements" ? "sm:col-span-2" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <label
                          htmlFor={`fact_${fact.definitionId}`}
                          className="text-sm font-semibold text-neutral-800"
                        >
                          {fact.displayName}
                        </label>
                        {importanceLabel && (
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                              importanceLabel === "필수"
                                ? "bg-red-50 text-red-600"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {importanceLabel}
                          </span>
                        )}
                      </div>
                      {fact.description && (
                        <p className="mt-1 text-xs leading-5 text-neutral-400">
                          {fact.description}
                        </p>
                      )}
                      <FactInput
                        fact={fact}
                        sellingSizeValue={sellingSizeValue}
                      />
                      {fact.status && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${getFactStatusStyle(fact.status)}`}
                          >
                            {getFactStatusLabel(fact.status)}
                          </span>
                          {fact.confidence !== null && (
                            <span className="text-[11px] text-neutral-400">
                              신뢰도 {Math.round(fact.confidence * 100)}%
                            </span>
                          )}
                          {fact.locked && (
                            <span className="text-[11px] font-semibold text-emerald-700">
                              잠금됨
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {missingRequiredBlueprintNames.map((displayName) => (
                  <div
                    key={`missing-blueprint-${displayName}`}
                    className="rounded-2xl border border-dashed border-red-200 bg-red-50/60 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-sm font-semibold text-neutral-800">
                        {displayName}
                      </label>
                      <span className="rounded-full bg-red-100 px-2 py-1 text-[11px] font-semibold text-red-700">
                        필수 · DB 연결 필요
                      </span>
                    </div>
                    {displayName.includes("실측") ? (
                      <textarea
                        disabled
                        rows={4}
                        placeholder="Supabase 패션 Fact 마이그레이션 적용 후 사이즈별 실측 입력창이 활성화됩니다."
                        className="mt-2.5 w-full resize-none rounded-xl border border-red-100 bg-white/70 px-3.5 py-3 text-sm placeholder:text-red-300 disabled:cursor-not-allowed"
                      />
                    ) : (
                      <input
                        disabled
                        placeholder="Supabase 패션 Fact 마이그레이션 적용 후 입력할 수 있습니다."
                        className="mt-2.5 w-full rounded-xl border border-red-100 bg-white/70 px-3.5 py-3 text-sm placeholder:text-red-300 disabled:cursor-not-allowed"
                      />
                    )}
                    <p className="mt-2 text-xs leading-5 text-red-700">
                      임시 값으로 저장하지 않고 Product Brain의 정식 Fact 정의가
                      준비된 뒤 입력받습니다.
                    </p>
                  </div>
                ))}
              </div>

              <ActionMessage state={factsState} />
              <button
                type="submit"
                disabled={factsPending}
                className="mt-6 w-full rounded-2xl bg-violet-600 px-5 py-4 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
              >
                {factsPending
                  ? "Product Brain 저장 중..."
                  : "입력한 Fact 확인 및 저장"}
              </button>
            </form>
          ) : (
            <div className="mt-7 rounded-2xl bg-amber-50 px-5 py-6 text-sm leading-6 text-amber-800">
              {facts.length === 0 ? (
                <>
                  <strong>카테고리 Fact 카탈로그가 아직 비어 있습니다.</strong>
                  <p className="mt-1">
                    AI가 이미지에서 의류 후보 Fact를 도출해 분석 기록에는
                    보존합니다. DB 카탈로그가 연결된 Fact부터 Product Brain 검수와
                    판매자 인터뷰가 활성화됩니다.
                  </p>
                </>
              ) : (
                <p>이 카테고리에 사용자 질문으로 설정된 Fact가 없습니다.</p>
              )}
            </div>
          )}

          {analysisFacts.length > 0 && (
            <div className="mt-7 border-t border-neutral-200 pt-6">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-neutral-400">
                AI / 자료 확인 대상
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {analysisFacts.map((fact) => (
                  <span
                    key={fact.definitionId}
                    className={`rounded-xl border px-3 py-2 text-xs ${
                      fact.status === "CANDIDATE"
                        ? "border-amber-200 bg-amber-50 text-amber-800"
                        : fact.status === "CONFLICTED"
                          ? "border-red-200 bg-red-50 text-red-700"
                        : "border-neutral-200 bg-neutral-50 text-neutral-600"
                    }`}
                  >
                    {fact.displayName}
                    {fact.value !== null && fact.value !== undefined
                      ? `: ${getDefaultValue(fact.value)}`
                      : ""}
                    {fact.status ? ` · ${getFactStatusLabel(fact.status)}` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}

          {confirmedFacts.length > 0 && (
            <div className="mt-7 border-t border-neutral-200 pt-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-neutral-400">
                    Fact Protection
                  </p>
                  <h3 className="mt-1 text-sm font-bold text-neutral-900">
                    확정 Fact 잠금
                  </h3>
                </div>
                <p className="text-xs text-neutral-400">
                  잠그면 사용자와 AI 수정에서 보호됩니다.
                </p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {confirmedFacts.map((fact) => (
                  <form
                    key={fact.definitionId}
                    action={lockFormAction}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 px-4 py-3"
                  >
                    <input type="hidden" name="factId" value={fact.factId ?? ""} />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-neutral-800">
                        {fact.displayName}
                      </p>
                      <p className="mt-1 truncate text-xs text-neutral-500">
                        {getFactDisplayValue(fact.value)}
                        {fact.locked ? " · 잠금됨" : ""}
                      </p>
                    </div>
                    <button
                      type="submit"
                      name="intent"
                      value={fact.locked ? "unlock" : "lock"}
                      disabled={lockPending || !fact.factId}
                      className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        fact.locked
                          ? "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      }`}
                    >
                      {fact.locked ? "잠금 해제" : "잠금"}
                    </button>
                  </form>
                ))}
              </div>
              <ActionMessage state={lockState} />
            </div>
          )}

          <div className="mt-7 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3.5 text-xs leading-5 text-violet-800">
            AI 분석 결과는 CANDIDATE로만 저장되며, 사용자가 검수하기 전에는
            확정 정보로 사용되지 않습니다.
          </div>

          {missingRequiredBlueprintNames.length > 0 && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-xs leading-5 text-red-800">
              <strong>필수 패션 Fact의 DB 카탈로그 연결이 필요합니다.</strong>
              <p className="mt-1">
                누락: {missingRequiredBlueprintNames.join(", ")}. 제공된 Supabase
                마이그레이션을 적용하기 전에는 판매전략 생성을 열지 않습니다.
              </p>
            </div>
          )}

          <div className="mt-7 rounded-3xl border border-neutral-200 bg-neutral-950 p-5 text-white sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300">
                  Strategy Readiness
                </p>
                <h3 className="mt-2 text-lg font-bold">
                  {readyForStrategy
                    ? "Product Brain이 준비됐어요"
                    : "판매전략 전에 확인이 필요해요"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-neutral-300">
                  확정 {confirmedFacts.length}개 · 필수 미입력 {requiredIssueCount}개 ·
                  후보 미검수 {reviewFacts.length}개
                </p>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-neutral-200">
                완성도 {completionRate}%
              </span>
            </div>

            {requiredIssueCount > 0 && (
              <p className="mt-4 rounded-xl bg-white/10 px-3.5 py-3 text-xs leading-5 text-neutral-200">
                필수 확인: {[
                  ...missingRequiredFacts.map((fact) => fact.displayName),
                  ...missingRequiredBlueprintNames,
                ].join(", ")}
              </p>
            )}

            {readyForStrategy ? (
              <Link
                href={`/projects/${projectId}/strategies`}
                className="mt-5 block rounded-2xl bg-white px-5 py-4 text-center text-sm font-bold text-neutral-950 transition hover:bg-violet-100"
              >
                Product Brain 완료 · 판매전략으로
              </Link>
            ) : (
              <div className="mt-5 rounded-2xl bg-neutral-700 px-5 py-4 text-center text-sm font-bold text-neutral-300">
                필수 Fact와 AI 후보 검수를 완료해주세요
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
