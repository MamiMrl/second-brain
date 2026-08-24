import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseAll } from "./run.js";
import { IngestError } from "./errors.js";

const NUTRITION_DIR = path.resolve("fixtures/nutrition");
const KINDLE_DIR = path.resolve("fixtures/kindle");

describe("parseAll — Kindle clippings fan-out", () => {
  it("auto-detects My Clippings.txt and fans it out into one result per book", async () => {
    const results = await parseAll(KINDLE_DIR);

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.loaded.document.type === "kindle")).toBe(true);
    // Each book must land under its own stable, distinct `source` (upsertDocument's key) —
    // never sharing the file-level source, or the two books would collide into one Document.
    expect(new Set(results.map((r) => r.source)).size).toBe(2);
  });

  it("still fans out under an explicit --type kindle override", async () => {
    const results = await parseAll(KINDLE_DIR, "kindle");
    expect(results).toHaveLength(2);
  });
});

describe("parseAll — nutrition CSV pairing", () => {
  it("pairs the Daily Summary + Servings CSVs when no --type override is given", async () => {
    const results = await parseAll(NUTRITION_DIR);
    expect(results).toHaveLength(1);
    expect(results[0].loaded.document.type).toBe("nutrition");
  });

  it("still pairs the CSVs under an explicit --type nutrition override", async () => {
    const results = await parseAll(NUTRITION_DIR, "nutrition");
    expect(results).toHaveLength(1);
    expect(results[0].loaded.document.type).toBe("nutrition");
  });

  it("throws when only one half of the pair is present, even under --type nutrition", async () => {
    const dailySummaryOnly = path.join(NUTRITION_DIR, "dailysummary-2026-08.csv");
    await expect(parseAll(dailySummaryOnly, "nutrition")).rejects.toThrow(IngestError);
  });
});
