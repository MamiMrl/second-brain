import { describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
const withStructuredOutputMock = vi.fn().mockReturnValue({ invoke: invokeMock });
vi.mock("../query/filter-model.js", () => ({
  buildFilterModel: () => ({ withStructuredOutput: withStructuredOutputMock }),
}));

const { resolveChatRoute } = await import("./router.js");

describe("resolveChatRoute", () => {
  it("routes to agentic when the classifier says the question needs multi-domain reasoning", async () => {
    invokeMock.mockResolvedValueOnce({ needsAgenticReasoning: true });

    const route = await resolveChatRoute("what should I cook this week given my fitness notes and recent nutrition?");

    expect(route).toBe("agentic");
  });

  it("routes to deterministic for a single-document factual question", async () => {
    invokeMock.mockResolvedValueOnce({ needsAgenticReasoning: false });

    const route = await resolveChatRoute("what's the ratio of flour to water in my sourdough recipe?");

    expect(route).toBe("deterministic");
  });
});
