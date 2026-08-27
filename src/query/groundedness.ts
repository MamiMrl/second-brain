import { z } from "zod";
import { ChatAnthropic } from "@langchain/anthropic";
import { env } from "../lib/env.js";
import type { RetrievedChunk } from "./retriever.js";

// FR-3.3's abstention message, shared by every layer that decides to abstain.
export const ABSTAIN_MESSAGE = "I don't have information about that in your documents.";

// FR-3.3 layer (1): cheap score pre-filter. Vector search scores are cosine
// similarity in [0, 1] (MongoDBAtlasVectorSearch/@langchain/mongodb); below
// this, the top match isn't "similar enough" to be worth a generation call.
// Deliberately conservative — a real threshold is tuned against the FR-5.4
// eval set (FR-5.3), not picked here.
const MIN_TOP_SCORE = 0.3;

// FR-3.3 layer (1): skips generation outright on empty or too-weak retrieval,
// before any LLM call is made.
export function hasRetrievalSignal(chunks: RetrievedChunk[]): boolean {
  if (chunks.length === 0) return false;
  const topScore = Math.max(...chunks.map((c) => c.score ?? 0));
  return topScore >= MIN_TOP_SCORE;
}

const groundednessSchema = z.object({
  grounded: z
    .boolean()
    .describe("True only if every factual claim in ANSWER is directly supported by the SOURCE CHUNKS. False if ANSWER makes any claim the sources don't back up."),
});

const SYSTEM_PROMPT =
  "You are a strict groundedness judge. Given a question, a draft answer, and the source " +
  "chunks the answer was generated from, decide whether every factual claim in the answer " +
  "is directly supported by the source chunks. An answer that adds outside knowledge, " +
  "over-generalizes beyond what the sources state, or draws unsupported inferences is not grounded.";

// FR-3.3 layer (2): post-generation faithfulness check — the same check
// FR-5.3 reuses offline in the LangSmith evaluator. Runs after generateAnswer()
// produces a draft; an ungrounded draft is discarded by the caller in favor
// of ABSTAIN_MESSAGE, never returned to the user.
export async function isGrounded(question: string, answer: string, chunks: RetrievedChunk[], signal?: AbortSignal): Promise<boolean> {
  if (chunks.length === 0) return false;

  const model = new ChatAnthropic({ apiKey: env.anthropicApiKey(), model: env.claudeModel() });
  const structured = model.withStructuredOutput(groundednessSchema, { name: "groundedness_check" });

  const sourceSummary = chunks.map((chunk, i) => `[${i + 1}] ${chunk.text}`).join("\n\n");
  const result = await structured.invoke(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Question: ${question}\n\nAnswer: ${answer}\n\nSource chunks:\n${sourceSummary}` },
    ],
    { signal },
  );

  return result.grounded;
}
