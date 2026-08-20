import type { SupabaseClient } from "@supabase/supabase-js";

import { getFashionFactBlueprints } from "@/lib/fashion-facts";

type CategoryNode = {
  key: string;
  parent_key: string | null;
};

type CategoryFactRow = {
  category_key: string;
  fact_definition_id: string;
};

export type CatalogFactDefinition = {
  id: string;
  key: string;
  display_name: string;
  value_type: string;
  description: string | null;
  validation_rules: unknown;
};

export type ResolvedCategoryFact = CategoryFactRow & {
  ask_user: boolean;
  importance: string | null;
  fact_definitions: CatalogFactDefinition | CatalogFactDefinition[] | null;
  catalog_source: "DATABASE_MAPPING" | "APPLICATION_FALLBACK";
};

export function resolveCategoryLineageKeys(
  categories: CategoryNode[],
  categoryKey: string
) {
  const categoryByKey = new Map(
    categories.map((category) => [category.key, category])
  );
  const lineage: string[] = [];
  const seen = new Set<string>();
  let currentKey: string | null = categoryKey;

  while (currentKey && !seen.has(currentKey)) {
    lineage.push(currentKey);
    seen.add(currentKey);
    currentKey = categoryByKey.get(currentKey)?.parent_key ?? null;
  }

  return lineage;
}

export async function loadCategoryLineageKeys(
  supabase: SupabaseClient,
  categoryKey: string
) {
  const { data, error } = await supabase
    .from("categories")
    .select("key, parent_key");

  if (error) {
    throw error;
  }

  return resolveCategoryLineageKeys(
    (data ?? []) as CategoryNode[],
    categoryKey
  );
}

export function mergeInheritedCategoryFacts<T extends CategoryFactRow>(
  rows: T[],
  lineageKeys: string[]
) {
  const priority = new Map(
    lineageKeys.map((categoryKey, index) => [categoryKey, index])
  );
  const sortedRows = [...rows].sort(
    (left, right) =>
      (priority.get(left.category_key) ?? Number.MAX_SAFE_INTEGER) -
      (priority.get(right.category_key) ?? Number.MAX_SAFE_INTEGER)
  );
  const factByDefinition = new Map<string, T>();

  sortedRows.forEach((row) => {
    if (!factByDefinition.has(row.fact_definition_id)) {
      factByDefinition.set(row.fact_definition_id, row);
    }
  });

  return [...factByDefinition.values()];
}

export async function loadResolvedCategoryFacts(
  supabase: SupabaseClient,
  categoryLineageKeys: string[]
) {
  const { data: mappedRows, error: mappedRowsError } = await supabase
    .from("category_fact_definitions")
    .select(`
      category_key,
      fact_definition_id,
      ask_user,
      importance,
      fact_definitions (
        id,
        key,
        display_name,
        value_type,
        description,
        validation_rules
      )
    `)
    .in("category_key", categoryLineageKeys);

  if (mappedRowsError) {
    throw mappedRowsError;
  }

  const resolvedMappedRows = mergeInheritedCategoryFacts(
    ((mappedRows ?? []) as Omit<ResolvedCategoryFact, "catalog_source">[]).map(
      (row) => ({ ...row, catalog_source: "DATABASE_MAPPING" as const })
    ),
    categoryLineageKeys
  );
  const blueprints = getFashionFactBlueprints(categoryLineageKeys);

  if (blueprints.length === 0) {
    return {
      facts: resolvedMappedRows,
      missingBlueprints: [],
    };
  }

  // 패션 Fact의 앱 정책은 DB 마이그레이션 적용 전에도 동일하게 동작해야 한다.
  // 특히 실측 사이즈처럼 구매 판단에 필수인 항목이 과거 DB 값(RECOMMENDED)에
  // 머물러 전략 생성 게이트를 우회하지 않도록 현재 Blueprint를 우선한다.
  const blueprintByKey = new Map(
    blueprints.map((blueprint) => [blueprint.key, blueprint])
  );
  const effectiveMappedRows = resolvedMappedRows.map((row) => {
    const relation = row.fact_definitions;
    const definition = Array.isArray(relation) ? relation[0] : relation;
    const blueprint = definition
      ? blueprintByKey.get(definition.key)
      : undefined;

    return blueprint
      ? {
          ...row,
          ask_user: blueprint.askUser,
          importance: blueprint.importance,
        }
      : row;
  });

  const mappedKeys = new Set(
    effectiveMappedRows.flatMap((row) => {
      const relation = row.fact_definitions;
      const definition = Array.isArray(relation) ? relation[0] : relation;
      return definition ? [definition.key] : [];
    })
  );
  const fallbackBlueprints = blueprints.filter(
    (blueprint) => !mappedKeys.has(blueprint.key)
  );

  if (fallbackBlueprints.length === 0) {
    return {
      facts: effectiveMappedRows,
      missingBlueprints: [],
    };
  }

  const { data: fallbackDefinitions, error: fallbackDefinitionsError } =
    await supabase
      .from("fact_definitions")
      .select(
        "id, key, display_name, value_type, description, validation_rules"
      )
      .in(
        "key",
        fallbackBlueprints.map((blueprint) => blueprint.key)
      );

  if (fallbackDefinitionsError) {
    throw fallbackDefinitionsError;
  }

  const definitionByKey = new Map(
    ((fallbackDefinitions ?? []) as CatalogFactDefinition[]).map(
      (definition) => [definition.key, definition]
    )
  );
  const fallbackRows = fallbackBlueprints.reduce<ResolvedCategoryFact[]>(
    (rows, blueprint) => {
      const definition = definitionByKey.get(blueprint.key);
      if (!definition) {
        return rows;
      }

      rows.push({
        category_key: blueprint.categoryKey,
        fact_definition_id: definition.id,
        ask_user: blueprint.askUser,
        importance: blueprint.importance,
        fact_definitions: definition,
        catalog_source: "APPLICATION_FALLBACK",
      });
      return rows;
    },
    []
  );
  const foundFallbackKeys = new Set(
    fallbackRows.flatMap((row) => {
      const relation = row.fact_definitions;
      const definition = Array.isArray(relation) ? relation[0] : relation;
      return definition ? [definition.key] : [];
    })
  );

  return {
    facts: [...effectiveMappedRows, ...fallbackRows],
    missingBlueprints: fallbackBlueprints.filter(
      (blueprint) => !foundFallbackKeys.has(blueprint.key)
    ),
  };
}
