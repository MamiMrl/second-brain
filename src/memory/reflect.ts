import type { Db } from "mongodb";
import { captureMemory, type SynthesizeFn } from "./capture.js";

export type { SynthesizeFn };

// Trigger 1 of 2 (docs/research/user-memory-layer.md §1): post-conversation-
// turn reflection. Callers fire this without awaiting it — no per-turn
// hot-path write blocks the chat response (spec's "no per-turn hot-path
// writes blocking the response").
export async function reflectOnTurn(
  db: Db,
  conversationId: string,
  question: string,
  answer: string,
  synthesize?: SynthesizeFn,
): Promise<void> {
  await captureMemory(db, `Question: ${question}\n\nAnswer: ${answer}`, conversationId, synthesize);
}
