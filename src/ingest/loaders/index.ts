import path from "node:path";
import { IngestError } from "../errors.js";
import type { DocumentType, LoadedDocument } from "../types.js";
import { loadPdf } from "./pdf.js";
import { loadRecipe } from "./recipe.js";
import { loadFitness } from "./fitness.js";
import { loadNutritionScreenshot } from "./nutrition-screenshot.js";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

// M2 covers FR-1.1/1.2/1.3 (pdf/recipe/fitness); Kindle (FR-1.4) is M4;
// nutrition (FR-7.1/7.2) is M7 — CSV export primary, screenshot fallback,
// dispatched by extension since both share the "nutrition" DocumentType.
export async function loadDocument(type: DocumentType, absPath: string, source: string): Promise<LoadedDocument> {
  switch (type) {
    case "pdf":
      return loadPdf(absPath, source);
    case "recipe":
      return loadRecipe(absPath, source);
    case "fitness":
      return loadFitness(absPath, source);
    case "nutrition":
      if (IMAGE_EXTENSIONS.has(path.extname(absPath).toLowerCase())) return loadNutritionScreenshot(absPath, source);
      // CSV nutrition ingestion always pairs a Daily Summary + Servings
      // export (see pair-nutrition.ts) — reaching here means run.ts's
      // per-batch pairing found this file without its sibling.
      throw IngestError.nutritionCsvMissingPair(source);
    case "kindle":
      throw IngestError.unsupportedType(source, type);
  }
}
