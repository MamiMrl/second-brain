import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadNutritionCsv } from "./nutrition.js";
import { IngestError } from "../errors.js";

const FIXTURE = path.resolve("fixtures/nutrition/cronometer-diary-2026-08.csv");
const SOURCE = "fixtures/nutrition/cronometer-diary-2026-08.csv";

describe("loadNutritionCsv", () => {
  it("produces one Document for the export batch", async () => {
    const { document } = await loadNutritionCsv(FIXTURE, SOURCE);

    expect(document.type).toBe("nutrition");
    expect(document.source).toBe(SOURCE);
    expect(document.contentHash).toBeTruthy();
  });

  it("produces one Chunk per logged day, aggregating foods and macros", async () => {
    const { chunks } = await loadNutritionCsv(FIXTURE, SOURCE);

    expect(chunks).toHaveLength(2);

    const day1 = chunks.find((c) => c.date === "2026-08-10");
    expect(day1).toBeDefined();
    expect(day1?.foods).toEqual([
      "Oats, rolled",
      "Blueberries, raw",
      "Chicken Breast, grilled",
      "Brown Rice, cooked",
    ]);
    expect(day1?.calories).toBeCloseTo(304 + 57 + 330 + 167);
    expect(day1?.protein).toBeCloseTo(10.6 + 0.7 + 62 + 3.9);
    expect(day1?.carbs).toBeCloseTo(48.9 + 12.1 + 0 + 33.9);
    expect(day1?.fat).toBeCloseTo(5.9 + 0.3 + 7.2 + 1.4);
    expect(day1?.text).toContain("2026-08-10");

    const day2 = chunks.find((c) => c.date === "2026-08-11");
    expect(day2?.foods).toEqual(["Greek Yogurt, plain", "Chicken Breast, grilled", "Lentil Soup"]);
  });

  it("throws a malformed-CSV IngestError when expected columns are missing", async () => {
    const badPath = path.resolve("fixtures/nutrition/malformed.csv");
    const fs = await import("node:fs/promises");
    await fs.mkdir(path.dirname(badPath), { recursive: true });
    await fs.writeFile(badPath, "Foo,Bar\n1,2\n");

    await expect(loadNutritionCsv(badPath, "fixtures/nutrition/malformed.csv")).rejects.toThrow(IngestError);

    await fs.unlink(badPath);
  });
});
