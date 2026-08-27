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

// Ticket #21: a prior turn's role + text only — no citedChunks/timestamp —
// since condensation only needs the transcript, not the persistence shape
// (chat/types.ts's ChatMessage), which query/ has no reason to depend on.
export interface ConversationTurn {
  role: "user" | "assistant";
  text: string;
}

export interface ResolvedQuery {
  filter: QueryFilter;
  isExistenceQuery: boolean;
  // Raw model output, unmerged with CLI overrides — logged to the
  // LangSmith trace per FR-2.2 ("the inferred filter is logged in every
  // LangSmith trace") so the override is visible separately from inference.
  inferred: InferredFilter;
  // Ticket #21: `question` rewritten into a standalone question against
  // `history` (condense-then-retrieve) — equal to the original question
  // verbatim when there's no history. Everything downstream of filter
  // resolution (existence routing, retrieval, generation, groundedness)
  // uses this instead of the raw per-turn question.
  standaloneQuestion: string;
}
