import type { DocumentType } from "../ingest/types.js";
import type { InferredFilter } from "./filter-model.js";

// The filter actually applied to a query: LLM inference (filter-model.ts)
// merged with any explicit CLI overrides (FR-4.1's --type/--language), which
// always win. `language` has no LLM-inference path — FR-2.2's inferred
// schema is {type?, dateRange?, book?} only — so it's CLI-only.
export interface QueryFilter {
  type?: DocumentType;
  language?: string;
  dateRange?: { start?: string; end?: string };
  book?: string;
}

export interface CliFilterOverrides {
  type?: DocumentType;
  language?: string;
}

export interface ResolvedQuery {
  filter: QueryFilter;
  isExistenceQuery: boolean;
  // Raw model output, unmerged with CLI overrides — logged to the
  // LangSmith trace per FR-2.2 ("the inferred filter is logged in every
  // LangSmith trace") so the override is visible separately from inference.
  inferred: InferredFilter;
}
