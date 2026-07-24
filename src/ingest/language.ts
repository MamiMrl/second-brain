import { franc } from "franc";

// franc returns ISO 639-3; the schema (PRD.md §5.3) stores ISO 639-1 ("en" | "tr" | ...).
// Only the languages this personal corpus is expected to contain are mapped —
// extend this table if new languages show up in practice.
const ISO_639_3_TO_1: Record<string, string> = {
  eng: "en",
  tur: "tr",
  deu: "de",
  fra: "fr",
  spa: "es",
  ita: "it",
  nld: "nl",
  por: "pt",
  rus: "ru",
};

const DEFAULT_LANGUAGE = "en";

// FR-1.6: language detection per document. Short texts (a one-line fitness
// note, a single ingredient) are often below franc's reliable-detection
// threshold and come back "und" (undetermined) — fall back to the corpus's
// dominant language rather than storing a meaningless tag.
export function detectLanguage(text: string): string {
  const code3 = franc(text, { minLength: 10 });
  if (code3 === "und") return DEFAULT_LANGUAGE;
  return ISO_639_3_TO_1[code3] ?? code3;
}
