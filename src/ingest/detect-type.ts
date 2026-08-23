import fs from "node:fs/promises";
import path from "node:path";
import { IngestError } from "./errors.js";
import type { DocumentType } from "./types.js";

// FR-7.1: a Cronometer Diary export is recognized by its known column
// header shape, not by extension alone (many things are .csv). Sniffing
// only the first line keeps this cheap even for large exports.
async function isCronometerCsv(filePath: string): Promise<boolean> {
  let firstLine: string;
  try {
    const handle = await fs.open(filePath, "r");
    try {
      const { buffer, bytesRead } = await handle.read(Buffer.alloc(4096), 0, 4096, 0);
      firstLine = buffer.toString("utf8", 0, bytesRead).split(/\r?\n/, 1)[0] ?? "";
    } finally {
      await handle.close();
    }
  } catch {
    return false;
  }
  return firstLine.includes("Day") && firstLine.includes("Food Name") && firstLine.includes("Energy (kcal)");
}

// FR-1.7: auto-detection by file extension. Markdown is disambiguated between
// recipe/fitness by path convention (a `recipes/` or `fitness/` path segment,
// per README design decision #4/#11), matching how the M1 skeleton already
// expects sources to be laid out (see PRD.md §5.3 example: "recipes/sourdough-v3.md").
export async function detectType(filePath: string, override?: DocumentType): Promise<DocumentType> {
  if (override) return override;

  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") return "pdf";
  if (ext === ".txt" || ext === ".html" || ext === ".htm") return "kindle";
  if (ext === ".csv") {
    if (await isCronometerCsv(filePath)) return "nutrition";
    throw IngestError.ambiguousType(filePath);
  }

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
