import type { Db } from "mongodb";
import { writeMemoryEntry } from "./memory-store.js";
import { synthesizeMemoryCandidate, type MemoryCandidate } from "./synthesize.js";

export type SynthesizeFn = (text: string, signal?: AbortSignal) => Promise<MemoryCandidate | null>;

// Shared by both memory triggers (reflect.ts's post-conversation-turn
// reflection, extract.ts's post-ingestion extraction) — same judge call,
// same write, different source text and sourceRef.
export async function captureMemory(db: Db, text: string, sourceRef: string, synthesize: SynthesizeFn = synthesizeMemoryCandidate): Promise<void> {
  const candidate = await synthesize(text);
  if (!candidate) return;
  await writeMemoryEntry(db, candidate.category, candidate.content, [sourceRef]);
}
