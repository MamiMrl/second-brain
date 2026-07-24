import type { Db } from "mongodb";
import type { DocumentFields } from "./types.js";

// Upserts by `source` (stable across re-ingestion, per FR-1.5) so the
// Document's _id — and therefore every Chunk's documentId — stays stable
// across re-ingestion, keeping citations stable (PRD.md §5.3).
export async function upsertDocument(db: Db, fields: DocumentFields): Promise<string> {
  const now = new Date();
  const result = await db.collection("documents").findOneAndUpdate(
    { source: fields.source },
    {
      $set: { ...fields, updatedAt: now },
      $setOnInsert: { ingestedAt: now },
    },
    { upsert: true, returnDocument: "after" },
  );

  if (!result) throw new Error(`Failed to upsert document record for source "${fields.source}"`);
  return String(result._id);
}
