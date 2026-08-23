import { describe, expect, it, vi } from "vitest";
import type { Db } from "mongodb";
import { ensureVectorIndexReady } from "./ensure-index.js";

function fakeDb(indexes: Array<{ queryable: boolean; status: string }>): Db {
  return {
    collection: vi.fn().mockReturnValue({
      listSearchIndexes: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue(indexes) }),
    }),
  } as unknown as Db;
}

describe("ensureVectorIndexReady", () => {
  it("resolves when the index exists and is queryable", async () => {
    const db = fakeDb([{ queryable: true, status: "READY" }]);
    await expect(ensureVectorIndexReady(db, "chunks", "chunks_vector_index")).resolves.toBeUndefined();
  });

  it("throws when the index does not exist", async () => {
    const db = fakeDb([]);
    await expect(ensureVectorIndexReady(db, "chunks", "chunks_vector_index")).rejects.toThrow(
      /does not exist on collection "chunks"/,
    );
  });

  it("throws when the index exists but is not queryable yet", async () => {
    const db = fakeDb([{ queryable: false, status: "BUILDING" }]);
    await expect(ensureVectorIndexReady(db, "chunks", "chunks_vector_index")).rejects.toThrow(/not queryable yet/);
  });
});
