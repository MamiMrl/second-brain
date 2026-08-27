import { describe, expect, it, vi, afterEach } from "vitest";
import type { Db } from "mongodb";
import { createChatServer } from "./server.js";
import type { Conversation } from "./types.js";
import type { ChatTurnResult } from "./chat-turn.js";
import type { PipelineOptions } from "../query/answer-query.js";
import { readSseEvents } from "./sse-test-support.js";

const FAKE_DB = {} as Db;

async function startServer(deps: Partial<Parameters<typeof createChatServer>[0]> = {}) {
  const server = createChatServer({
    db: FAKE_DB,
    createConversation: vi.fn().mockResolvedValue("conv123"),
    handleChatTurn: vi.fn(),
    getConversation: vi.fn(),
    ...deps,
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("server did not bind to a port");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

describe("createChatServer", () => {
  let server: Awaited<ReturnType<typeof startServer>>["server"] | undefined;

  afterEach(() => {
    server?.close();
    server = undefined;
  });

  it("POST /conversations creates a conversation and returns its id", async () => {
    const createConversation = vi.fn().mockResolvedValue("conv123");
    const started = await startServer({ createConversation });
    server = started.server;

    const response = await fetch(`${started.baseUrl}/conversations`, { method: "POST" });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({ conversationId: "conv123" });
    expect(createConversation).toHaveBeenCalledWith(FAKE_DB);
  });

  it("POST /conversations/:id/messages runs a chat turn and returns the assistant message", async () => {
    const assistantMessage: ChatTurnResult = {
      role: "assistant",
      text: "Complexity is caused by dependencies and obscurity.[1]",
      timestamp: "2026-08-26T00:00:00.000Z",
      citedChunks: [{ documentId: "doc1", chunkIndex: 0 }],
      references: [{ number: 1, title: "Atomic Habits", ref: "highlighted 2026-05-01", citedText: ["quote"] }],
      pipelinePath: "deterministic",
    };
    const handleChatTurn = vi.fn().mockResolvedValue(assistantMessage);
    const started = await startServer({ handleChatTurn });
    server = started.server;

    const response = await fetch(`${started.baseUrl}/conversations/conv123/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "What causes complexity?" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(assistantMessage);
    expect(handleChatTurn).toHaveBeenCalledWith(
      FAKE_DB,
      "conv123",
      "What causes complexity?",
      expect.objectContaining({ signal: expect.any(AbortSignal), onStep: expect.any(Function) }),
    );
  });

  it("streams a status event per pipeline step, then a final answer event, on the conversation's SSE stream", async () => {
    const assistantMessage: ChatTurnResult = {
      role: "assistant",
      text: "Complexity is caused by dependencies and obscurity.[1]",
      timestamp: "2026-08-26T00:00:00.000Z",
      citedChunks: [{ documentId: "doc1", chunkIndex: 0 }],
      references: [{ number: 1, title: "Atomic Habits", ref: "highlighted 2026-05-01", citedText: ["quote"] }],
      pipelinePath: "deterministic",
    };
    const handleChatTurn = vi.fn(async (_db: Db, _id: string, _q: string, options: PipelineOptions = {}) => {
      options.onStep?.("resolving-filters");
      options.onStep?.("generating-answer");
      return assistantMessage;
    });
    const started = await startServer({ handleChatTurn });
    server = started.server;

    const streamResponse = await fetch(`${started.baseUrl}/conversations/conv123/stream`);
    expect(streamResponse.headers.get("content-type")).toContain("text/event-stream");

    await fetch(`${started.baseUrl}/conversations/conv123/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "What causes complexity?" }),
    });

    const events = await readSseEvents(streamResponse, (events) => events.length >= 3);
    expect(events).toEqual([
      { event: "status", data: { step: "resolving-filters" } },
      { event: "status", data: { step: "generating-answer" } },
      { event: "answer", data: assistantMessage },
    ]);
  });

  it("aborts the in-flight chat turn when the client disconnects mid-question", async () => {
    let capturedSignal: AbortSignal | undefined;
    const handleChatTurn = vi.fn((_db: Db, _id: string, _q: string, options: PipelineOptions = {}) => {
      capturedSignal = options.signal;
      return new Promise<ChatTurnResult>((_resolve, reject) => {
        options.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    });
    const started = await startServer({ handleChatTurn });
    server = started.server;

    const clientController = new AbortController();
    const pending = fetch(`${started.baseUrl}/conversations/conv123/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "What causes complexity?" }),
      signal: clientController.signal,
    }).catch(() => {}); // the client's own fetch also rejects on abort — not what this test checks

    await vi.waitFor(() => expect(handleChatTurn).toHaveBeenCalled());
    clientController.abort();
    await pending;

    await vi.waitFor(() => expect(capturedSignal?.aborted).toBe(true));
  });

  it("returns 400 when the message body has no question", async () => {
    const started = await startServer();
    server = started.server;

    const response = await fetch(`${started.baseUrl}/conversations/conv123/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });

  it("GET /conversations/:id returns the conversation", async () => {
    const conversation: Conversation = {
      _id: "conv123",
      messages: [],
      createdAt: "2026-08-26T00:00:00.000Z",
      updatedAt: "2026-08-26T00:00:00.000Z",
    };
    const getConversation = vi.fn().mockResolvedValue(conversation);
    const started = await startServer({ getConversation });
    server = started.server;

    const response = await fetch(`${started.baseUrl}/conversations/conv123`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(conversation);
  });

  it("returns 404 for an unknown route", async () => {
    const started = await startServer();
    server = started.server;

    const response = await fetch(`${started.baseUrl}/nope`);
    expect(response.status).toBe(404);
  });
});
