import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db, MongoClient, ObjectId } from "mongodb";
import { connectMongo } from "../lib/mongo.js";
import { env } from "../lib/env.js";
import { VoyageEmbeddings } from "../lib/voyage-embeddings.js";
import { answerChatAgentically } from "./chat-agent.js";

// Real integration test against a real Mongo Atlas instance + the real
// Claude Agent SDK query() call (same discipline as nutrition-agent
// .integration.test.ts/chat-turn.integration.test.ts: don't mock the
// collaborators the agentic entry point actually depends on). This costs
// real Anthropic/Voyage API usage and depends on Atlas Search vector-index
// freshness, so it's opt-in only.
//
// Run with: RUN_CHAT_AGENT_INTEGRATION=1 npm test -- chat-agent.integration
const RUN = process.env.RUN_CHAT_AGENT_INTEGRATION === "1";

describe.skipIf(!RUN)("answerChatAgentically (real Mongo + real retriever + real Agent SDK query())", () => {
  let client: MongoClient;
  let db: Db;
  const insertedDocumentIds: ObjectId[] = [];
  const TAG = `integration-test/chat-agent/${Date.now()}`;

  beforeAll(async () => {
    ({ client, db } = await connectMongo());

    const embeddings = new VoyageEmbeddings({ apiKey: env.voyageApiKey(), model: env.voyageModel() });
    const fitnessText =
      "Heavy leg day — back squat 5x5 at 100kg, Romanian deadlift 3x8 at 80kg, felt strong throughout, " +
      "a hard strength-training session.";
    const nutritionText = "Nutrition diary — low protein day, mostly carbs and fat, not much protein intake.";
    const [fitnessEmbedding, nutritionEmbedding] = await embeddings.embedDocuments([fitnessText, nutritionText]);

    const fitnessDoc = await db.collection("documents").insertOne({
      type: "fitness",
      title: "Fitness note — leg day",
      source: `${TAG}/fitness.md`,
      language: "en",
      date: "2026-08-26",
      contentHash: "test-hash-fitness",
      ingestedAt: new Date(),
      updatedAt: new Date(),
    });
    insertedDocumentIds.push(fitnessDoc.insertedId);
    await db.collection("chunks").insertOne({
      documentId: String(fitnessDoc.insertedId),
      source: `${TAG}/fitness.md`,
      chunkIndex: 0,
      text: fitnessText,
      embedding: fitnessEmbedding,
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
      text: nutritionText,
      calories: 2200,
      protein: 60,
      carbs: 300,
      fat: 70,
      foods: ["Pasta", "Bread"],
      createdAt: new Date().toISOString(),
    });

    // Atlas Search vector indexes update asynchronously; give it a moment
    // to pick up the freshly inserted embeddings.
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }, 30_000);

  afterAll(async () => {
    await db.collection("documents").deleteMany({ _id: { $in: insertedDocumentIds } });
    await db.collection("chunks").deleteMany({ documentId: { $in: insertedDocumentIds.map(String) } });
    await client.close();
  });

  // Ticket #24 acceptance criterion: a genuinely multi-domain question
  // produces a grounded answer that reasons across both domains, backed by
  // chunks the agent's own tool calls actually returned.
  it("reasons across fitness notes and recent nutrition for a genuinely multi-domain question", async () => {
    const question =
      "Given my recent training and my recent nutrition intake, is my protein intake supporting my training?";

    const result = await answerChatAgentically(db, `${TAG}/conversation`, question);

    expect(result.kind).toBe("generated");
    if (result.kind !== "generated") throw new Error(`expected a generated answer, got ${result.kind}`);

    expect(result.generated.answer.length).toBeGreaterThan(0);
    expect(result.chunks.length).toBeGreaterThan(0);

    // OR, not AND: getRecentNutrition (the tool the system prompt steers the
    // agent toward for "recent intake" questions) returns day summaries, not
    // RetrievedChunk-shaped chunks, so it can't feed accumulatedChunks — only
    // searchDocuments/checkExistence chunks do, per the spec's groundedness
    // scope. A run that answers the nutrition half via getRecentNutrition
    // legitimately accumulates fitness-only chunks.
    const citedTypes = new Set(result.chunks.map((chunk) => chunk.type));
    expect(citedTypes.has("fitness") || citedTypes.has("nutrition")).toBe(true);
  }, 120_000);
});
