"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { StoredStrategy } from "@/lib/strategy";

import {
  generateStrategies,
  selectStrategy,
  type StrategyActionState,
} from "./actions";

type StrategyView = {
  id: string;
  archetype: string;
  name: string;
  selected: boolean;
  detail: StoredStrategy;
};

type StrategyActionsProps = {
  projectId: string;
  openAIConfigured: boolean;
  strategies: StrategyView[];
  selectedStrategyId: string | null;
};

const initialState: StrategyActionState = { status: "idle" };

function ActionMessage({ state }: { state: StrategyActionState }) {
  if (state.status === "idle" || !state.message) {
    return null;
  }

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

export function StrategyActions({
  projectId,
  openAIConfigured,
  strategies,
  selectedStrategyId,
}: StrategyActionsProps) {
  const generateAction = generateStrategies.bind(null, projectId);
  const selectAction = selectStrategy.bind(null, projectId);
  const [generationState, generationFormAction, generationPending] =
    useActionState(generateAction, initialState);
  const [selectionState, selectionFormAction, selectionPending] =
    useActionState(selectAction, initialState);
  const marketResearch = strategies[0]?.detail.marketResearch ?? null;

  return (
    <div className="mt-7 space-y-7">
      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">
              Strategy Engine
            </p>
            <h2 className="mt-2 text-xl font-bold text-neutral-950">
              시장·리뷰 분석 후 판매전략 3개 생성
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
              상위 노출 상품과 상세페이지 구조, 공개 리뷰의 만족·불만을 먼저
              조사한 뒤 상품 사실과 결합해 구매 동기를 설계합니다.
            </p>
          </div>
          {strategies.length > 0 && (
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
              {strategies.length}개 생성됨
            </span>
          )}
        </div>

        {!openAIConfigured && (
          <p className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            서버에 OPENAI_API_KEY가 설정되지 않았습니다.
          </p>
        )}

        <form action={generationFormAction} className="mt-5">
          <label className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3.5 text-xs leading-5 text-neutral-600">
            <input
              type="checkbox"
              name="externalGenerationConsent"
              value="accepted"
              required
              className="mt-0.5 h-4 w-4 shrink-0 accent-violet-600"
            />
            <span>
              시장·리뷰 조사와 판매전략 생성을 위해 비식별 제품군을 공개 웹
              검색에 사용하고, 상품명·설명·가격과 확정 상품 정보가 OpenAI API로
              전송되는 것에 동의합니다. 검수 전 후보와 거절 정보는 전송하지
              않습니다.
            </span>
          </label>
          <button
            type="submit"
            disabled={generationPending || !openAIConfigured}
            className="mt-4 w-full rounded-2xl bg-neutral-950 px-5 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {generationPending
              ? "시장·리뷰를 조사하고 전략을 설계하는 중..."
              : strategies.length > 0
                ? "시장·리뷰 분석부터 다시 생성"
                : "시장·리뷰 분석 후 전략 생성"}
          </button>
          {strategies.length > 0 && (
            <p className="mt-2 text-xs text-amber-700">
              다시 생성하면 현재 전략 선택과 기존 PageDocument가 초기화됩니다.
            </p>
          )}
          <ActionMessage state={generationState} />
        </form>
      </section>

      {marketResearch && (
        <section className="rounded-3xl border border-neutral-200 bg-neutral-950 p-6 text-white shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300">
                Market & VOC Research
              </p>
              <h2 className="mt-2 text-xl font-bold">
                전략에 반영한 시장·고객 인사이트
              </h2>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-300">
              출처 {marketResearch.sources.length}개
            </span>
          </div>
          <p className="mt-4 rounded-2xl bg-amber-300/10 px-4 py-3 text-xs leading-5 text-amber-100">
            {marketResearch.caveat}
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {(
              [
                ["상위 노출·인기 신호", marketResearch.popularitySignals],
                ["리뷰 반복 만족", marketResearch.reviewSatisfactions],
                ["리뷰 반복 불만", marketResearch.reviewComplaints],
                ["상세페이지 공통 패턴", marketResearch.detailPagePatterns],
                ["판매전략 기회", marketResearch.strategyOpportunities],
              ] as const
            ).map(([title, items]) => (
              <article
                key={title}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
              >
                <h3 className="text-sm font-bold text-white">{title}</h3>
                {items.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-xs leading-5 text-neutral-300">
                    {items.map((item, index) => (
                      <li key={`${title}-${index}`} className="flex gap-2">
                        <span className="text-violet-300">{index + 1}.</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-neutral-500">
                    공개 자료에서 반복 근거를 찾지 못했습니다.
                  </p>
                )}
              </article>
            ))}
          </div>
          <details className="mt-5 rounded-2xl border border-white/10 bg-black/20">
            <summary className="cursor-pointer px-4 py-3 text-xs font-bold text-neutral-200">
              조사 보고서와 출처 보기
            </summary>
            <div className="border-t border-white/10 p-4">
              <p className="max-h-72 overflow-auto whitespace-pre-wrap text-xs leading-6 text-neutral-400">
                {marketResearch.summary}
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {marketResearch.sources.map((source, index) => (
                  <a
                    key={`${source.url}-${index}`}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-violet-200 hover:border-violet-300"
                  >
                    {index + 1}. {source.title}
                  </a>
                ))}
              </div>
            </div>
          </details>
        </section>
      )}

      {strategies.length > 0 && (
        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">
                Generated Strategies
              </p>
              <h2 className="mt-2 text-2xl font-bold text-neutral-950">
                마음에 드는 판매 방향을 선택하세요
              </h2>
            </div>
            <p className="text-xs text-neutral-400">
              전략 선택 후 Page Planner로 이동합니다.
            </p>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            {strategies.map((strategy, index) => {
              const selected = strategy.id === selectedStrategyId;

              return (
                <article
                  key={strategy.id}
                  className={`flex flex-col rounded-3xl border bg-white p-6 shadow-sm transition ${
                    selected
                      ? "border-violet-500 ring-4 ring-violet-100"
                      : "border-neutral-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-violet-600">
                      STRATEGY {index + 1} · {strategy.archetype}
                    </span>
                    {selected && (
                      <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">
                        선택됨
                      </span>
                    )}
                  </div>
                  <h3 className="mt-4 text-xl font-bold text-neutral-950">
                    {strategy.name}
                  </h3>
                  <p className="mt-2 text-sm font-semibold text-violet-700">
                    {strategy.detail.oneLiner}
                  </p>
                  <p className="mt-4 text-sm leading-6 text-neutral-500">
                    {strategy.detail.positioning}
                  </p>

                  <div className="mt-5 rounded-2xl bg-neutral-50 p-4">
                    <p className="text-xs font-bold text-neutral-800">핵심 고객</p>
                    <p className="mt-2 text-xs leading-5 text-neutral-600">
                      {strategy.detail.targetCustomer}
                    </p>
                  </div>

                  <div className="mt-5 space-y-3">
                    {strategy.detail.benefits.map((benefit, benefitIndex) => (
                      <div key={`${strategy.id}-benefit-${benefitIndex}`}>
                        <p className="text-sm font-bold text-neutral-800">
                          {benefit.title}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-neutral-500">
                          {benefit.description}
                        </p>
                      </div>
                    ))}
                  </div>

                  <form action={selectionFormAction} className="mt-auto pt-6">
                    <input type="hidden" name="strategyId" value={strategy.id} />
                    <button
                      type="submit"
                      disabled={selectionPending || selected}
                      className={`w-full rounded-xl px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed ${
                        selected
                          ? "bg-violet-100 text-violet-700"
                          : "bg-violet-600 text-white hover:bg-violet-700 disabled:bg-neutral-300"
                      }`}
                    >
                      {selected ? "선택한 전략" : "이 전략 선택"}
                    </button>
                  </form>
                </article>
              );
            })}
          </div>
          <ActionMessage state={selectionState} />
        </section>
      )}

      {selectedStrategyId && (
        <section className="rounded-3xl bg-neutral-950 p-6 text-white sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300">
              Next Step
            </p>
            <h2 className="mt-2 text-xl font-bold">
              선택한 전략으로 상세페이지를 설계합니다
            </h2>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Page Planner가 전환 역할과 블록을 조합해 PageDocument JSON을 만듭니다.
            </p>
          </div>
          <Link
            href={`/projects/${projectId}/planner`}
            className="mt-5 block shrink-0 rounded-2xl bg-white px-5 py-4 text-center text-sm font-bold text-neutral-950 transition hover:bg-violet-100 sm:mt-0"
          >
            Page Planner로 이동
          </Link>
        </section>
      )}
    </div>
  );
}
