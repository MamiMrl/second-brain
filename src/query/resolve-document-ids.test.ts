import { describe, expect, it, vi } from "vitest";
import type { Db } from "mongodb";
import { resolveDocumentIds } from "./resolve-document-ids.js";

function fakeDb(matches: Array<{ _id: string }>): { db: Db; find: ReturnType<typeof vi.fn> } {
  const find = vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue(matches) });
  const db = { collection: vi.fn().mockReturnValue({ find }) } as unknown as Db;
  return { db, find };
}

describe("resolveDocumentIds", () => {
  it("ignores a stray `book` filter when a non-Kindle type is already set", async () => {
    // Regression: the filter model can hallucinate `book` on a recipe/fitness
    // query despite its schema restricting it to Kindle. Left unguarded, the
    // resulting title/author $or ANDs against the correct type filter and
    // zeroes out every match.
    const { db, find } = fakeDb([{ _id: "doc1" }]);
    await resolveDocumentIds(db, { type: "recipe", book: "sourdough recipe" });

    const query = find.mock.calls[0][0];
    expect(query).toEqual({ type: "recipe" });
  });

  it("applies the book filter when type resolves to kindle", async () => {
    const { db, find } = fakeDb([{ _id: "doc1" }]);
    await resolveDocumentIds(db, { book: "Atomic Habits" });

    const query = find.mock.calls[0][0];
    expect(query.type).toBe("kindle");
    expect(query.$or).toEqual([
      { title: expect.any(RegExp) },
      { author: expect.any(RegExp) },
    ]);
  });

  it("returns undefined for an empty filter", async () => {
    const { db } = fakeDb([]);
    await expect(resolveDocumentIds(db, {})).resolves.toBeUndefined();
  });
});
