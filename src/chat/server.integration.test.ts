import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Db, MongoClient, ObjectId } from "mongodb";
import type http from "node:http";
import { connectMongo } from "../lib/mongo.js";
import { env } from "../lib/env.js";
import { VoyageEmbeddings } from "../lib/voyage-embeddings.js";
import { createChatServer } from "./server.js";
import { readSseEvents } from "./sse-test-support.js";

// Real integration test against a real running service: real Mongo Atlas,
// real retrieval, real Claude generation — same discipline as
// chat-turn.integration.test.ts. Opt-in only (real API usage, Atlas
// index-freshness lag, and genuinely slow — a live generation call per
// case).
//
// Run with: RUN_CHAT_SERVER_INTEGRATION=1 npm test -- server.integration
const RUN = process.env.RUN_CHAT_SERVER_INTEGRATION === "1";

describe.skipIf(!RUN)("createChatServer (real Mongo + real retrieval + real generation, over HTTP + SSE)", () => {
  let client: MongoClient;
  let db: Db;
  let server: http.Server;
  let baseUrl: string;
  const insertedDocumentIds: ObjectId[] = [];
  const TAG = `integration-test/server/${Date.now()}`;

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

    server = createChatServer({ db });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("server did not bind to a port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  }, 60_000);

  afterAll(async () => {
    server?.close();
    await db.collection("documents").deleteMany({ _id: { $in: insertedDocumentIds } });
    await db.collection("chunks").deleteMany({ documentId: { $in: insertedDocumentIds.map(String) } });
    await client.close();
  });

  async function createConversation(): Promise<string> {
    const response = await fetch(`${baseUrl}/conversations`, { method: "POST" });
    const body = (await response.json()) as { conversationId: string };
    return body.conversationId;
  }

  it("streams a status event per pipeline step over SSE, ending with the final answer event", async () => {
    const conversationId = await createConversation();
    const streamResponse = await fetch(`${baseUrl}/conversations/${conversationId}/stream`);
    expect(streamResponse.headers.get("content-type")).toContain("text/event-stream");

    // The number of status events varies by pipeline path (existence vs.
    // standard retrieve+generate), so this reads by terminal event rather
    // than a fixed count.
    const eventsPromise = readSseEvents(streamResponse, (events) => events.at(-1)?.event === "answer");

    const response = await fetch(`${baseUrl}/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "What was the ratio of flour to water in my sourdough recipe?" }),
    });
    const assistantMessage = await response.json();

    const events = await eventsPromise;
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events.every((e, i) => i === events.length - 1 || e.event === "status")).toBe(true);
    expect(events[events.length - 1]).toEqual({ event: "answer", data: assistantMessage });
  }, 60_000);

  it("aborts the in-flight Claude call on client disconnect, so the answer never gets persisted", async () => {
    const conversationId = await createConversation();
    const streamResponse = await fetch(`${baseUrl}/conversations/${conversationId}/stream`);

    // Wait for the "generating-answer" status — proof the upstream Claude
    // call has actually started — before disconnecting, so the abort is a
    // real mid-flight cancellation rather than a race with request setup.
    const untilGenerating = readSseEvents(
      streamResponse,
      (events) => events.some((e) => e.event === "status" && (e.data as { step: string }).step === "generating-answer"),
    );

    const controller = new AbortController();
    const pending = fetch(`${baseUrl}/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "What was the ratio of flour to water in my sourdough recipe?" }),
      signal: controller.signal,
    }).catch(() => {}); // the client's own fetch also rejects on abort — not what this test checks

    await untilGenerating;
    controller.abort();
    await pending;

    const conversationResponse = await fetch(`${baseUrl}/conversations/${conversationId}`);
    const conversation = (await conversationResponse.json()) as { messages: { role: string }[] };

    // Only the user message was persisted — handleChatTurn's Claude call was
    // aborted before generateAnswer resolved, so the assistant message was
    // never appended.
    expect(conversation.messages).toHaveLength(1);
    expect(conversation.messages[0].role).toBe("user");
  }, 60_000);
});
