import path from "node:path";
import { IngestError } from "./errors.js";
import type { DocumentType } from "./types.js";

// FR-1.7: auto-detection by file extension. Markdown is disambiguated between
// recipe/fitness by path convention (a `recipes/` or `fitness/` path segment,
// per README design decision #4/#11), matching how the M1 skeleton already
// expects sources to be laid out (see PRD.md §5.3 example: "recipes/sourdough-v3.md").
export function detectType(filePath: string, override?: DocumentType): DocumentType {
  if (override) return override;

  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") return "pdf";
  if (ext === ".txt" || ext === ".html" || ext === ".htm") return "kindle";

  if (ext === ".md") {
    const segments = filePath.split(path.sep).map((segment) => segment.toLowerCase());
    const isRecipe = segments.includes("recipes");
    const isFitness = segments.includes("fitness");
    if (isRecipe && !isFitness) return "recipe";
    if (isFitness && !isRecipe) return "fitness";
    throw IngestError.ambiguousType(filePath);
  }

  throw IngestError.ambiguousType(filePath);
}
