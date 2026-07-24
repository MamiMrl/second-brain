import path from "node:path";
import { detectLanguage } from "../language.js";
import { hashContent } from "../hash.js";
import { IngestError } from "../errors.js";
import type { LoadedDocument } from "../types.js";
import { readTextFile } from "./read-file.js";

const FITNESS_FILENAME = /^(\d{4}-\d{2}-\d{2})\.md$/;

// FR-1.3 / README design decision #4: one Document per day, free-form text,
// no structured schema in v1 — the date is the only guaranteed field, taken
// from the filename rather than parsed from the content.
export async function loadFitness(absPath: string, source: string): Promise<LoadedDocument> {
  const match = path.basename(absPath).match(FITNESS_FILENAME);
  if (!match) throw IngestError.fitnessFilenameInvalid(source);
  const date = match[1];

  const text = await readTextFile(absPath, source);

  return {
    document: {
      type: "fitness",
      title: `Fitness note — ${date}`,
      source,
      language: detectLanguage(text),
      date,
      contentHash: hashContent(text),
    },
    chunks: [{ text }],
  };
}
