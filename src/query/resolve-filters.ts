import { inferFilters } from "./filter-model.js";
import type { CliFilterOverrides, QueryFilter, ResolvedQuery } from "./types.js";

// FR-2.2: explicit CLI flags always override inference. Only `type` has a
// CLI override (per FR-4.1's `ask` signature); dateRange/book are
// inference-only, and `language` is CLI-only (never inferred).
export async function resolveQueryFilters(
  question: string,
  overrides: CliFilterOverrides = {},
  signal?: AbortSignal,
): Promise<ResolvedQuery> {
  const inferred = await inferFilters(question, signal);

  const filter: QueryFilter = {
    type: overrides.type ?? inferred.type,
    language: overrides.language,
    dateRange: inferred.dateRange,
    book: inferred.book,
  };

  return { filter, isExistenceQuery: inferred.isExistenceQuery, inferred };
}
