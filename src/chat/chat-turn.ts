import type { Db } from "mongodb";
import { answerQuery, type AskResult, type PipelineOptions } from "../query/answer-query.js";
import { ABSTAIN_MESSAGE } from "../query/groundedness.js";
import { appendMessage, getConversation } from "./conversations.js";
import type { ChatMessage } from "./types.js";
import type { Reference } from "../query/generate-answer.js";
import type { ConversationTurn } from "../query/types.js";
import { reflectOnTurn } from "../memory/reflect.js";

// `references` is display-ready citation detail (title/ref/citedText, per
// generate-answer.ts's Reference) for the frontend to render inline markers
// and a source list — deliberately NOT part of ChatMessage, which only
// persists the auditing-oriented citedChunks (documentId/chunkIndex), per
// ticket #19's persistence schema. handleChatTurn returns both; only the
// ChatMessage fields get written to Mongo.
export interface ChatTurnResult extends ChatMessage {
  references: Reference[];
}

// Maps answerQuery()'s result onto the persisted message shape (spec:
// https://github.com/MamiMrl/second-brain/issues/19). Existence/abstain
// results carry no citedChunks/references — existence already has its own,
// differently shaped citation format (existence-answer.ts), and abstain has
// no chunks to cite by definition.
export function toAssistantMessage(result: AskResult): ChatTurnResult {
  const timestamp = new Date().toISOString();
  const base = { role: "assistant" as const, timestamp, pipelinePath: "deterministic" as const };

  if (result.kind === "abstain") {
    return { ...base, text: ABSTAIN_MESSAGE, citedChunks: [], references: [] };
  }

  if (result.kind === "existence") {
    return { ...base, text: result.existence.answer, citedChunks: [], references: [] };
  }

  return {
    ...base,
    text: result.generated.answer,
    citedChunks: result.chunks.map((chunk) => ({ documentId: chunk.documentId, chunkIndex: chunk.chunkIndex })),
    references: result.generated.references,
  };
}

// Chat-turn orchestration entry point (ticket #19, history-aware per ticket
// #21): given an existing conversation and a new user message, reads the
// conversation's prior messages (if any) as history for answerQuery()'s
// filter-resolution step, then persists both the user's question and the
// finalized assistant answer as messages on that conversation.
export async function handleChatTurn(
  db: Db,
  conversationId: string,
  question: string,
  options: PipelineOptions = {},
): Promise<ChatTurnResult> {
  const conversation = await getConversation(db, conversationId);
  const history: ConversationTurn[] = (conversation?.messages ?? []).map((message) => ({
    role: message.role,
    text: message.text,
  }));

  const userMessage: ChatMessage = {
    role: "user",
    text: question,
    timestamp: new Date().toISOString(),
    citedChunks: [],
    pipelinePath: "deterministic",
  };
  await appendMessage(db, conversationId, userMessage);

  const result = await answerQuery(db, question, history, {}, options);
  const assistantMessage = toAssistantMessage(result);
  const { references, ...toPersist } = assistantMessage;
  await appendMessage(db, conversationId, toPersist);

  // Ticket #23's post-conversation-turn reflection trigger. Only "generated"
  // turns carry a real answer worth reflecting on (abstain/existence have
  // no synthesized content). Fired without awaiting — the spec's "no
  // per-turn hot-path writes blocking the response" — so a slow or failed
  // reflection call never delays or breaks the chat response.
  if (result.kind === "generated") {
    void reflectOnTurn(db, conversationId, question, assistantMessage.text).catch(() => {});
  }

  return assistantMessage;
}
