import { describe, expect, it, vi } from "vitest";
import type { Db } from "mongodb";

const retrieveChunksMock = vi.fn();
vi.mock("../query/retriever.js", () => ({ retrieveChunks: (...args: unknown[]) => retrieveChunksMock(...args) }));

const resolveDocumentIdsMock = vi.fn();
vi.mock("../query/resolve-document-ids.js", () => ({ resolveDocumentIds: (...args: unknown[]) => resolveDocumentIdsMock(...args) }));

const scanBoundedChunksMock = vi.fn();
vi.mock("../query/exhaustive-scan.js", () => ({ scanBoundedChunks: (...args: unknown[]) => scanBoundedChunksMock(...args) }));

const { searchDocuments, checkExistence } = await import("./chat-tools.js");

describe("searchDocuments", () => {
  it("wraps retrieveChunks with the type/book/dateRange filter, no new retrieval logic", async () => {
    retrieveChunksMock.mockResolvedValueOnce([{ text: "quinoa bowl recipe" }]);
    const db = {} as Db;

    const result = await searchDocuments(db, { query: "protein dinner", type: "recipe" });

    expect(retrieveChunksMock).toHaveBeenCalledWith(db, "protein dinner", { type: "recipe", book: undefined, dateRange: undefined }, 6);
    expect(result).toEqual([{ text: "quinoa bowl recipe" }]);
  });

  it("passes a custom k through unchanged", async () => {
    retrieveChunksMock.mockResolvedValueOnce([]);
    const db = {} as Db;

    await searchDocuments(db, { query: "salt", dateRange: { start: "2026-01-01" } }, 3);

    expect(retrieveChunksMock).toHaveBeenCalledWith(db, "salt", { type: undefined, book: undefined, dateRange: { start: "2026-01-01" } }, 3);
  });
});

describe("checkExistence", () => {
  it("resolves document ids for the filter then scans every chunk in that set", async () => {
    resolveDocumentIdsMock.mockResolvedValueOnce(["doc1", "doc2"]);
    scanBoundedChunksMock.mockResolvedValueOnce([{ text: "chunk" }]);
    const db = {} as Db;

    const result = await checkExistence(db, { type: "recipe" });

    expect(resolveDocumentIdsMock).toHaveBeenCalledWith(db, { type: "recipe", book: undefined });
    expect(scanBoundedChunksMock).toHaveBeenCalledWith(db, ["doc1", "doc2"]);
    expect(result).toEqual([{ text: "chunk" }]);
  });

  it("scans an empty set when the filter resolves no bounded category", async () => {
    resolveDocumentIdsMock.mockResolvedValueOnce(undefined);
    scanBoundedChunksMock.mockResolvedValueOnce([]);
    const db = {} as Db;

    const result = await checkExistence(db, {});

    expect(scanBoundedChunksMock).toHaveBeenCalledWith(db, []);
    expect(result).toEqual([]);
  });
});
