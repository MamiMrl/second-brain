import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { IngestError } from "../errors.js";
import { hashContent } from "../hash.js";
import { env } from "../../lib/env.js";
import type { LoadedDocument } from "../types.js";
import { readFileBuffer } from "./read-file.js";
import { summarizeNutritionDay } from "./nutrition-format.js";

type ImageMediaType = "image/jpeg" | "image/png" | "image/webp";

const MEDIA_TYPES: Record<string, ImageMediaType> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const nutritionDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  foods: z.array(z.string()).min(1),
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
});

export type NutritionDay = z.infer<typeof nutritionDaySchema>;
export type TranscribeScreenshot = (imageBase64: string, mediaType: ImageMediaType) => Promise<string>;

const TRANSCRIBE_PROMPT =
  "This is a screenshot of a nutrition-tracking app's daily summary. Respond with ONLY a JSON object " +
  '(no markdown fences, no commentary) matching exactly: {"date": "YYYY-MM-DD", "foods": string[], ' +
  '"calories": number, "protein": number, "carbs": number, "fat": number}. Use the date visible in the ' +
  "screenshot; if no date is visible, use today's date. Protein/carbs/fat are grams.";

// FR-7.2: screenshot fallback for when the user hasn't done a Cronometer CSV
// export. A Claude vision call transcribes the image directly into the same
// nutrition Chunk shape loadNutritionCsv produces (nutrition.ts), so
// downstream code (retrieval, the agent) never needs to know which path a
// given day's data came from. Deliberately a separate loader path, not OCR
// bolted onto the CSV loader — no verified image-ingestion precedent exists
// elsewhere in the codebase yet, and this ingest-time transcription is a
// scoped exception to the project's usual Source Artifact -> human-reviewed
// Transcription -> Document pipeline (CONTEXT.md), accepted for v1 scope.
async function defaultTranscribe(imageBase64: string, mediaType: ImageMediaType): Promise<string> {
  const client = new Anthropic({ apiKey: env.anthropicApiKey() });
  const response = await client.messages.create({
    model: env.claudeModel(),
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: TRANSCRIBE_PROMPT },
        ],
      },
    ],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("vision call returned no text content");
  return block.text;
}

export async function loadNutritionScreenshot(
  absPath: string,
  source: string,
  transcribe: TranscribeScreenshot = defaultTranscribe,
): Promise<LoadedDocument> {
  const ext = path.extname(absPath).toLowerCase();
  const mediaType = MEDIA_TYPES[ext];
  if (!mediaType) throw IngestError.nutritionScreenshotUnrecognized(source);

  const buffer = await readFileBuffer(absPath, source);
  const imageBase64 = buffer.toString("base64");

  let day: NutritionDay;
  try {
    const raw = await transcribe(imageBase64, mediaType);
    day = nutritionDaySchema.parse(JSON.parse(stripCodeFences(raw)));
  } catch (err) {
    throw IngestError.nutritionScreenshotUnrecognized(source, err);
  }

  const text = summarizeNutritionDay(day);

  return {
    document: {
      type: "nutrition",
      title: `Nutrition diary — ${day.date}`,
      source,
      language: "en",
      sourceArtifact: source,
      contentHash: hashContent(text),
    },
    chunks: [
      {
        text,
        date: day.date,
        calories: day.calories,
        protein: day.protein,
        carbs: day.carbs,
        fat: day.fat,
        foods: day.foods,
      },
    ],
  };
}

function stripCodeFences(raw: string): string {
  return raw.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
}
