import path from "node:path";
import { detectLanguage } from "../language.js";
import { hashContent } from "../hash.js";
import type { LoadedDocument } from "../types.js";
import { readTextFile } from "./read-file.js";

const TITLE_HEADING = /^#\s+(.+)$/;
const INGREDIENTS_HEADING = /^#{1,3}\s*ingredients\b/i;
const STEPS_HEADING = /^#{1,3}\s*(steps|instructions|method)\b/i;
const ANY_HEADING = /^#{1,3}\s+/;

function extractSection(lines: string[], headingPattern: RegExp): string[] | undefined {
  const startIndex = lines.findIndex((line) => headingPattern.test(line.trim()));
  if (startIndex === -1) return undefined;

  const items: string[] = [];
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (ANY_HEADING.test(line)) break;
    if (line.length === 0) continue;
    items.push(line.replace(/^[-*]\s+|^\d+[.)]\s+/, ""));
  }
  return items.length > 0 ? items : undefined;
}

// FR-1.2: one Document per recipe. Recipes are already-transcribed Markdown
// by the time `ingest` sees them (photo/voice -> draft -> human review is a
// separate pipeline, per README design decision #3 — out of scope here).
// Title + ingredients/steps are kept in metadata where present in the file.
export async function loadRecipe(absPath: string, source: string): Promise<LoadedDocument> {
  const text = await readTextFile(absPath, source);
  const lines = text.split("\n");

  const titleLine = lines.map((line) => line.trim()).find((line) => TITLE_HEADING.test(line));
  const title = titleLine
    ? (titleLine.match(TITLE_HEADING)?.[1] ?? titleLine)
    : path.basename(absPath, path.extname(absPath));

  return {
    document: {
      type: "recipe",
      title,
      source,
      language: detectLanguage(text),
      contentHash: hashContent(text),
    },
    chunks: [
      {
        text,
        ingredients: extractSection(lines, INGREDIENTS_HEADING),
        steps: extractSection(lines, STEPS_HEADING),
      },
    ],
  };
}
