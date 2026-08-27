import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "mongodb";

const searchDocumentsMock = vi.fn();
const checkExistenceMock = vi.fn();
vi.mock("./chat-tools.js", () => ({
  searchDocuments: (...args: unknown[]) => searchDocumentsMock(...args),
  checkExistence: (...args: unknown[]) => checkExistenceMock(...args),
}));

const buildGetRecentNutritionToolMock = vi.fn().mockReturnValue({ name: "getRecentNutrition", handler: async () => ({ content: [] }) });
vi.mock("./nutrition-tools.js", () => ({ buildGetRecentNutritionTool: (...args: unknown[]) => buildGetRecentNutritionToolMock(...args) }));

const readMemoryMock = vi.fn();
const writeMemoryMock = vi.fn();
vi.mock("./memory-tools.js", () => ({
  readMemory: (...args: unknown[]) => readMemoryMock(...args),
  writeMemory: (...args: unknown[]) => writeMemoryMock(...args),
}));

const isGroundedMock = vi.fn();
vi.mock("../query/groundedness.js", () => ({ isGrounded: (...args: unknown[]) => isGroundedMock(...args) }));

interface FakeTool {
  name: string;
  handler: (args: unknown, extra: unknown) => Promise<unknown>;
}

interface FakeQueryCall {
  prompt: string;
  options: { mcpServers: { chat: { tools: FakeTool[] } } };
}

let queryImpl: (call: FakeQueryCall) => AsyncGenerator<unknown>;
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  createSdkMcpServer: (config: unknown) => config,
  tool: (name: string, _description: string, _schema: unknown, handler: FakeTool["handler"]) => ({ name, handler }),
  query: (call: FakeQueryCall) => queryImpl(call),
}));

const { answerChatAgentically } = await import("./chat-agent.js");

function findTool(call: FakeQueryCall, toolName: string): FakeTool {
  const found = call.options.mcpServers.chat.tools.find((t) => t.name === toolName);
  if (!found) throw new Error(`tool ${toolName} not registered`);
  return found;
}

describe("answerChatAgentically", () => {
  beforeEach(() => {
    searchDocumentsMock.mockClear();
    checkExistenceMock.mockClear();
    isGroundedMock.mockClear();
  });

  it("accumulates chunks across searchDocuments tool calls and returns a generated result when grounded", async () => {
    const chunk = { documentId: "doc1", chunkIndex: 0, title: "Grilled Chicken and Quinoa Bowl", text: "recipe text" };
    searchDocumentsMock.mockResolvedValueOnce([chunk]);
    isGroundedMock.mockResolvedValueOnce(true);

    queryImpl = async function* (call) {
      const searchTool = findTool(call, "searchDocuments");
      await searchTool.handler({ query: "protein dinner", type: "recipe" }, undefined);
      yield { type: "result", subtype: "success", result: "Try the Grilled Chicken and Quinoa Bowl." };
    };

    const db = {} as Db;
    const question = "what should I cook combining my fitness notes and recent nutrition?";
    const result = await answerChatAgentically(db, "conv1", question);

    expect(result.kind).toBe("generated");
    if (result.kind !== "generated") throw new Error("expected generated");
    expect(result.generated.answer).toBe("Try the Grilled Chicken and Quinoa Bowl.");
    expect(result.chunks).toEqual([chunk]);
    expect(isGroundedMock).toHaveBeenCalledWith(question, "Try the Grilled Chicken and Quinoa Bowl.", [chunk], undefined);
  });

  // Ticket #24 acceptance criterion: an agentic-path answer unsupported by
  // any tool result is discarded in favor of the abstain message.
  it("discards an ungrounded answer in favor of abstain, even though the agent produced text", async () => {
    isGroundedMock.mockResolvedValueOnce(false);

    queryImpl = async function* () {
      yield { type: "result", subtype: "success", result: "A fabricated recommendation no tool call backed up." };
    };

    const db = {} as Db;
    const result = await answerChatAgentically(db, "conv1", "what should I cook?");

    expect(result).toEqual({ kind: "abstain", reason: "ungrounded" });
  });

  it("abstains without running the groundedness check when the loop produces no result message", async () => {
    queryImpl = async function* () {};

    const db = {} as Db;
    const result = await answerChatAgentically(db, "conv1", "what should I cook?");

    expect(result).toEqual({ kind: "abstain", reason: "ungrounded" });
    expect(isGroundedMock).not.toHaveBeenCalled();
  });
});
