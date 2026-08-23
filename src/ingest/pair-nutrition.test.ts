import path from "node:path";
import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { findNutritionPair } from "./pair-nutrition.js";

const DAILY_SUMMARY = path.resolve("fixtures/nutrition/dailysummary-2026-08.csv");
const SERVINGS = path.resolve("fixtures/nutrition/servings-2026-08.csv");

describe("findNutritionPair", () => {
  it("finds the Daily Summary + Servings pair among a batch of files", async () => {
    const decoyPdf = path.resolve("fixtures/recipes/sourdough.md");
    const pair = await findNutritionPair([DAILY_SUMMARY, SERVINGS, decoyPdf]);

    expect(pair.dailySummaryPath).toBe(DAILY_SUMMARY);
    expect(pair.servingsPath).toBe(SERVINGS);
  });

  it("returns only the Daily Summary path when its sibling is missing", async () => {
    const pair = await findNutritionPair([DAILY_SUMMARY]);
    expect(pair.dailySummaryPath).toBe(DAILY_SUMMARY);
    expect(pair.servingsPath).toBeUndefined();
  });

  it("returns nothing when no CSVs are present", async () => {
    const pair = await findNutritionPair([path.resolve("fixtures/recipes/sourdough.md")]);
    expect(pair.dailySummaryPath).toBeUndefined();
    expect(pair.servingsPath).toBeUndefined();
  });

  it("ignores unrecognized CSV files", async () => {
    const badPath = path.resolve("fixtures/nutrition/unrelated.csv");
    await fs.mkdir(path.dirname(badPath), { recursive: true });
    await fs.writeFile(badPath, "Name,Value\na,1\n");

    const pair = await findNutritionPair([badPath]);
    expect(pair.dailySummaryPath).toBeUndefined();
    expect(pair.servingsPath).toBeUndefined();

    await fs.unlink(badPath);
  });
});
