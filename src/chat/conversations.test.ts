import { describe, expect, it, vi } from "vitest";
import type { Db } from "mongodb";
import { ObjectId } from "mongodb";
import { appendMessage, createConversation, listConversations } from "./conversations.js";
import type { ChatMessage } from "./types.js";

function fakeDb() {
  const insertOne = vi.fn().mockResolvedValue({ insertedId: new ObjectId() });
  const updateOne = vi.fn().mockResolvedValue({ matchedCount: 1 });
  const db = { collection: vi.fn().mockReturnValue({ insertOne, updateOne }) } as unknown as Db;
  return { db, insertOne, updateOne };
}

function fakeDbForFind(docs: unknown[]) {
  const sort = vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue(docs) });
  const find = vi.fn().mockReturnValue({ sort });
  const db = { collection: vi.fn().mockReturnValue({ find }) } as unknown as Db;
  return { db, find, sort };
}

describe("createConversation", () => {
  it("inserts a new conversation with an empty message array", async () => {
    const { db, insertOne } = fakeDb();
    await createConversation(db);

    const inserted = insertOne.mock.calls[0][0];
    expect(inserted.messages).toEqual([]);
    expect(inserted.createdAt).toBeInstanceOf(Date);
    expect(inserted.updatedAt).toBeInstanceOf(Date);
  });

  it("returns the new conversation's id as a string", async () => {
    const { db } = fakeDb();
    const id = await createConversation(db);
    expect(typeof id).toBe("string");
  });
});

describe("appendMessage", () => {
  it("pushes the message onto the conversation's embedded array, keyed by _id", async () => {
    const { db, updateOne } = fakeDb();
    const conversationId = new ObjectId().toString();
    const message: ChatMessage = {
      role: "user",
      text: "hello",
      timestamp: "2026-08-26T00:00:00.000Z",
      citedChunks: [],
      pipelinePath: "deterministic",
    };

    await appendMessage(db, conversationId, message);

    const [filter, update] = updateOne.mock.calls[0];
    expect(filter._id.toString()).toBe(conversationId);
    expect(update.$push.messages).toEqual(message);
    expect(update.$set.updatedAt).toBeInstanceOf(Date);
  });
});

describe("listConversations", () => {
  it("sorts by most recently updated first", async () => {
    const { db, sort } = fakeDbForFind([]);
    await listConversations(db);
    expect(sort).toHaveBeenCalledWith({ updatedAt: -1 });
  });

  it("titles a conversation from its first user message, truncated", async () => {
    const id = new ObjectId();
    const longQuestion = "a".repeat(100);
    const { db } = fakeDbForFind([
      {
        _id: id,
        messages: [
          { role: "user", text: longQuestion, timestamp: "t", citedChunks: [], pipelinePath: "deterministic" },
          { role: "assistant", text: "answer", timestamp: "t", citedChunks: [], pipelinePath: "deterministic" },
        ],
        createdAt: new Date("2026-08-26T00:00:00.000Z"),
        updatedAt: new Date("2026-08-27T00:00:00.000Z"),
      },
    ]);

    const [summary] = await listConversations(db);

    expect(summary).toEqual({
      _id: id.toString(),
      title: "a".repeat(60) + "…",
      updatedAt: "2026-08-27T00:00:00.000Z",
    });
  });

  it("titles an empty conversation as 'New conversation'", async () => {
    const id = new ObjectId();
    const { db } = fakeDbForFind([
      { _id: id, messages: [], createdAt: new Date("2026-08-26T00:00:00.000Z"), updatedAt: new Date("2026-08-26T00:00:00.000Z") },
    ]);

    const [summary] = await listConversations(db);

    expect(summary.title).toBe("New conversation");
  });
});
