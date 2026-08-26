import type { Db } from "mongodb";
import { ObjectId } from "mongodb";
import type { ChatMessage, Conversation } from "./types.js";

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
