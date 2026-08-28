import { z } from "zod";
import { ChatAnthropic } from "@langchain/anthropic";
import { env } from "../lib/env.js";
import type { MemoryCategory } from "./types.js";

export interface MemoryCandidate {
  category: MemoryCategory;
  content: string;
}

const synthesisSchema = z.object({
  shouldStore: z
    .boolean()
    .describe("True only if TEXT reveals a durable, synthesized fact about the user worth remembering across sessions."),
  category: z
    .enum(["profile", "preference", "goal", "synthesis"])
    .describe(
      "profile: stable fact (diet, equipment, units). preference: how the assistant should behave. " +
        "goal: time-bounded objective inferred from a pattern. synthesis: cross-document/cross-turn derived insight.",
    ),
  content: z.string().describe("The synthesized statement to remember, written as a standalone fact, never a raw quote."),
});

// docs/research/user-memory-layer.md §4's exclusion list, enforced as the
// judge's own decision criteria rather than a separate filter pass —
// mirrors Mem0's Consolidation "NOOP on redundant/irrelevant" rule.
const SYSTEM_PROMPT =
  "You decide whether a piece of text reveals something worth permanently remembering about the user of a " +
  "personal document Q&A assistant. Apply this exclusion list strictly — set shouldStore to false unless ALL hold:\n" +
  "1. It is NOT a fact retrievable verbatim from a single document/chunk lookup (that's the retrieval system's job, not memory's).\n" +
  "2. It is a SYNTHESIZED/inferred statement, never a raw quote or excerpt.\n" +
  "3. It is durable across sessions, not session-scoped trivia (e.g. \"currently deciding between two recipes\" doesn't qualify).\n" +
  "4. If it touches health/diet, only store it as a reviewable, non-sensitive-phrased synthesis.\n" +
  "When in doubt, set shouldStore to false — a missed memory is far cheaper than a wrong or duplicated one.";

// Shared LLM boundary for both memory triggers (post-conversation-turn
// reflection in reflect.ts, post-ingestion extraction in extract.ts) — same
// judgment call, different source text, per docs/research/user-memory-
// layer.md §1's "background/reflection pattern, at two points" recommendation.
export async function synthesizeMemoryCandidate(text: string, signal?: AbortSignal): Promise<MemoryCandidate | null> {
  const model = new ChatAnthropic({ apiKey: env.anthropicApiKey(), model: env.claudeModel() });
  const structured = model.withStructuredOutput(synthesisSchema, { name: "memory_candidate" });

  const result = await structured.invoke(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text },
    ],
    { signal },
  );

  if (!result.shouldStore || result.content.trim().length === 0) return null;
  return { category: result.category, content: result.content };
}
