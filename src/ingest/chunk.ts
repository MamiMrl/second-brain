import { getEncoding } from "js-tiktoken";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

// No public Claude tokenizer ships as an npm package; cl100k_base (via
// js-tiktoken, already a transitive langchain dependency) is the standard
// stand-in token-count heuristic used across the RAG ecosystem for
// approximate chunk sizing — exactness doesn't matter here, consistency does.
const encoder = getEncoding("cl100k_base");

export function countTokens(text: string): number {
  return encoder.encode(text).length;
}

// FR-1.1: PDFs are chunked ~800-1200 tokens with ~150 token overlap.
const PDF_CHUNK_SIZE = 1000;
const PDF_CHUNK_OVERLAP = 150;

export async function splitPdfPageText(text: string): Promise<string[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: PDF_CHUNK_SIZE,
    chunkOverlap: PDF_CHUNK_OVERLAP,
    lengthFunction: countTokens,
  });
  return splitter.splitText(text);
}
