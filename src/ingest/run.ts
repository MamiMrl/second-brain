import { Document } from "@langchain/core/documents";
import { index } from "@langchain/core/indexing";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { connectMongo } from "../lib/mongo.js";
import { env } from "../lib/env.js";
import { VoyageEmbeddings } from "../lib/voyage-embeddings.js";
import { walk, toSourcePath } from "./walk.js";
import { detectType } from "./detect-type.js";
import { loadDocument } from "./loaders/index.js";
import { loadNutritionCsvPair } from "./loaders/nutrition.js";
import { findNutritionPair } from "./pair-nutrition.js";
import { upsertDocument } from "./upsert-document.js";
import { MongoRecordManager } from "./record-manager.js";
import { IngestError } from "./errors.js";
import type { DocumentType, LoadedDocument } from "./types.js";

export const CHUNKS_VECTOR_INDEX = "chunks_vector_index";

export interface IngestSummary extends Awaited<ReturnType<typeof index>> {
  filesProcessed: number;
  sources: string[];
}

export interface RunIngestOptions {
  inputPath: string;
  typeOverride?: DocumentType;
}

// FR-1.8: fail-fast, no partial/best-effort runs. Phase 1 parses every file
// in the batch before anything is written; if any file fails, nothing from
// this run has touched Mongo yet, so aborting here is a clean no-op rather
// than requiring a rollback.
export async function parseAll(inputPath: string, typeOverride?: DocumentType): Promise<{ absPath: string; source: string; loaded: LoadedDocument }[]> {
  const absPaths = await walk(inputPath);
  const results: { absPath: string; source: string; loaded: LoadedDocument }[] = [];

  // FR-7.1: a Cronometer nutrition export is two files (Daily Summary +
  // Servings) that must be joined before the normal per-file loop below —
  // find and consume the pair first, if this batch has one. Still applies
  // under `--type nutrition` (an explicit override doesn't mean "skip
  // pairing," only "skip auto-detection" for the remaining files); only a
  // *different* override (e.g. --type recipe) bypasses pairing entirely.
  let remaining = absPaths;
  if (!typeOverride || typeOverride === "nutrition") {
    const { dailySummaryPath, servingsPath } = await findNutritionPair(absPaths);
    if (dailySummaryPath && servingsPath) {
      const dailySummarySource = toSourcePath(dailySummaryPath);
      const servingsSource = toSourcePath(servingsPath);
      const loaded = await loadNutritionCsvPair(dailySummaryPath, dailySummarySource, servingsPath, servingsSource);
      results.push({ absPath: dailySummaryPath, source: loaded.document.source, loaded });
      remaining = absPaths.filter((p) => p !== dailySummaryPath && p !== servingsPath);
    } else if (dailySummaryPath || servingsPath) {
      throw IngestError.nutritionCsvMissingPair(toSourcePath((dailySummaryPath ?? servingsPath)!));
    }
  }

  for (const absPath of remaining) {
    const source = toSourcePath(absPath);
    const type = await detectType(absPath, typeOverride);
    const loaded = await loadDocument(type, absPath, source);
    results.push({ absPath, source, loaded });
  }
  return results;
}

export async function runIngest({ inputPath, typeOverride }: RunIngestOptions): Promise<IngestSummary> {
  const parsed = await parseAll(inputPath, typeOverride);

  const { client, db } = await connectMongo();
  try {
    await db.collection("documents").createIndex({ source: 1 }, { unique: true });

    const recordManager = new MongoRecordManager(db);
    await recordManager.createSchema();

    const embeddings = new VoyageEmbeddings({ apiKey: env.voyageApiKey(), model: env.voyageModel() });
    const vectorStore = new MongoDBAtlasVectorSearch(embeddings, {
      collection: db.collection("chunks"),
      indexName: CHUNKS_VECTOR_INDEX,
      textKey: "text",
      embeddingKey: "embedding",
    });

    const allChunkDocs: Document[] = [];
    for (const { loaded } of parsed) {
      const documentId = await upsertDocument(db, loaded.document);
      loaded.chunks.forEach((chunk, chunkIndex) => {
        // Only defined fields are included — MongoDBAtlasVectorSearch spreads
        // this object directly into the stored chunk document, so an
        // undefined `page`/`highlightDate` would otherwise show up as an
        // explicit null-ish field on every non-PDF/non-Kindle chunk.
        const metadata: Record<string, unknown> = {
          documentId,
          source: loaded.document.source,
          chunkIndex,
          createdAt: new Date().toISOString(),
        };
        if (chunk.page !== undefined) metadata.page = chunk.page;
        if (chunk.highlightDate !== undefined) metadata.highlightDate = chunk.highlightDate;
        if (chunk.ingredients !== undefined) metadata.ingredients = chunk.ingredients;
        if (chunk.steps !== undefined) metadata.steps = chunk.steps;
        if (chunk.date !== undefined) metadata.date = chunk.date;
        if (chunk.calories !== undefined) metadata.calories = chunk.calories;
        if (chunk.protein !== undefined) metadata.protein = chunk.protein;
        if (chunk.carbs !== undefined) metadata.carbs = chunk.carbs;
        if (chunk.fat !== undefined) metadata.fat = chunk.fat;
        if (chunk.foods !== undefined) metadata.foods = chunk.foods;

        allChunkDocs.push(new Document({ pageContent: chunk.text, metadata }));
      });
    }

    const result = await index({
      docsSource: allChunkDocs,
      recordManager,
      vectorStore,
      options: { cleanup: "incremental", sourceIdKey: "source" },
    });

    return { ...result, filesProcessed: parsed.length, sources: parsed.map((p) => p.source) };
  } finally {
    await client.close();
  }
}
