import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "mongodb";

const resolveChatRouteMock = vi.fn();
vi.mock("../agent/router.js", () => ({ resolveChatRoute: (...args: unknown[]) => resolveChatRouteMock(...args) }));

const answerChatAgenticallyMock = vi.fn();
vi.mock("../agent/chat-agent.js", () => ({ answerChatAgentically: (...args: unknown[]) => answerChatAgenticallyMock(...args) }));

const answerQueryMock = vi.fn();
vi.mock("../query/answer-query.js", () => ({ answerQuery: (...args: unknown[]) => answerQueryMock(...args) }));

const getConversationMock = vi.fn().mockResolvedValue(null);
const appendMessageMock = vi.fn().mockResolvedValue(undefined);
vi.mock("./conversations.js", () => ({
  getConversation: (...args: unknown[]) => getConversationMock(...args),
  appendMessage: (...args: unknown[]) => appendMessageMock(...args),
}));

const reflectOnTurnMock = vi.fn().mockResolvedValue(undefined);
vi.mock("../memory/reflect.js", () => ({ reflectOnTurn: (...args: unknown[]) => reflectOnTurnMock(...args) }));

const { handleChatTurn } = await import("./chat-turn.js");

describe("handleChatTurn routing", () => {
  beforeEach(() => {
    resolveChatRouteMock.mockClear();
    answerChatAgenticallyMock.mockClear();
    answerQueryMock.mockClear();
  });

  it("dispatches to the agentic path and tags the persisted message pipelinePath: agentic", async () => {
    resolveChatRouteMock.mockResolvedValueOnce("agentic");
    answerChatAgenticallyMock.mockResolvedValueOnce({
      kind: "generated",
      generated: { answer: "combined answer", references: [] },
      chunks: [],
    });

    const db = {} as Db;
    const message = await handleChatTurn(db, "conv1", "what should I cook combining fitness and nutrition?");

    expect(answerChatAgenticallyMock).toHaveBeenCalled();
    expect(answerQueryMock).not.toHaveBeenCalled();
    expect(message.pipelinePath).toBe("agentic");
    expect(message.text).toBe("combined answer");

    const persisted = appendMessageMock.mock.calls[1][2];
    expect(persisted.pipelinePath).toBe("agentic");
  });

  it("dispatches to the deterministic path for a single-document question", async () => {
    resolveChatRouteMock.mockResolvedValueOnce("deterministic");
    answerQueryMock.mockResolvedValueOnce({ kind: "abstain", reason: "no-signal" });

    const db = {} as Db;
    const message = await handleChatTurn(db, "conv1", "what's in my sourdough recipe?");

    expect(answerQueryMock).toHaveBeenCalled();
    expect(answerChatAgenticallyMock).not.toHaveBeenCalled();
    expect(message.pipelinePath).toBe("deterministic");
  });
});
