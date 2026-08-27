import { describe, expect, it } from "vitest";
import { condenseFollowUp } from "./condense-question.js";

describe("condenseFollowUp", () => {
  it("returns the question unchanged with no history, without calling any model", async () => {
    // No FILTER_MODEL/Ollama/API key is configured in this test run — if this
    // took the model path it would throw or hang, not just return the wrong
    // value. Passing proves the `history.length === 0` branch short-circuits,
    // which is what guarantees first-turn behavior is unchanged (ticket #21).
    const result = await condenseFollowUp("What's in my sourdough recipe?", []);
    expect(result).toBe("What's in my sourdough recipe?");
  });
});
