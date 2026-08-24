import { z } from "zod";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOllama } from "@langchain/ollama";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { env } from "../lib/env.js";

// FR-2.2 / FR-2.4: the query-time LLM pre-step. One structured-output call
// produces both the retrieval filter and the existence/negation
// classification (PRD.md §5.2 PRESTEP node) — they're extracted together
// because both read the same signal (what the question is asking about).
export const inferredFilterSchema = z.object({
  type: z
    .enum(["recipe", "fitness", "kindle", "pdf", "nutrition"])
    .optional()
    .describe(
      "Restrict to this document type only if the question clearly implies one " +
        "(mentions a recipe, a workout/exercise, a book, or a food/nutrition log). Omit if ambiguous or the question could span multiple types.",
    ),
  dateRange: z
    .object({
      start: z.string().optional().describe("Inclusive start date, ISO YYYY-MM-DD."),
      end: z.string().optional().describe("Inclusive end date, ISO YYYY-MM-DD."),
    })
    .optional()
    .describe(
      "Only set when the question references a specific date, month, or period " +
        "(e.g. 'in March', 'last week'). Omit otherwise — do not guess a range.",
    ),
  book: z
    .string()
    .optional()
    .describe(
      "Book title or author mentioned in the question, for Kindle highlight queries " +
        "(e.g. 'Atomic Habits'). Omit if no book or author is mentioned.",
    ),
  isExistenceQuery: z
    .boolean()
    .describe(
      "True if the question asks whether something exists, how many there are, or which items " +
        "match a criterion (e.g. 'do I have...', 'how many...', 'which of my...'). " +
        "False for questions asking to explain, recall, or summarize content.",
    ),
});

export type InferredFilter = z.infer<typeof inferredFilterSchema>;

const SYSTEM_PROMPT =
  "You extract search filters from a question asked against a personal document library " +
  "(recipes, fitness notes, Kindle highlights, PDFs). Only set a field when the question " +
  'clearly implies it — never guess. Leaving a field unset means "search everything," which ' +
  "is the safe default when unsure.";

// FR-2.2: FILTER_MODEL default is a local Qwen3-8B via Ollama; swappable to
// Haiku/others. Anthropic model ids are the one non-Ollama case this needs
// to recognize — anything else is assumed to be a local Ollama model name.
function buildFilterModel(): BaseChatModel {
  const model = env.filterModel();
  if (model.startsWith("claude-")) {
    return new ChatAnthropic({ apiKey: env.anthropicApiKey(), model });
  }
  return new ChatOllama({ baseUrl: env.ollamaBaseUrl(), model });
}

export async function inferFilters(question: string): Promise<InferredFilter> {
  const model = buildFilterModel();
  const structured = model.withStructuredOutput(inferredFilterSchema, { name: "query_filters" });
  return structured.invoke([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: question },
  ]);
}
