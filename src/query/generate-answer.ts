import Anthropic from "@anthropic-ai/sdk";
import { env } from "../lib/env.js";
import type { RetrievedChunk } from "./retriever.js";

const MAX_TOKENS = 1024;

export interface Reference {
  number: number;
  title: string;
  ref: string; // type-specific: "p. 12" for pdf, "highlighted 2026-05-01" for kindle, source path otherwise
  citedText: string[]; // FR-3.2 "cited_text shown on demand" — unique spans attributed to this document
}

export interface GeneratedAnswer {
  answer: string; // inline [1]-style markers after each cited span
  references: Reference[];
}

const SYSTEM_PROMPT =
  "You answer questions about the user's personal document library (recipes, fitness notes, " +
  "Kindle highlights, PDFs) using only the documents provided below — never outside knowledge. " +
  "Answer in the same language the question was asked in, translating from the source documents " +
  "if needed, unless that would misrepresent them.";

// FR-3.2: page for pdf, highlight date for kindle — other types cite by source path.
function formatSourceRef(chunk: RetrievedChunk): string {
  if (chunk.type === "pdf" && chunk.page !== undefined) return `p. ${chunk.page}`;
  if (chunk.type === "kindle" && chunk.highlightDate !== undefined) return `highlighted ${chunk.highlightDate}`;
  return chunk.source;
}

function hasDocumentIndex(citation: Anthropic.TextCitation): citation is Extract<Anthropic.TextCitation, { document_index: number }> {
  return "document_index" in citation;
}

// FR-3.2: walks the response's text blocks in order, appending each block's
// text followed by numbered markers for any citations it carries. Reference
// numbers are assigned on first appearance and reused for repeat citations
// of the same chunk, per Anthropic's per-block `citations` array (native
// Citations API — see FR-3.2, not a custom post-hoc formatter).
function renderAnswer(blocks: Anthropic.TextBlock[], chunks: RetrievedChunk[]): GeneratedAnswer {
  const referenceByDocumentIndex = new Map<number, Reference>();
  let answer = "";

  for (const block of blocks) {
    answer += block.text;

    const markers = new Set<number>();
    for (const citation of block.citations ?? []) {
      if (!hasDocumentIndex(citation)) continue; // only web/search-result citations lack one — never produced here, no tools enabled
      const chunk = chunks[citation.document_index];
      if (!chunk) continue; // defensive: an out-of-range index shouldn't discard an otherwise-complete answer

      let reference = referenceByDocumentIndex.get(citation.document_index);
      if (!reference) {
        reference = { number: referenceByDocumentIndex.size + 1, title: chunk.title, ref: formatSourceRef(chunk), citedText: [] };
        referenceByDocumentIndex.set(citation.document_index, reference);
      }
      if (!reference.citedText.includes(citation.cited_text)) reference.citedText.push(citation.cited_text);
      markers.add(reference.number);
    }

    if (markers.size > 0) answer += [...markers].sort((a, b) => a - b).map((n) => `[${n}]`).join("");
  }

  return { answer, references: [...referenceByDocumentIndex.values()] };
}

// FR-3.1/3.2/3.4: standard (non-existence) generation path. Consumes
// retrieveChunks() output, passes each chunk as a `type: "document"` content
// block with `citations: {enabled: true}` — Anthropic's native Citations
// API, not a custom post-hoc citation matcher. `document_index` on each
// returned citation is positional over these blocks in request order, so it
// maps directly back to `chunks[document_index]`.
//
// Uses the raw @anthropic-ai/sdk client rather than @langchain/anthropic's
// ChatAnthropic: verified that ChatAnthropic's non-streaming path
// (anthropicResponseToChatMessages) collapses a single-text-block response
// to a plain string, silently dropping its `citations` array — a real risk
// for short, single-citation answers, which are a common shape here.
export async function generateAnswer(question: string, chunks: RetrievedChunk[], signal?: AbortSignal): Promise<GeneratedAnswer> {
  const client = new Anthropic({ apiKey: env.anthropicApiKey() });

  const documents: Anthropic.DocumentBlockParam[] = chunks.map((chunk) => ({
    type: "document",
    source: { type: "text", media_type: "text/plain", data: chunk.text },
    title: chunk.title,
    citations: { enabled: true },
  }));

  const response = await client.messages.create(
    {
      model: env.claudeModel(),
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: [...documents, { type: "text", text: question }] }],
    },
    { signal },
  );

  const textBlocks = response.content.filter((block): block is Anthropic.TextBlock => block.type === "text");
  return renderAnswer(textBlocks, chunks);
}
