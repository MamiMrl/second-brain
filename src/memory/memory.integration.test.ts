import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db, MongoClient } from "mongodb";
import { connectMongo } from "../lib/mongo.js";
import { reflectOnTurn } from "./reflect.js";
import { extractFromDocument } from "./extract.js";
import { listMemoryEntries, readMemoryPrompt } from "./memory-store.js";
import { generateAnswer } from "../query/generate-answer.js";

// Real integration test against real Mongo Atlas + real Claude calls — same
// discipline as chat-turn.integration.test.ts and nutrition-agent
// .integration.test.ts: don't mock the LLM judgment call this ticket's
// triggers actually depend on. Opt-in only (real API usage).
//
// Run with: RUN_MEMORY_INTEGRATION=1 npm test -- memory.integration
const RUN = process.env.RUN_MEMORY_INTEGRATION === "1";

describe.skipIf(!RUN)("memory layer (real Mongo + real Claude)", () => {
  let client: MongoClient;
  let db: Db;
  const TAG = `integration-test/memory/${Date.now()}`;

  beforeAll(async () => {
    ({ client, db } = await connectMongo());
  });

  afterAll(async () => {
    await db.collection("memory").deleteMany({ sourceRefs: { $regex: `^${TAG}` } });
    await client.close();
  });

  it("reflects a stated preference from a conversation turn into memory, and injects it into a later unrelated answer", async () => {
    const ref = `${TAG}/reflect`;
    await reflectOnTurn(
      db,
      ref,
      "What kind of recipes should I look for?",
      "I'll keep in mind that you're vegetarian and avoid shellfish, since you mentioned that.",
    );

    const entries = await listMemoryEntries(db);
    const written = entries.filter((entry) => entry.sourceRefs.includes(ref));
    expect(written.length).toBeGreaterThan(0);
    expect(written[0].category).toBe("profile");

    const memoryPrompt = await readMemoryPrompt(db);
    expect(memoryPrompt).toContain("vegetarian");

    const { answer } = await generateAnswer("What should I make for dinner tonight?", [], memoryPrompt);
    expect(answer.toLowerCase()).toContain("vegetarian");
  }, 60_000);

  // AC spot-check: a fact answerable verbatim by a single chunk/retrieval
  // query is not memory-worthy (docs/research/user-memory-layer.md §4,
  // exclusion #1/#3) — the judge should decline to store it.
  it("does not store a fact that a single document lookup would already answer", async () => {
    const ref = `${TAG}/no-duplicate`;
    await reflectOnTurn(
      db,
      ref,
      "What was my squat max on 2026-08-01?",
      "According to your fitness note from 2026-08-01, your squat max that day was 225 lbs.",
    );

    const entries = await listMemoryEntries(db);
    const written = entries.filter((entry) => entry.sourceRefs.includes(ref));
    expect(written).toEqual([]);
  }, 60_000);

  it("extracts a durable pattern from a newly ingested document into memory", async () => {
    const ref = `${TAG}/extract`;
    const documentText = Array.from(
      { length: 8 },
      (_, i) => `Day ${i + 1}: skipped breakfast, had a large lunch, light dinner.`,
    ).join("\n");

    await extractFromDocument(db, ref, "Nutrition log — integration test", documentText);

    const entries = await listMemoryEntries(db);
    const written = entries.filter((entry) => entry.sourceRefs.includes(ref));
    expect(written.length).toBeGreaterThan(0);
  }, 60_000);
});
