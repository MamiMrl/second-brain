import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadNutritionScreenshot } from "./nutrition-screenshot.js";
import { IngestError } from "../errors.js";

const IMAGE_PATH = path.resolve("fixtures/nutrition/screenshot-2026-08-12.png");

describe("loadNutritionScreenshot", () => {
  it("transcribes a stubbed vision response into a nutrition Document/Chunk", async () => {
    await fs.writeFile(IMAGE_PATH, Buffer.from([0x89, 0x50, 0x4e, 0x47])); // minimal PNG-ish bytes, content is irrelevant since transcribe is stubbed

    const stubTranscribe = async () =>
      JSON.stringify({
        date: "2026-08-12",
        foods: ["Oatmeal", "Banana"],
        calories: 350,
        protein: 12,
        carbs: 60,
        fat: 6,
      });

    const { document, chunks } = await loadNutritionScreenshot(
      IMAGE_PATH,
      "fixtures/nutrition/screenshot-2026-08-12.png",
      stubTranscribe,
    );

    expect(document.type).toBe("nutrition");
    expect(document.sourceArtifact).toBe("fixtures/nutrition/screenshot-2026-08-12.png");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].date).toBe("2026-08-12");
    expect(chunks[0].foods).toEqual(["Oatmeal", "Banana"]);
    expect(chunks[0].calories).toBe(350);

    await fs.unlink(IMAGE_PATH);
  });

  it("throws an IngestError when the vision response isn't parseable JSON", async () => {
    await fs.writeFile(IMAGE_PATH, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const stubTranscribe = async () => "sorry, I can't read this image";

    await expect(
      loadNutritionScreenshot(IMAGE_PATH, "fixtures/nutrition/screenshot-2026-08-12.png", stubTranscribe),
    ).rejects.toThrow(IngestError);

    await fs.unlink(IMAGE_PATH);
  });

  it("throws an IngestError for an unrecognized file extension", async () => {
    const badPath = path.resolve("fixtures/nutrition/screenshot.bmp");
    await fs.writeFile(badPath, Buffer.from([0]));

    await expect(loadNutritionScreenshot(badPath, "fixtures/nutrition/screenshot.bmp")).rejects.toThrow(IngestError);

    await fs.unlink(badPath);
  });
});
