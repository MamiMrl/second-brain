import type { Db } from "mongodb";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { env } from "../lib/env.js";
import { VoyageEmbeddings } from "../lib/voyage-embeddings.js";
import { CHUNKS_VECTOR_INDEX } from "../ingest/run.js";
import type { DocumentFields } from "../ingest/types.js";
import { resolveDocumentIds } from "./resolve-document-ids.js";
import { fetchParentDocumentsById, requireParent } from "./fetch-parents.js";
import type { QueryFilter } from "./types.js";

const DEFAULT_K = 6; // FR-2.1

export interface RetrievedChunk extends DocumentFields {
  text: string;
  score?: number; // vector search only — exhaustive-scan.ts results have no similarity score (FR-2.4)
  documentId: string;
  chunkIndex: number;
  page?: number;
  highlightDate?: string;
}

// FR-2.1/2.3: vector similarity search, pre-filtered by the documentId set
// resolved from `filter` — Atlas native $vectorSearch.filter (confirmed in
// @langchain/mongodb's vectorstores.js: a plain filter object with none of
// preFilter/postFilterPipeline/includeEmbeddings is passed straight through
// as the $vectorSearch `filter` clause), not a client-side post-filter.
// Chunks only carry documentId/page/highlightDate/chunkIndex — type/title/
// source/language/author/date live on the parent Document (§5.3), so
// results are joined back to `documents` for full citation metadata.
export async function retrieveChunks(
  db: Db,
  question: string,
  filter: QueryFilter = {},
  k: number = DEFAULT_K,
): Promise<RetrievedChunk[]> {
  const documentIds = await resolveDocumentIds(db, filter);
  if (documentIds && documentIds.length === 0) return [];

  const embeddings = new VoyageEmbeddings({ apiKey: env.voyageApiKey(), model: env.voyageModel() });
  const vectorStore = new MongoDBAtlasVectorSearch(embeddings, {
    collection: db.collection("chunks"),
    indexName: CHUNKS_VECTOR_INDEX,
    textKey: "text",
    embeddingKey: "embedding",
  });

  const atlasFilter = documentIds ? { documentId: { $in: documentIds } } : undefined;
  const results = await vectorStore.similaritySearchWithScore(question, k, atlasFilter);
  if (results.length === 0) return [];

  const parentIds = [...new Set(results.map(([doc]) => String(doc.metadata.documentId)))];
  const parentById = await fetchParentDocumentsById(db, parentIds);

  return results.map(([doc, score]) => {
    const documentId = String(doc.metadata.documentId);
    const parent = requireParent(documentId, parentById);

    return {
      ...parent,
      text: doc.pageContent,
      score,
      documentId,
      chunkIndex: doc.metadata.chunkIndex,
      page: doc.metadata.page,
      highlightDate: doc.metadata.highlightDate,
    };
  });
}
