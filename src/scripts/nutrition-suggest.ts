import { connectMongo } from "../lib/mongo.js";
import { suggestNutrition } from "../agent/nutrition-agent.js";

// FR-7.4: `nutrition-suggest` — no arguments, on-demand only (no cron, no
// daemon), mirroring the ask.ts/ingest.ts script shape.
async function main() {
  const { client, db } = await connectMongo();

  try {
    const { recommendation } = await suggestNutrition(db);
    console.log(recommendation);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(`\nNutrition suggestion failed: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
