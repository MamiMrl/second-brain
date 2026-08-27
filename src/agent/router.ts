import { z } from "zod";
import { buildFilterModel } from "../query/filter-model.js";

export type ChatRoute = "deterministic" | "agentic";

// Ticket #24: mirrors the existing ROUTE decision point in answer-query.ts
// (isExistenceQuery), one level up — a cheap structured-output classification
// deciding whether a chat message needs the single-pass deterministic
// pipeline or the open-ended agentic loop, per docs/research/agentic-vs-
// deterministic-query-pipeline.md §4's recommendation to route by task shape,
// not to replace the deterministic path.
const routeSchema = z.object({
  needsAgenticReasoning: z
    .boolean()
    .describe(
      "True only if the question requires reasoning across multiple document domains/types (e.g. combining " +
        "fitness notes and nutrition), open-ended planning (e.g. 'what should I cook this week given my notes'), " +
        "or an unpredictable number of retrieval steps. False for a single-document factual lookup answerable by " +
        "one retrieval and one generation.",
    ),
});

const SYSTEM_PROMPT =
  "You decide whether a question asked against a personal document library (recipes, fitness notes, Kindle " +
  "highlights, PDFs, nutrition logs) needs open-ended, multi-domain reasoning, or whether it's a single-document " +
  "factual lookup. When in doubt, prefer the single-document classification — it's the cheaper, more predictable path.";

export async function resolveChatRoute(question: string, signal?: AbortSignal): Promise<ChatRoute> {
  const model = buildFilterModel();
  const structured = model.withStructuredOutput(routeSchema, { name: "chat_route" });
  const result = await structured.invoke(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: question },
    ],
    { signal },
  );

  return result.needsAgenticReasoning ? "agentic" : "deterministic";
}
