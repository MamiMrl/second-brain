import type { Db } from "mongodb";
import { fetchParentDocumentsById, requireParent } from "./fetch-parents.js";
import type { RetrievedChunk } from "./retriever.js";

interface ChunkRow {
  documentId: string;
  text: string;
  chunkIndex: number;
  page?: number;
  highlightDate?: string;
}

const CHUNK_PROJECTION = { text: 1, documentId: 1, chunkIndex: 1, page: 1, highlightDate: 1 };

// FR-2.4 SCAN: every chunk in the bounded document set, unranked — not
// top-k similarity search. The CONFIDENT step's presence/absence claim
// gets its confidence from exhaustiveness (saw everything), not from a
// relevance score, so results carry no `score` (see RetrievedChunk).
export async function scanBoundedChunks(db: Db, documentIds: string[]): Promise<RetrievedChunk[]> {
  if (documentIds.length === 0) return [];

  // Not top-k limited, so this can pull every chunk in a category — skip
  // the `embedding` vector field via projection, since it's unused here.
  const [chunks, parentById] = await Promise.all([
    db
      .collection<ChunkRow>("chunks")
      .find({ documentId: { $in: documentIds } }, { projection: CHUNK_PROJECTION })
      .toArray(),
    fetchParentDocumentsById(db, documentIds),
  ]);

  return chunks.map((chunk) => ({
    ...requireParent(chunk.documentId, parentById),
    text: chunk.text,
    documentId: chunk.documentId,
    chunkIndex: chunk.chunkIndex,
    page: chunk.page,
    highlightDate: chunk.highlightDate,
  }));
}
