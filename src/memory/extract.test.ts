import { describe, expect, it, vi } from "vitest";
import type { Db } from "mongodb";
import { extractFromDocument } from "./extract.js";

function fakeDb() {
  const insertOne = vi.fn().mockResolvedValue({ insertedId: "id" });
  const db = { collection: vi.fn().mockReturnValue({ insertOne }) } as unknown as Db;
  return { db, insertOne };
}

describe("extractFromDocument", () => {
  it("writes a memory entry tagged with the document id when the judge says to store", async () => {
    const { db, insertOne } = fakeDb();
    const synthesize = vi.fn().mockResolvedValue({ category: "synthesis", content: "recurring pasta theme" });

    await extractFromDocument(db, "doc1", "Weekly Recipes", "pasta, pasta, more pasta", synthesize);

    expect(synthesize).toHaveBeenCalledWith(expect.stringContaining("Weekly Recipes"));
    const inserted = insertOne.mock.calls[0][0];
    expect(inserted.category).toBe("synthesis");
    expect(inserted.sourceRefs).toEqual(["doc1"]);
  });

  it("writes nothing when the judge declines", async () => {
    const { db, insertOne } = fakeDb();
    const synthesize = vi.fn().mockResolvedValue(null);

    await extractFromDocument(db, "doc1", "Single Recipe", "just one recipe", synthesize);

    expect(insertOne).not.toHaveBeenCalled();
  });
});
