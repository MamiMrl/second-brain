import { describe, expect, it, vi } from "vitest";
import type { Db } from "mongodb";
import { reflectOnTurn } from "./reflect.js";

function fakeDb() {
  const insertOne = vi.fn().mockResolvedValue({ insertedId: "id" });
  const db = { collection: vi.fn().mockReturnValue({ insertOne }) } as unknown as Db;
  return { db, insertOne };
}

describe("reflectOnTurn", () => {
  it("writes a memory entry tagged with the conversation id when the judge says to store", async () => {
    const { db, insertOne } = fakeDb();
    const synthesize = vi.fn().mockResolvedValue({ category: "profile", content: "vegetarian" });

    await reflectOnTurn(db, "conv1", "What should I eat?", "Here's a vegetarian option.", synthesize);

    expect(synthesize).toHaveBeenCalledWith(expect.stringContaining("What should I eat?"));
    const inserted = insertOne.mock.calls[0][0];
    expect(inserted.category).toBe("profile");
    expect(inserted.content).toBe("vegetarian");
    expect(inserted.sourceRefs).toEqual(["conv1"]);
  });

  it("writes nothing when the judge declines", async () => {
    const { db, insertOne } = fakeDb();
    const synthesize = vi.fn().mockResolvedValue(null);

    await reflectOnTurn(db, "conv1", "What's the weather?", "I can't help with that.", synthesize);

    expect(insertOne).not.toHaveBeenCalled();
  });
});
