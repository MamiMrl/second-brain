import { describe, expect, it } from "vitest";
import { toAssistantMessage } from "./chat-turn.js";
import { ABSTAIN_MESSAGE } from "../query/groundedness.js";
import type { AskResult } from "../query/answer-query.js";
import type { RetrievedChunk } from "../query/retriever.js";

function chunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    type: "kindle",
    title: "Atomic Habits",
    source: "kindle/My Clippings.txt",
    language: "en",
    contentHash: "hash",
    text: "chunk text",
    documentId: "doc1",
    chunkIndex: 0,
    ...overrides,
  };
}

describe("toAssistantMessage", () => {
  it("maps an abstain result to the shared abstain message with no cited chunks", () => {
    const result: AskResult = { kind: "abstain", reason: "no-signal" };
    const message = toAssistantMessage(result);

    expect(message.role).toBe("assistant");
    expect(message.text).toBe(ABSTAIN_MESSAGE);
    expect(message.citedChunks).toEqual([]);
    expect(message.references).toEqual([]);
    expect(message.pipelinePath).toBe("deterministic");
    expect(message.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("maps an existence result to its confident answer text with no cited chunks", () => {
    const result: AskResult = {
      kind: "existence",
      existence: { answer: "No, you don't have one.", scannedCount: 3, sources: [] },
    };
    const message = toAssistantMessage(result);

    expect(message.text).toBe("No, you don't have one.");
    expect(message.citedChunks).toEqual([]);
    expect(message.references).toEqual([]);
    expect(message.pipelinePath).toBe("deterministic");
  });

  it("maps a generated result to its answer text, citedChunks for persistence, and display-ready references", () => {
    const references = [{ number: 1, title: "Atomic Habits", ref: "highlighted 2026-05-01", citedText: ["quote"] }];
    const result: AskResult = {
      kind: "generated",
      generated: { answer: "Complexity is caused by dependencies and obscurity.[1]", references },
      chunks: [chunk({ documentId: "doc1", chunkIndex: 2 }), chunk({ documentId: "doc2", chunkIndex: 0 })],
    };
    const message = toAssistantMessage(result);

    expect(message.text).toBe("Complexity is caused by dependencies and obscurity.[1]");
    expect(message.citedChunks).toEqual([
      { documentId: "doc1", chunkIndex: 2 },
      { documentId: "doc2", chunkIndex: 0 },
    ]);
    expect(message.references).toEqual(references);
    expect(message.pipelinePath).toBe("deterministic");
  });
});
