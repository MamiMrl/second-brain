import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db, MongoClient, ObjectId } from "mongodb";
import { connectMongo } from "../lib/mongo.js";
import { env } from "../lib/env.js";
import { VoyageEmbeddings } from "../lib/voyage-embeddings.js";
import { suggestNutrition } from "./nutrition-agent.js";

// Real integration test against a real Mongo Atlas instance + the real
// Claude Agent SDK query() call (per the M7 ticket's Testing Decisions: "do
// not mock the Claude Agent SDK's query() call in the core integration
// test" — same discipline as the M3 handoff's real-Ollama/real-Mongo/real-
// fixtures choice for ask.ts). This costs real Anthropic/Voyage API usage
// and depends on Atlas Search vector-index freshness (newly inserted
// vectors can lag before they're searchable), so it's opt-in only.
//
// Run with: RUN_NUTRITION_AGENT_INTEGRATION=1 npm test -- nutrition-agent.integration
const RUN = process.env.RUN_NUTRITION_AGENT_INTEGRATION === "1";

describe.skipIf(!RUN)("suggestNutrition (real Mongo + real Agent SDK query())", () => {
  let client: MongoClient;
  let db: Db;
  const insertedDocumentIds: ObjectId[] = [];
  const TAG = `integration-test/nutrition-agent/${Date.now()}`;

  beforeAll(async () => {
    ({ client, db } = await connectMongo());

    const embeddings = new VoyageEmbeddings({ apiKey: env.voyageApiKey(), model: env.voyageModel() });
    const recipeText =
      "Grilled Chicken and Quinoa Bowl — high protein, low carb. Grilled chicken breast, quinoa, " +
      "steamed broccoli, olive oil, lemon. A light, protein-forward dinner.";
    const [recipeEmbedding] = await embeddings.embedDocuments([recipeText]);

    const recipeDoc = await db.collection("documents").insertOne({
      type: "recipe",
      title: "Grilled Chicken and Quinoa Bowl",
      source: `${TAG}/recipe.md`,
      language: "en",
      contentHash: "test-hash-recipe",
      ingestedAt: new Date(),
      updatedAt: new Date(),
    });
    insertedDocumentIds.push(recipeDoc.insertedId);
    await db.collection("chunks").insertOne({
      documentId: String(recipeDoc.insertedId),
      source: `${TAG}/recipe.md`,
      chunkIndex: 0,
      text: recipeText,
      embedding: recipeEmbedding,
      createdAt: new Date().toISOString(),
    });

    const nutritionDoc = await db.collection("documents").insertOne({
      type: "nutrition",
      title: "Nutrition diary — integration test",
      source: `${TAG}/nutrition.csv`,
      language: "en",
      contentHash: "test-hash-nutrition",
      ingestedAt: new Date(),
      updatedAt: new Date(),
    });
    insertedDocumentIds.push(nutritionDoc.insertedId);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await db.collection("chunks").insertOne({
      documentId: String(nutritionDoc.insertedId),
      source: `${TAG}/nutrition.csv`,
      chunkIndex: 0,
      date: yesterday.toISOString().slice(0, 10),
      text: "Nutrition diary — high carb, low protein day",
      calories: 2200,
      protein: 60,
      carbs: 300,
      fat: 70,
      foods: ["Pasta", "Bread", "Orange Juice"],
      createdAt: new Date().toISOString(),
    });

    // Atlas Search vector indexes update asynchronously; give it a moment
    // to pick up the freshly inserted recipe embedding.
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }, 30_000);

  afterAll(async () => {
    await db.collection("documents").deleteMany({ _id: { $in: insertedDocumentIds } });
    await db.collection("chunks").deleteMany({ documentId: { $in: insertedDocumentIds.map(String) } });
    await client.close();
  });

  it("recommends a recipe that actually exists in the fixture set", async () => {
    const { recommendation } = await suggestNutrition(db);

    expect(recommendation.length).toBeGreaterThan(0);
    expect(recommendation).toContain("Grilled Chicken and Quinoa Bowl");
  }, 120_000);
});
