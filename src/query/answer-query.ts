import type { Db } from "mongodb";
import { resolveQueryFilters } from "./resolve-filters.js";
import { answerExistenceQuery } from "./answer-existence-query.js";
import { retrieveChunks } from "./retriever.js";
import { generateAnswer, type GeneratedAnswer } from "./generate-answer.js";
import { hasRetrievalSignal, isGrounded } from "./groundedness.js";
import { readMemoryPrompt } from "../memory/memory-store.js";
import type { ExistenceAnswer } from "./existence-answer.js";
import type { CliFilterOverrides, ConversationTurn } from "./types.js";
import type { RetrievedChunk } from "./retriever.js";

export type AskResult =
  | { kind: "existence"; existence: ExistenceAnswer }
  | { kind: "abstain"; reason: "no-signal" | "ungrounded" }
  // `chunks` is exposed alongside `generated` so callers can see exactly
  // which chunks the answer was grounded in, without re-running retrieval.
  | { kind: "generated"; generated: GeneratedAnswer; chunks: RetrievedChunk[] };

// Ticket #20: named checkpoints a caller (the chat SSE endpoint) can surface
// as live status, one per pipeline node in ask-component.md's flowchart that
// does real work. GATE1 (hasRetrievalSignal) has no step of its own — it's
// an in-memory check with no perceptible latency.
export type PipelineStep = "resolving-filters" | "searching-documents" | "generating-answer" | "checking-groundedness";

export interface PipelineOptions {
  // Aborts the in-flight Claude call (generation, groundedness, filter
  // inference, or existence-answer) when the caller disconnects — ticket
  // #20's "don't let the upstream call run to completion unread".
  signal?: AbortSignal;
  onStep?: (step: PipelineStep) => void;
}

// FR-4.1 entry point: resolves filters + existence routing (FR-2.2/2.4),
// then either the existence-scan path (bypasses FR-3.3, per FR-2.4) or the
// standard retrieve+generate path, gated by FR-3.3's two inline groundedness
// layers — layer (3), the offline LangSmith run, is FR-5.3's concern.
//
// Ticket #21: `history` only feeds resolveQueryFilters (condense-then-
// retrieve). Everything after filter resolution uses `resolved
// .standaloneQuestion` instead of the raw `question` — per
// docs/research/chat-conversation-state.md §3, existence routing,
// retrieval, generation, and groundedness stay single-turn, unmodified,
// operating on whichever one standalone question this turn resolved to.
export async function answerQuery(
  db: Db,
  question: string,
  history: ConversationTurn[] = [],
  overrides: CliFilterOverrides = {},
  options: PipelineOptions = {},
): Promise<AskResult> {
  const { signal, onStep } = options;

  onStep?.("resolving-filters");
  const resolved = await resolveQueryFilters(question, history, overrides, signal);
  const { standaloneQuestion } = resolved;

  onStep?.("searching-documents");
  const existence = await answerExistenceQuery(db, standaloneQuestion, resolved, options);
  if (existence) return { kind: "existence", existence };

  const chunks = await retrieveChunks(db, standaloneQuestion, resolved.filter);
  if (!hasRetrievalSignal(chunks)) return { kind: "abstain", reason: "no-signal" };

  onStep?.("generating-answer");
  // Ticket #23: system-prompt prepend of durable, synthesized facts about
  // the user — no new retrieval step, per docs/research/user-memory-layer
  // .md §3 (kept separate from retrieveChunks()'s vector search above).
  const memoryPrompt = await readMemoryPrompt(db);
  const generated = await generateAnswer(standaloneQuestion, chunks, memoryPrompt, signal);

  onStep?.("checking-groundedness");
  if (!(await isGrounded(standaloneQuestion, generated.answer, chunks, signal))) return { kind: "abstain", reason: "ungrounded" };

  return { kind: "generated", generated, chunks };
}
