export type MeasurementTemplateKey = "TOP" | "BOTTOM";

export const MAX_MEASUREMENT_SIZE_ROWS = 10;

export type MeasurementFieldKey =
  | "shoulder"
  | "chest"
  | "sleeve"
  | "totalLength"
  | "waist"
  | "hip"
  | "thigh"
  | "rise"
  | "inseam"
  | "hem";

export type MeasurementFieldDefinition = {
  key: MeasurementFieldKey;
  label: string;
  description: string;
};

export const measurementTemplates: Record<
  MeasurementTemplateKey,
  {
    label: string;
    fields: MeasurementFieldDefinition[];
  }
> = {
  TOP: {
    label: "상의·아우터",
    fields: [
      { key: "shoulder", label: "어깨", description: "좌우 어깨 봉제선 사이" },
      { key: "chest", label: "가슴", description: "겨드랑이 아래 지점의 단면" },
      { key: "sleeve", label: "소매", description: "어깨 봉제선부터 소매 끝" },
      { key: "totalLength", label: "총장", description: "뒷목 중심부터 밑단" },
    ],
  },
  BOTTOM: {
    label: "하의",
    fields: [
      { key: "waist", label: "허리", description: "허리선의 단면" },
      { key: "hip", label: "엉덩이", description: "엉덩이의 가장 넓은 지점" },
      { key: "thigh", label: "허벅지", description: "가랑이 아래 지점의 단면" },
      { key: "rise", label: "밑위", description: "허리선부터 가랑이 봉제선" },
      { key: "inseam", label: "인심", description: "가랑이 봉제선부터 안쪽 밑단" },
      { key: "hem", label: "밑단", description: "밑단 끝의 단면" },
    ],
  },
};

export type MeasurementRow = {
  size: string;
  values: Partial<Record<MeasurementFieldKey, string>>;
};

export type ParsedMeasurementFact = {
  template: MeasurementTemplateKey;
  rows: MeasurementRow[];
};

const fieldByLabel = new Map(
  Object.values(measurementTemplates).flatMap((template) =>
    template.fields.map((field) => [field.label, field] as const)
  )
);

function getTemplateForFields(fields: MeasurementFieldDefinition[]) {
  const bottomKeys = new Set(
    measurementTemplates.BOTTOM.fields.map((field) => field.key)
  );
  return fields.some((field) => bottomKeys.has(field.key)) ? "BOTTOM" : "TOP";
}

export function parseMeasurementFact(value: string): ParsedMeasurementFact | null {
  const rawRows = value
    .split(/\s*(?:\||\n)\s*/)
    .map((row) => row.trim())
    .filter(Boolean);

  if (rawRows.length === 0) {
    return null;
  }

  const parsedRows: Array<{
    size: string;
    cells: Array<{ field: MeasurementFieldDefinition; value: string }>;
  }> = [];
  const observedFields: MeasurementFieldDefinition[] = [];

  for (const rawRow of rawRows) {
    const rowMatch = rawRow.match(/^([^:：]+)[:：]\s*(.+)$/);
    if (!rowMatch) {
      return null;
    }

    const cells = rowMatch[2]
      .split(/\s*(?:\/|,|·)\s*/)
      .map((cell) => cell.trim())
      .filter(Boolean)
      .map((cell) => {
        const cellMatch = cell.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*(?:cm)?$/i);
        if (!cellMatch) {
          return null;
        }

        const field = fieldByLabel.get(cellMatch[1].trim());
        if (!field) {
          return null;
        }

        if (!observedFields.some((item) => item.key === field.key)) {
          observedFields.push(field);
        }

        return { field, value: cellMatch[2] };
      });

    if (cells.some((cell) => cell === null)) {
      return null;
    }

    parsedRows.push({
      size: rowMatch[1].trim(),
      cells: cells as Array<{
        field: MeasurementFieldDefinition;
        value: string;
      }>,
    });
  }

  const template = getTemplateForFields(observedFields);
  const allowedKeys = new Set(
    measurementTemplates[template].fields.map((field) => field.key)
  );

  if (
    parsedRows.some((row) =>
      row.cells.some((cell) => !allowedKeys.has(cell.field.key))
    )
  ) {
    return null;
  }

  return {
    template,
    rows: parsedRows.map((row) => ({
      size: row.size,
      values: Object.fromEntries(
        row.cells.map((cell) => [cell.field.key, cell.value])
      ) as Partial<Record<MeasurementFieldKey, string>>,
    })),
  };
}

export function serializeMeasurementFact(
  template: MeasurementTemplateKey,
  rows: MeasurementRow[]
) {
  const fields = measurementTemplates[template].fields;

  return rows
    .map((row) =>
      [
        `${row.size.trim()}:`,
        fields
          .map((field) => `${field.label} ${row.values[field.key]?.trim() ?? ""}cm`)
          .join(" / "),
      ].join(" ")
    )
    .join(" | ");
}

export function parseSellingSizes(value: unknown) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(/\s*(?:,|\||\n)\s*|\s+\/\s+/)
    .map((size) => size.trim())
    .filter(Boolean);
}

export function validateMeasurementFact(value: string) {
  const parsed = parseMeasurementFact(value);
  if (!parsed) {
    return "사이즈별 치수를 입력 형식에 맞게 모두 작성해주세요.";
  }

  if (parsed.rows.length > MAX_MEASUREMENT_SIZE_ROWS) {
    return `사이즈는 최대 ${MAX_MEASUREMENT_SIZE_ROWS}개까지 입력할 수 있습니다.`;
  }

  const sizeNames = parsed.rows.map((row) => row.size.trim());
  if (sizeNames.some((size) => !size || size.length > 20)) {
    return "각 행의 사이즈명을 20자 이내로 입력해주세요.";
  }
  if (new Set(sizeNames.map((size) => size.toLocaleLowerCase())).size !== sizeNames.length) {
    return "같은 사이즈가 중복되어 있습니다.";
  }

  const fields = measurementTemplates[parsed.template].fields;
  const hasIncompleteRow = parsed.rows.some((row) =>
    fields.some((field) => {
      const valueText = row.values[field.key];
      return !valueText || Number(valueText) <= 0;
    })
  );

  if (hasIncompleteRow) {
    return `${measurementTemplates[parsed.template].label}의 ${fields
      .map((field) => field.label)
      .join("·")} 치수를 모든 사이즈에 입력해주세요.`;
  }

  return null;
}
