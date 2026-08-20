"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { StoredStrategy } from "@/lib/strategy";
import { selectStrategy, type StrategyActionState } from "./actions";
import { generateFlexibleStrategies } from "./flexible-actions";

type StrategyView = {
  id: string;
  name: string;
  selected: boolean;
  detail: StoredStrategy;
};

const initialState: StrategyActionState = { status: "idle" };

const archetypeLabel: Record<string, string> = {
  LIFESTYLE: "사용 장면 중심",
  FUNCTIONAL: "기능 중심",
  PRACTICAL: "실용 중심",
  VALUE: "선택 가치 중심",
  PREMIUM: "프리미엄",
  PROBLEM_SOLUTION: "문제 해결 중심",
  GIFTING: "선물 중심",
  TRUST: "신뢰 중심",
};

function Message({ state }: { state: StrategyActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <p className={`mt-4 rounded-xl px-4 py-3 text-sm ${state.status === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
      {state.message}
    </p>
  );
}

export function SimpleStrategyActions({
  projectId,
  configured,
  strategies,
  selectedStrategyId,
}: {
  projectId: string;
  configured: boolean;
  strategies: StrategyView[];
  selectedStrategyId: string | null;
}) {
  const generateAction = generateFlexibleStrategies.bind(null, projectId);
  const selectAction = selectStrategy.bind(null, projectId);
  const [generationState, generationFormAction, generationPending] =
    useActionState(generateAction, initialState);
  const [selectionState, selectionFormAction, selectionPending] =
    useActionState(selectAction, initialState);
  const research = strategies[0]?.detail.marketResearch ?? null;

  return (
    <div className="space-y-7">
      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-bold text-neutral-950">
          AI가 판매 방향을 3가지로 제안할게요
        </h2>
        <p className="mt-2 text-sm leading-6 text-neutral-500">
          지금 확인된 정보만 사용합니다. 모르는 상품 정보가 있어도 생성은 멈추지 않습니다.
        </p>
        <form action={generationFormAction} className="mt-5">
          <label className="flex items-start gap-3 rounded-2xl bg-neutral-50 px-4 py-3 text-xs leading-5 text-neutral-600">
            <input
              type="checkbox"
              name="externalGenerationConsent"
              value="accepted"
              required
              className="mt-0.5 h-4 w-4 accent-violet-600"
            />
            판매 방향을 만들기 위해 상품 기본정보와 확인된 정보를 AI 분석 서비스에 전송하는 데 동의합니다.
          </label>
          <button
            type="submit"
            disabled={generationPending || !configured}
            className="mt-3 w-full rounded-2xl bg-neutral-950 px-5 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:bg-neutral-300"
          >
            {generationPending
              ? "판매 방향을 만드는 중..."
              : strategies.length > 0
                ? "판매 방향 다시 제안받기"
                : "판매 방향 3개 제안받기"}
          </button>
        </form>
        {!configured && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            현재 AI 생성 설정이 필요합니다.
          </p>
        )}
        <Message state={generationState} />
      </section>

      {strategies.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold text-neutral-950">
            어떤 느낌으로 판매할까요?
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            가장 마음에 드는 방향 하나만 선택하면 됩니다.
          </p>
          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            {strategies.map((strategy) => {
              const selected = strategy.id === selectedStrategyId;
              return (
                <article
                  key={strategy.id}
                  className={`flex flex-col rounded-3xl border bg-white p-6 shadow-sm ${selected ? "border-violet-500 ring-4 ring-violet-100" : "border-neutral-200"}`}
                >
                  <span className="text-xs font-bold text-violet-600">
                    {archetypeLabel[strategy.detail.archetype] ?? "추천 방향"}
                  </span>
                  <h3 className="mt-3 text-xl font-bold text-neutral-950">
                    {strategy.name}
                  </h3>
                  <p className="mt-2 text-sm font-semibold text-violet-700">
                    {strategy.detail.oneLiner}
                  </p>
                  <p className="mt-4 text-sm leading-6 text-neutral-500">
                    {strategy.detail.positioning}
                  </p>
                  <div className="mt-5 space-y-3">
                    {strategy.detail.benefits.map((benefit, index) => (
                      <div key={`${strategy.id}-${index}`} className="rounded-2xl bg-neutral-50 p-4">
                        <p className="text-sm font-bold text-neutral-800">
                          {benefit.title}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-neutral-500">
                          {benefit.description}
                        </p>
                      </div>
                    ))}
                  </div>
                  <form action={selectionFormAction} className="mt-auto pt-5">
                    <input type="hidden" name="strategyId" value={strategy.id} />
                    <button
                      type="submit"
                      disabled={selectionPending || selected}
                      className={`w-full rounded-xl px-4 py-3 text-sm font-bold ${selected ? "bg-violet-100 text-violet-700" : "bg-violet-600 text-white hover:bg-violet-700"}`}
                    >
                      {selected ? "이 방향으로 선택됨" : "이 방향으로 만들기"}
                    </button>
                  </form>
                </article>
              );
            })}
          </div>
          <Message state={selectionState} />
        </section>
      )}

      {research && (
        <details className="rounded-2xl border border-neutral-200 bg-white">
          <summary className="cursor-pointer list-none px-5 py-4 text-sm font-bold text-neutral-600">
            AI가 참고한 시장·리뷰 정보 보기
          </summary>
          <div className="border-t border-neutral-200 p-5 text-xs leading-5 text-neutral-500">
            <p>{research.caveat}</p>
            <p className="mt-3 whitespace-pre-wrap">{research.summary}</p>
          </div>
        </details>
      )}

      {selectedStrategyId && (
        <section className="rounded-3xl bg-neutral-950 p-6 text-white sm:flex sm:items-center sm:justify-between sm:gap-5 sm:p-8">
          <div>
            <h2 className="text-xl font-bold">선택한 방향으로 페이지를 만들까요?</h2>
            <p className="mt-2 text-sm text-neutral-400">
              AI가 카피와 레이아웃을 조합해 상세페이지 초안을 만듭니다.
            </p>
          </div>
          <Link
            href={`/projects/${projectId}/planner`}
            className="mt-5 block shrink-0 rounded-2xl bg-white px-5 py-4 text-center text-sm font-bold text-neutral-950 sm:mt-0"
          >
            상세페이지 초안 만들기 →
          </Link>
        </section>
      )}
    </div>
  );
}
