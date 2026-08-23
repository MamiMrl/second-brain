import { MongoClient } from "mongodb";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { Document } from "@langchain/core/documents";
import { traceable } from "langsmith/traceable";
import { env } from "../lib/env.js";
import { VoyageEmbeddings } from "../lib/voyage-embeddings.js";

// M1 milestone (PRD §9): prove the embed -> store -> vector search round-trip
// end to end, with dummy data, before any real ingestion/retrieval code exists.
//
// Requires (see .env.example):
//   - an Atlas cluster with a vector search index named "roundtrip_vector_index"
//     on the `roundtrip_chunks` collection, indexing the `embedding` field
//     (cosine similarity, dimension 1024 for voyage-4-lite's default output)
//   - ANTHROPIC_API_KEY is not needed here — this script only exercises
//     embeddings + retrieval, not generation

const DUMMY_CHUNKS = [
  { text: "Sourdough hydration ratio: 500g flour, 350g water (70% hydration).", type: "recipe" },
  { text: "Deadlift progression, March: worked up to 3x5 at 120kg.", type: "fitness" },
  { text: "Atomic Habits: habit stacking means anchoring a new habit to an existing one.", type: "kindle" },
];

const QUESTION = "What's my sourdough flour to water ratio?";

async function runRoundtrip() {
  const embeddings = new VoyageEmbeddings({
    apiKey: env.voyageApiKey(),
    model: env.voyageModel(),
  });

  const mongoClient = new MongoClient(env.mongodbAtlasUri());
  await mongoClient.connect();

  try {
    const collection = mongoClient.db(env.mongodbDbName()).collection("roundtrip_chunks");
    await collection.deleteMany({}); // keep this script idempotent across runs

    const vectorStore = new MongoDBAtlasVectorSearch(embeddings, {
      collection,
      indexName: "roundtrip_vector_index",
      textKey: "text",
      embeddingKey: "embedding",
    });

    console.log(`Embedding + storing ${DUMMY_CHUNKS.length} dummy chunks...`);
    await vectorStore.addDocuments(
      DUMMY_CHUNKS.map((chunk) => new Document({ pageContent: chunk.text, metadata: { type: chunk.type } })),
    );

    console.log(`\nQuestion: "${QUESTION}"`);
    const results = await vectorStore.similaritySearchWithScore(QUESTION, 3);

    console.log("\nTop matches (cosine similarity):");
    for (const [doc, score] of results) {
      console.log(`  [${score.toFixed(4)}] (${doc.metadata.type}) ${doc.pageContent}`);
    }

    const [topDoc, topScore] = results[0];
    if (topDoc.metadata.type !== "recipe" || topScore < 0.5) {
      throw new Error("Round-trip sanity check failed: expected the recipe chunk to rank first with a strong score.");
    }
    console.log("\nRound-trip OK: embed -> store -> vector search returned the expected match.");
  } finally {
    await mongoClient.close();
  }
}

// Wrapped in `traceable` so this run shows up in LangSmith (LANGSMITH_TRACING=true
// in .env) — the M1 goal is proving the whole stack is wired, not just Mongo+Voyage.
const tracedRoundtrip = traceable(runRoundtrip, { name: "m1-embed-query-roundtrip" });

await tracedRoundtrip();
