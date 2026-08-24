import type { Db } from "mongodb";
import type { QueryFilter } from "./types.js";

// `book` (FR-2.2) is free text extracted from the question, not a
// controlled value — escape it before use in a RegExp.
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// FR-2.2/§5.4: type/language/book/date-range filters resolve to a set of
// documentIds first (fast metadata query against `documents`), before
// vector search pre-filters `chunks` by that set (retriever.ts). Returns
// undefined when the filter is empty — "search everything," not an
// artificial match-all id list.
//
// `date` only exists on fitness Documents (FR-1.3); Kindle's per-highlight
// date lives on the Chunk (`highlightDate`, §5.3) and isn't resolvable at
// this Document-level step — deferred to M4, when Kindle ingestion (and
// `book`'s only real use) actually lands.
export async function resolveDocumentIds(db: Db, filter: QueryFilter): Promise<string[] | undefined> {
  const query: Record<string, unknown> = {};

  if (filter.type) query.type = filter.type;
  else if (filter.book) query.type = "kindle"; // book only applies to Kindle Documents (CONTEXT.md: Book = Document)

  if (filter.language) query.language = filter.language;

  // Ignore a stray `book` if a non-Kindle type was also inferred, rather than
  // AND-ing an unsatisfiable title/author match against the wrong type.
  if (filter.book && query.type === "kindle") {
    const pattern = new RegExp(escapeRegExp(filter.book), "i");
    query.$or = [{ title: pattern }, { author: pattern }];
  }

  if (query.type !== "kindle" && (filter.dateRange?.start || filter.dateRange?.end)) {
    const date: Record<string, string> = {};
    if (filter.dateRange.start) date.$gte = filter.dateRange.start;
    if (filter.dateRange.end) date.$lte = filter.dateRange.end;
    query.date = date;
  }

  if (Object.keys(query).length === 0) return undefined;

  const matches = await db.collection("documents").find(query, { projection: { _id: 1 } }).toArray();
  return matches.map((doc) => String(doc._id));
}
