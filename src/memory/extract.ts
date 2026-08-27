import type { Db } from "mongodb";
import { captureMemory, type SynthesizeFn } from "./capture.js";

// Trigger 2 of 2: post-ingestion extraction, run once a Document is
// confirmed (upserted) — the trigger point none of the researched consumer
// memory products need but second-brain does, since a lot of "who the user
// is" enters through ingestion rather than chat (docs/research/user-memory-
// layer.md §1).
export async function extractFromDocument(db: Db, documentId: string, title: string, text: string, synthesize?: SynthesizeFn): Promise<void> {
  await captureMemory(db, `Document: ${title}\n\n${text}`, documentId, synthesize);
}
