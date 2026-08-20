"use client";

import { useRef, useState } from "react";

import { GarmentMeasurementDiagram } from "@/components/garment-measurement-diagram";
import {
  MAX_MEASUREMENT_SIZE_ROWS,
  measurementTemplates,
  parseMeasurementFact,
  parseSellingSizes,
  serializeMeasurementFact,
  type MeasurementFieldKey,
  type MeasurementRow,
  type MeasurementTemplateKey,
} from "@/lib/product-measurements";

type EditorRow = MeasurementRow & { id: number };

function buildInitialState(value: string, sellingSizeValue: unknown) {
  const parsed = parseMeasurementFact(value);
  const sellingSizes = parseSellingSizes(sellingSizeValue);
  const template = parsed?.template ?? "TOP";
  const parsedRows = parsed?.rows ?? [];
  const existingSizes = new Set(
    parsedRows.map((row) => row.size.toLocaleLowerCase())
  );
  const rows = [
    ...parsedRows,
    ...sellingSizes
      .filter((size) => !existingSizes.has(size.toLocaleLowerCase()))
      .map((size) => ({ size, values: {} })),
  ];

  return {
    template,
    rows: (rows.length > 0 ? rows : [{ size: "", values: {} }]).map(
      (row, index) => ({ ...row, id: index })
    ),
  } as { template: MeasurementTemplateKey; rows: EditorRow[] };
}

export function ProductMeasurementInput({
  inputId,
  value,
  sellingSizeValue,
  disabled,
}: {
  inputId: string;
  value: string;
  sellingSizeValue: unknown;
  disabled: boolean;
}) {
  const initialState = buildInitialState(value, sellingSizeValue);
  const [template, setTemplate] = useState<MeasurementTemplateKey>(
    initialState.template
  );
  const [rows, setRows] = useState<EditorRow[]>(initialState.rows);
  const nextRowId = useRef(initialState.rows.length);
  const fields = measurementTemplates[template].fields;
  const serializedValue = serializeMeasurementFact(template, rows);

  const updateRow = (
    id: number,
    patch:
      | { size: string }
      | { field: MeasurementFieldKey; value: string }
  ) => {
    setRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== id) {
          return row;
        }

        if ("size" in patch) {
          return { ...row, size: patch.size };
        }

        return {
          ...row,
          values: { ...row.values, [patch.field]: patch.value },
        };
      })
    );
  };

  const changeTemplate = (nextTemplate: MeasurementTemplateKey) => {
    setTemplate(nextTemplate);
    setRows((currentRows) =>
      currentRows.map((row) => ({ ...row, values: {} }))
    );
  };

  return (
    <div className="mt-4">
      <input
        type="hidden"
        name={inputId}
        value={serializedValue}
        disabled={disabled}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        <div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="block text-xs font-semibold text-neutral-600">
              의류 구분
              <select
                value={template}
                disabled={disabled}
                onChange={(event) =>
                  changeTemplate(event.target.value as MeasurementTemplateKey)
                }
                className="mt-1.5 block rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100 disabled:bg-neutral-100"
              >
                <option value="TOP">상의·아우터</option>
                <option value="BOTTOM">하의</option>
              </select>
            </label>
            <span className="text-xs font-medium text-neutral-400">단위 cm · 단면 기준</span>
          </div>

          <div className="mt-4 space-y-3">
            {rows.map((row, rowIndex) => (
              <fieldset
                key={row.id}
                className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3"
              >
                <legend className="px-1 text-[11px] font-bold text-neutral-500">
                  사이즈 {rowIndex + 1}
                </legend>
                <div
                  className={`grid gap-3 sm:grid-cols-2 ${
                    template === "TOP" ? "lg:grid-cols-5" : "lg:grid-cols-7"
                  }`}
                >
                  <label className="text-[11px] font-semibold text-neutral-500">
                    사이즈명
                    <input
                      id={rowIndex === 0 ? inputId : undefined}
                      type="text"
                      value={row.size}
                      required={!disabled}
                      disabled={disabled}
                      maxLength={20}
                      placeholder="예: S"
                      onChange={(event) =>
                        updateRow(row.id, { size: event.target.value })
                      }
                      className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm font-semibold text-neutral-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100 disabled:bg-neutral-100"
                    />
                  </label>
                  {fields.map((field) => (
                    <label key={field.key} className="text-[11px] font-semibold text-neutral-500">
                      {field.label}
                      <span className="ml-1 font-normal text-neutral-400">cm</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        min="0.1"
                        value={row.values[field.key] ?? ""}
                        required={!disabled}
                        disabled={disabled}
                        placeholder="0"
                        aria-label={`${row.size || `사이즈 ${rowIndex + 1}`} ${field.label}`}
                        onChange={(event) =>
                          updateRow(row.id, {
                            field: field.key,
                            value: event.target.value,
                          })
                        }
                        className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100 disabled:bg-neutral-100"
                      />
                    </label>
                  ))}
                </div>
                {rows.length > 1 && !disabled && (
                  <button
                    type="button"
                    onClick={() =>
                      setRows((currentRows) =>
                        currentRows.filter((item) => item.id !== row.id)
                      )
                    }
                    className="mt-3 text-xs font-semibold text-neutral-400 hover:text-red-600"
                  >
                    이 사이즈 삭제
                  </button>
                )}
              </fieldset>
            ))}
          </div>

          <button
            type="button"
            disabled={disabled || rows.length >= MAX_MEASUREMENT_SIZE_ROWS}
            onClick={() => {
              const id = nextRowId.current;
              nextRowId.current += 1;
              setRows((currentRows) => [
                ...currentRows,
                { id, size: "", values: {} },
              ]);
            }}
            className="mt-3 inline-flex items-center rounded-lg border border-neutral-300 px-3.5 py-2 text-xs font-bold text-neutral-700 transition hover:border-violet-400 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            + 사이즈 행 추가
          </button>
        </div>

        <aside className="rounded-2xl border border-neutral-200 bg-[#f7f5ef] p-4">
          <p className="text-xs font-bold text-neutral-800">어디를 재나요?</p>
          <GarmentMeasurementDiagram template={template} className="mt-3" />
        </aside>
      </div>

      <p className="mt-4 text-xs leading-5 text-violet-700">
        판매하는 모든 사이즈의 치수를 빠짐없이 입력해주세요. 저장 시 Product Brain의
        실측 Fact로 보호되고 상세페이지 표로 자동 변환됩니다.
      </p>
    </div>
  );
}
