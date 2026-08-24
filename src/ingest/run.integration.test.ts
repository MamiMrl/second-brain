import { describe, expect, it } from "vitest";
import { runIngest } from "./run.js";

// Regression test for a bug found while live-verifying M4 (Kindle ingestion)
// against real Atlas: chunk metadata carried `createdAt: new Date()`, and
// LangChain's RecordManager hashes pageContent *and* metadata together to
// decide what's unchanged (FR-1.5) — a timestamp that changes every run made
// every chunk look "new" on every ingest, breaking idempotent re-ingestion
// (PRD §8's "Ingestion idempotency: 0 duplicates" success metric) for every
// document type, not just Kindle. Fixed by dropping the per-chunk timestamp
// (src/ingest/run.ts) — Documents already carry ingestedAt/updatedAt.
//
// Real Mongo Atlas required, so opt-in only, mirroring the existing
// suggestNutrition integration test's real-Mongo discipline.
// Run with: RUN_INGEST_INTEGRATION=1 npm test -- run.integration
const RUN = process.env.RUN_INGEST_INTEGRATION === "1";

describe.skipIf(!RUN)("runIngest — idempotent re-ingestion (real Atlas)", () => {
  it("re-ingesting unchanged fixtures is a true no-op", async () => {
    // fixtures/kindle is the permanent regression fixture set (per the M3
    // handoff) — re-ingesting it never creates new Documents, so this needs
    // no inserted-record cleanup afterward.
    await runIngest({ inputPath: "fixtures/kindle" });
    const second = await runIngest({ inputPath: "fixtures/kindle" });

    expect(second.numAdded).toBe(0);
    expect(second.numUpdated).toBe(0);
    expect(second.numDeleted).toBe(0);
  });
});
