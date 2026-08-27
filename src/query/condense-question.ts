import { z } from "zod";
import { buildFilterModel } from "./filter-model.js";
import type { ConversationTurn } from "./types.js";

// Ticket #21: condense-then-retrieve, the industry-standard pattern
// (LangChain's create_history_aware_retriever, successor to the deprecated
// ConversationalRetrievalChain — see docs/research/chat-conversation-state.md
// §2.1) — one small LLM call rewrites a follow-up into a standalone question
// against recent history, then the rest of the pipeline runs single-turn
// against that rewrite, unmodified.
const standaloneQuestionSchema = z.object({
  standaloneQuestion: z
    .string()
    .describe(
      "The final question, rewritten to be fully understandable on its own: resolve any " +
        "pronoun, ellipsis, or implicit reference against the conversation history. Preserve " +
        "the asker's exact intent and scope — never answer it, add information, or narrow/widen " +
        "what it's asking. If it's already standalone, return it unchanged.",
    ),
});

const SYSTEM_PROMPT =
  "You rewrite a follow-up question into a standalone question, given the conversation that " +
  "led up to it, for a personal document library (recipes, fitness notes, Kindle highlights, PDFs).";

function formatHistory(history: ConversationTurn[]): string {
  return history.map((turn) => `${turn.role}: ${turn.text}`).join("\n");
}

// Ticket #21: history.length === 0 short-circuits with no model call at
// all — the acceptance criterion that a first-turn question behaves
// identically to today's single-turn `ask` depends on this path never
// touching the question.
export async function condenseFollowUp(question: string, history: ConversationTurn[], signal?: AbortSignal): Promise<string> {
  if (history.length === 0) return question;

  const model = buildFilterModel();
  const structured = model.withStructuredOutput(standaloneQuestionSchema, { name: "standalone_question" });
  const result = await structured.invoke(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Conversation so far:\n${formatHistory(history)}\n\nFollow-up question: ${question}` },
    ],
    { signal },
  );

  return result.standaloneQuestion;
}
