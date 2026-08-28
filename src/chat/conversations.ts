import type { Db } from "mongodb";
import { ObjectId } from "mongodb";
import type { ChatMessage, Conversation, ConversationSummary } from "./types.js";

const TITLE_MAX_LENGTH = 60;

// Ticket #19: one document per conversation, messages appended into an
// embedded array (not a separate per-message collection) — chosen for
// single-user scale, per the map's Conversation/thread persistence schema
// decision (https://github.com/MamiMrl/second-brain/issues/17).

interface ConversationDoc {
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

function conversationsCollection(db: Db) {
  return db.collection<ConversationDoc>("conversations");
}

export async function createConversation(db: Db): Promise<string> {
  const now = new Date();
  const result = await conversationsCollection(db).insertOne({ messages: [], createdAt: now, updatedAt: now });
  return String(result.insertedId);
}

// Messages are appended only once fully finalized — the caller never writes
// in-flight streaming/status state here (see #13/#17's decisions).
export async function appendMessage(db: Db, conversationId: string, message: ChatMessage): Promise<void> {
  await conversationsCollection(db).updateOne(
    { _id: new ObjectId(conversationId) },
    { $push: { messages: message }, $set: { updatedAt: new Date() } },
  );
}

function titleFor(doc: ConversationDoc): string {
  const firstUserMessage = doc.messages.find((message) => message.role === "user");
  if (!firstUserMessage) return "New conversation";
  const text = firstUserMessage.text;
  return text.length > TITLE_MAX_LENGTH ? `${text.slice(0, TITLE_MAX_LENGTH)}…` : text;
}

// Ticket #22: the sidebar's recent-conversations list, newest-updated first.
export async function listConversations(db: Db): Promise<ConversationSummary[]> {
  const docs = await conversationsCollection(db).find().sort({ updatedAt: -1 }).toArray();
  return docs.map((doc) => ({
    _id: String(doc._id),
    title: titleFor(doc),
    updatedAt: doc.updatedAt.toISOString(),
  }));
}

export async function getConversation(db: Db, conversationId: string): Promise<Conversation | null> {
  const doc = await conversationsCollection(db).findOne({ _id: new ObjectId(conversationId) });
  if (!doc) return null;
  return {
    _id: String(doc._id),
    messages: doc.messages,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
