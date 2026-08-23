import type { Db } from "mongodb";
import { retrieveChunks, type RetrievedChunk } from "../query/retriever.js";

const DEFAULT_RECENCY_DAYS = 7;
const DEFAULT_RECIPE_K = 6;

export interface RecentNutritionDay {
  date: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  foods?: string[];
}

// Tool 1 (FR-7.3): thin adapter over the existing retriever — no new
// retrieval logic, filter fixed to type=recipe so the agent can only ever
// ground its recommendation in ingested recipes (consistent with FR-3.1's
// "answer only from retrieved chunks" no-fabrication principle).
export async function retrieveRecipes(db: Db, query: string, k: number = DEFAULT_RECIPE_K): Promise<RetrievedChunk[]> {
  return retrieveChunks(db, query, { type: "recipe" }, k);
}

// Tool 2 (FR-7.3): reads recent type=nutrition Documents/Chunks directly via
// the existing Mongo access layer, bounded to a recency window, so the agent
// can reason about recent intake patterns (macros, variety, repetition)
// rather than being handed a single day's snapshot.
export async function getRecentNutrition(db: Db, days: number = DEFAULT_RECENCY_DAYS): Promise<RecentNutritionDay[]> {
  const nutritionDocs = await db
    .collection("documents")
    .find({ type: "nutrition" }, { projection: { _id: 1 } })
    .toArray();
  const documentIds = nutritionDocs.map((doc) => String(doc._id));
  if (documentIds.length === 0) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const chunks = await db
    .collection("chunks")
    .find({ documentId: { $in: documentIds }, date: { $gte: cutoffDate } })
    .sort({ date: -1 })
    .toArray();

  return chunks.map((chunk) => ({
    date: chunk.date,
    calories: chunk.calories,
    protein: chunk.protein,
    carbs: chunk.carbs,
    fat: chunk.fat,
    foods: chunk.foods,
  }));
}
