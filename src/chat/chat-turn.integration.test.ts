import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db, MongoClient, ObjectId } from "mongodb";
import { connectMongo } from "../lib/mongo.js";
import { env } from "../lib/env.js";
import { VoyageEmbeddings } from "../lib/voyage-embeddings.js";
import { ABSTAIN_MESSAGE } from "../query/groundedness.js";
import { createConversation, getConversation } from "./conversations.js";
import { handleChatTurn } from "./chat-turn.js";

// Real integration test against real Mongo Atlas + real retrieval + real
// Claude generation — same discipline as nutrition-agent.integration.test.ts
// and run.integration.test.ts: don't mock the collaborators a chat turn
// actually depends on. Opt-in only (real API usage, Atlas index-freshness
// lag).
//
// Run with: RUN_CHAT_TURN_INTEGRATION=1 npm test -- chat-turn.integration
const RUN = process.env.RUN_CHAT_TURN_INTEGRATION === "1";

describe.skipIf(!RUN)("handleChatTurn (real Mongo + real retrieval + real generation)", () => {
  let client: MongoClient;
  let db: Db;
  const insertedDocumentIds: ObjectId[] = [];
  const TAG = `integration-test/chat-turn/${Date.now()}`;

  beforeAll(async () => {
    ({ client, db } = await connectMongo());

    const embeddings = new VoyageEmbeddings({ apiKey: env.voyageApiKey(), model: env.voyageModel() });
    const text =
      "Sourdough Bread v3 — ratio of flour to water is 500g flour to 375g water (75% hydration), " +
      "plus 100g starter and 10g salt.";
    const [embedding] = await embeddings.embedDocuments([text]);

    const doc = await db.collection("documents").insertOne({
      type: "recipe",
      title: "Sourdough Bread v3",
      source: `${TAG}/sourdough.md`,
      language: "en",
      contentHash: "test-hash-sourdough",
      ingestedAt: new Date(),
      updatedAt: new Date(),
    });
    insertedDocumentIds.push(doc.insertedId);
    await db.collection("chunks").insertOne({
      documentId: String(doc.insertedId),
      source: `${TAG}/sourdough.md`,
      chunkIndex: 0,
      text,
      embedding,
      createdAt: new Date().toISOString(),
    });

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }, 30_000);

  afterAll(async () => {
    await db.collection("documents").deleteMany({ _id: { $in: insertedDocumentIds } });
    await db.collection("chunks").deleteMany({ documentId: { $in: insertedDocumentIds.map(String) } });
    await client.close();
  });

  it("answers a real question, persists both messages, and records which chunks backed the answer", async () => {
    const conversationId = await createConversation(db);

    const assistantMessage = await handleChatTurn(
      db,
      conversationId,
      "What was the ratio of flour to water in my sourdough recipe?",
    );

    expect(assistantMessage.role).toBe("assistant");
    expect(assistantMessage.pipelinePath).toBe("deterministic");
    expect(assistantMessage.text.length).toBeGreaterThan(0);
    expect(assistantMessage.citedChunks.length).toBeGreaterThan(0);
    expect(assistantMessage.citedChunks[0].documentId).toBe(String(insertedDocumentIds[0]));

    const conversation = await getConversation(db, conversationId);
    expect(conversation?.messages).toHaveLength(2);
    expect(conversation?.messages[0].role).toBe("user");
    expect(conversation?.messages[1].role).toBe("assistant");
  }, 60_000);

  it("persists the abstain message the same way as a generated answer, for a question with no relevant documents", async () => {
    const conversationId = await createConversation(db);

    const assistantMessage = await handleChatTurn(
      db,
      conversationId,
      "What does my collection of documents say about deep-sea hydrothermal vent chemistry?",
    );

    expect(assistantMessage.role).toBe("assistant");
    expect(assistantMessage.text).toBe(ABSTAIN_MESSAGE);
    expect(assistantMessage.citedChunks).toEqual([]);

    const conversation = await getConversation(db, conversationId);
    expect(conversation?.messages).toHaveLength(2);
    expect(conversation?.messages[1].text).toBe(ABSTAIN_MESSAGE);
  }, 60_000);
});
