import { inferFilters } from "./filter-model.js";
import { condenseFollowUp } from "./condense-question.js";
import type { CliFilterOverrides, ConversationTurn, QueryFilter, ResolvedQuery } from "./types.js";

// FR-2.2: explicit CLI flags always override inference. Only `type` has a
// CLI override (per FR-4.1's `ask` signature); dateRange/book are
// inference-only, and `language` is CLI-only (never inferred).
//
// Ticket #21: `history` makes this step (and only this step) conversation-
// aware — condense the follow-up against `history` into a standalone
// question first, then run the existing single-turn filter inference
// against that rewrite. `history` defaults to `[]`, which condenseFollowUp
// treats as "no history yet" and returns `question` verbatim.
export async function resolveQueryFilters(
  question: string,
  history: ConversationTurn[] = [],
  overrides: CliFilterOverrides = {},
  signal?: AbortSignal,
): Promise<ResolvedQuery> {
  const standaloneQuestion = await condenseFollowUp(question, history, signal);
  const inferred = await inferFilters(standaloneQuestion, signal);

  const filter: QueryFilter = {
    type: overrides.type ?? inferred.type,
    language: overrides.language,
    dateRange: inferred.dateRange,
    book: inferred.book,
  };

  return { filter, isExistenceQuery: inferred.isExistenceQuery, inferred, standaloneQuestion };
}
