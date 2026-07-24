import { IngestError } from "../errors.js";
import type { DocumentType, LoadedDocument } from "../types.js";
import { loadPdf } from "./pdf.js";
import { loadRecipe } from "./recipe.js";
import { loadFitness } from "./fitness.js";

// M2 covers FR-1.1/1.2/1.3 (pdf/recipe/fitness); Kindle (FR-1.4) is M4.
export async function loadDocument(type: DocumentType, absPath: string, source: string): Promise<LoadedDocument> {
  switch (type) {
    case "pdf":
      return loadPdf(absPath, source);
    case "recipe":
      return loadRecipe(absPath, source);
    case "fitness":
      return loadFitness(absPath, source);
    case "kindle":
      throw IngestError.unsupportedType(source, type);
  }
}
