import type { Db } from "mongodb";

// The driver's ListSearchIndexesCursor is typed as { name: string } only,
// but Atlas actually returns `queryable`/`status` too (confirmed against a
// live cluster) — the driver's types just don't model the full response.
interface SearchIndexStatus {
  queryable?: boolean;
  status?: string;
}

// Guards against the exact failure mode discovered in M7 QA: $vectorSearch
// against a missing or not-yet-queryable Atlas Search index returns zero
// results silently rather than erroring, which is indistinguishable from
// "no matching documents" — every retrieval looked empty for months with no
// error anywhere. Fail loudly instead.
export async function ensureVectorIndexReady(db: Db, collectionName: string, indexName: string): Promise<void> {
  const indexes = (await db.collection(collectionName).listSearchIndexes(indexName).toArray()) as SearchIndexStatus[];
  const index = indexes[0];

  if (!index) {
    throw new Error(
      `Atlas Search index "${indexName}" does not exist on collection "${collectionName}". ` +
        `Vector search would silently return zero results — create the index first (see README.md#ingesting-documents).`,
    );
  }

  if (!index.queryable) {
    throw new Error(
      `Atlas Search index "${indexName}" on "${collectionName}" is not queryable yet (status: ${index.status}). ` +
        `Wait for it to finish building.`,
    );
  }
}
