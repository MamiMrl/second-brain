import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseAll } from "./run.js";
import { IngestError } from "./errors.js";

const NUTRITION_DIR = path.resolve("fixtures/nutrition");

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
