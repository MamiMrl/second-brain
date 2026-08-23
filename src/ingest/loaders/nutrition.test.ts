import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadNutritionCsvPair } from "./nutrition.js";
import { IngestError } from "../errors.js";

const DAILY_SUMMARY = path.resolve("fixtures/nutrition/dailysummary-2026-08.csv");
const DAILY_SUMMARY_SOURCE = "fixtures/nutrition/dailysummary-2026-08.csv";
const SERVINGS = path.resolve("fixtures/nutrition/servings-2026-08.csv");
const SERVINGS_SOURCE = "fixtures/nutrition/servings-2026-08.csv";

describe("loadNutritionCsvPair", () => {
  it("produces one Document joining both exports", async () => {
    const { document } = await loadNutritionCsvPair(DAILY_SUMMARY, DAILY_SUMMARY_SOURCE, SERVINGS, SERVINGS_SOURCE);

    expect(document.type).toBe("nutrition");
    expect(document.source).toBe(`${DAILY_SUMMARY_SOURCE}+${SERVINGS_SOURCE}`);
    expect(document.contentHash).toBeTruthy();
  });

  it("produces one Chunk per completed day, joining macros with foods by date", async () => {
    const { chunks } = await loadNutritionCsvPair(DAILY_SUMMARY, DAILY_SUMMARY_SOURCE, SERVINGS, SERVINGS_SOURCE);

    expect(chunks).toHaveLength(2);

    const day1 = chunks.find((c) => c.date === "2026-08-10");
    expect(day1).toBeDefined();
    expect(day1?.foods).toEqual([
      "Oats, rolled",
      "Blueberries, raw",
      "Chicken Breast, grilled",
      "Brown Rice, cooked",
    ]);
    expect(day1?.calories).toBeCloseTo(858);
    expect(day1?.protein).toBeCloseTo(77.2);
    expect(day1?.carbs).toBeCloseTo(94.9);
    expect(day1?.fat).toBeCloseTo(14.8);
    expect(day1?.text).toContain("2026-08-10");

    const day2 = chunks.find((c) => c.date === "2026-08-11");
    expect(day2?.foods).toEqual(["Greek Yogurt, plain", "Chicken Breast, grilled", "Lentil Soup"]);
  });

  it("drops days with no logging (blank Energy) — 'Completed' is not a reliable logging-status flag", async () => {
    const { chunks } = await loadNutritionCsvPair(DAILY_SUMMARY, DAILY_SUMMARY_SOURCE, SERVINGS, SERVINGS_SOURCE);
    expect(chunks.find((c) => c.date === "2026-08-09")).toBeUndefined();
  });

  it("throws a malformed-CSV IngestError when Daily Summary columns are missing", async () => {
    const badPath = path.resolve("fixtures/nutrition/malformed-dailysummary.csv");
    const fs = await import("node:fs/promises");
    await fs.mkdir(path.dirname(badPath), { recursive: true });
    await fs.writeFile(badPath, "Foo,Bar\n1,2\n");

    await expect(
      loadNutritionCsvPair(badPath, "fixtures/nutrition/malformed-dailysummary.csv", SERVINGS, SERVINGS_SOURCE),
    ).rejects.toThrow(IngestError);

    await fs.unlink(badPath);
  });
});
