import type { Db } from "mongodb";
import { resolveDocumentIds } from "./resolve-document-ids.js";
import { scanBoundedChunks } from "./exhaustive-scan.js";
import { generateExistenceAnswer, type ExistenceAnswer } from "./existence-answer.js";
import type { ResolvedQuery } from "./types.js";
import type { PipelineOptions } from "./answer-query.js";

// FR-2.4 ROUTE + SCAN + CONFIDENT, entry point for the `ask` CLI (FR-4.1).
// Returns null when the query isn't eligible for existence-routing — the
// LLM wasn't confident it's an existence question, or the category isn't
// bounded (no type/book resolved) — in which case the caller falls back to
// the standard retrieval path (retriever.ts + FR-3.x generation).
//
// "Bounded" means the resolved *filter* names a type or book, not that
// resolveDocumentIds() found matches — zero matches within a bounded
// category is itself a valid (still exhaustive) scan result, e.g. "no,
// you have no recipes with quinoa" when type=recipe matched documents but
// none mention quinoa.
export async function answerExistenceQuery(
  db: Db,
  question: string,
  resolved: ResolvedQuery,
  options: PipelineOptions = {},
): Promise<ExistenceAnswer | null> {
  const isBoundedCategory = resolved.filter.type !== undefined || resolved.filter.book !== undefined;
  if (!resolved.isExistenceQuery || !isBoundedCategory) return null;

  // isBoundedCategory guarantees resolveDocumentIds's query is non-empty
  // (type or book always sets at least `type`), so this never actually
  // resolves undefined — the `?? []` only satisfies the wider return type.
  const documentIds = (await resolveDocumentIds(db, resolved.filter)) ?? [];
  const chunks = await scanBoundedChunks(db, documentIds);

  options.onStep?.("generating-answer");
  return generateExistenceAnswer(question, chunks, options.signal);
}
