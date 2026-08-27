import type { Db } from "mongodb";
import { retrieveChunks, type RetrievedChunk } from "../query/retriever.js";
import { resolveDocumentIds } from "../query/resolve-document-ids.js";
import { scanBoundedChunks } from "../query/exhaustive-scan.js";
import type { QueryFilter } from "../query/types.js";

const DEFAULT_SEARCH_K = 6;

// Ticket #24: `searchDocuments`/`checkExistence` — one parameterized tool
// per operation shape (similarity search vs. exhaustive scan), not one tool
// per DocumentType, per docs/research/agentic-vs-deterministic-query-
// pipeline.md §3. Both are thin wrappers over the same deterministic-
// pipeline functions (retriever.ts, exhaustive-scan.ts) — no new retrieval
// logic, same pattern as nutrition-tools.ts's retrieveRecipes.

export interface SearchDocumentsParams {
  query: string;
  type?: QueryFilter["type"];
  book?: string;
  dateRange?: QueryFilter["dateRange"];
}

export async function searchDocuments(db: Db, params: SearchDocumentsParams, k: number = DEFAULT_SEARCH_K): Promise<RetrievedChunk[]> {
  const filter: QueryFilter = { type: params.type, book: params.book, dateRange: params.dateRange };
  return retrieveChunks(db, params.query, filter, k);
}

export interface CheckExistenceParams {
  type?: QueryFilter["type"];
  book?: string;
}

export async function checkExistence(db: Db, params: CheckExistenceParams): Promise<RetrievedChunk[]> {
  const filter: QueryFilter = { type: params.type, book: params.book };
  // Unlike answerExistenceQuery.ts's use of resolveDocumentIds (guaranteed
  // bounded by its own isBoundedCategory check), the agent can call this
  // tool with neither type nor book set. resolveDocumentIds would then
  // return undefined ("search everything"), which an exhaustive scan can't
  // honor without an explicit id list — falling back to `[]` scans nothing
  // rather than the whole corpus, the conservative choice for an unbounded
  // existence check.
  const documentIds = (await resolveDocumentIds(db, filter)) ?? [];
  return scanBoundedChunks(db, documentIds);
}
