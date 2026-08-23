import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { detectType } from "./detect-type.js";
import { IngestError } from "./errors.js";

describe("detectType — nutrition CSV sniffing (FR-7.1)", () => {
  it("detects a Cronometer Diary export by its column header shape", async () => {
    const type = await detectType(path.resolve("fixtures/nutrition/cronometer-diary-2026-08.csv"));
    expect(type).toBe("nutrition");
  });

  it("throws ambiguousType for a .csv without recognizable columns", async () => {
    const badPath = path.resolve("fixtures/nutrition/other.csv");
    await fs.writeFile(badPath, "Name,Value\na,1\n");

    await expect(detectType(badPath)).rejects.toThrow(IngestError);

    await fs.unlink(badPath);
  });

  it("respects an explicit --type override regardless of content", async () => {
    const type = await detectType(path.resolve("fixtures/nutrition/cronometer-diary-2026-08.csv"), "recipe");
    expect(type).toBe("recipe");
  });
});
