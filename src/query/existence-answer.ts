import { ChatAnthropic } from "@langchain/anthropic";
import { env } from "../lib/env.js";
import type { RetrievedChunk } from "./retriever.js";

export interface ExistenceAnswer {
  answer: string;
  scannedCount: number;
  sources: { title: string; source: string }[];
}

const SYSTEM_PROMPT =
  "You answer existence/negation questions (e.g. \"do I have...\", \"how many...\", " +
  '"which of my...") against a COMPLETE list of every matching chunk in the user\'s ' +
  "personal document library — not a similarity-ranked sample. Because the list is " +
  "complete, state your presence/absence conclusion with full confidence: if nothing " +
  "in the list matches, say so plainly (e.g. \"No, you don't have...\") rather than " +
  "hedging with 'I couldn't find'. Base every claim only on the provided chunks and " +
  "cite the source title for anything you rely on. Never use outside knowledge.";

// FR-2.4 CONFIDENT: generates the presence/absence claim from the complete
// scan, bypassing FR-3.3's groundedness gate (that gate models confidence
// from similarity search, which doesn't apply to an exhaustive scan).
// Cites sources as a plain title/source list, not the Anthropic Citations
// API's cited_text spans — that's FR-3.2, scoped to the standard GEN path.
// Revisit unifying the two if ANSWER's shared citation format (PRD.md
// §5.2) turns out to need it here too.
export async function generateExistenceAnswer(question: string, chunks: RetrievedChunk[], signal?: AbortSignal): Promise<ExistenceAnswer> {
  const model = new ChatAnthropic({ apiKey: env.anthropicApiKey(), model: env.claudeModel() });

  const scanSummary =
    chunks.length === 0
      ? "(no chunks matched the bounded category)"
      : chunks.map((chunk, i) => `[${i + 1}] ${chunk.title} (${chunk.source})\n${chunk.text}`).join("\n\n");

  const response = await model.invoke(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Question: ${question}\n\nComplete scan result (${chunks.length} chunk(s)):\n${scanSummary}` },
    ],
    { signal },
  );

  const answer = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
  const sources = [...new Map(chunks.map((c) => [c.source, { title: c.title, source: c.source }])).values()];

  return { answer, scannedCount: chunks.length, sources };
}
