import { ObjectId, type Db } from "mongodb";
import type { DocumentFields } from "../ingest/types.js";

// Shared by retriever.ts (vector search results) and exhaustive-scan.ts
// (full scan results) — both need to join chunk rows back to their parent
// Document for citation metadata (type/title/source/language/author/date
// live on the Document, not the Chunk — §5.3).
export async function fetchParentDocumentsById(
  db: Db,
  documentIds: string[],
): Promise<Map<string, DocumentFields & { _id: ObjectId }>> {
  const parents = await db
    .collection<DocumentFields & { _id: ObjectId }>("documents")
    .find({ _id: { $in: documentIds.map((id) => new ObjectId(id)) } })
    .toArray();
  return new Map(parents.map((parent) => [String(parent._id), parent]));
}

// Shared by retriever.ts and exhaustive-scan.ts's per-chunk mapping — both
// join a chunk to its parent the same way and hit the same "orphaned
// chunk" invariant violation if the join misses.
export function requireParent(
  documentId: string,
  parentById: Map<string, DocumentFields & { _id: ObjectId }>,
): DocumentFields {
  const parent = parentById.get(documentId);
  if (!parent) throw new Error(`Chunk references missing parent document ${documentId}`);
  return parent;
}
