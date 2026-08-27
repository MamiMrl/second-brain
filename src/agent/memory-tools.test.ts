import { describe, expect, it, vi } from "vitest";
import type { Db } from "mongodb";

const listMemoryEntriesMock = vi.fn();
const writeMemoryEntryMock = vi.fn();
vi.mock("../memory/memory-store.js", () => ({
  listMemoryEntries: (...args: unknown[]) => listMemoryEntriesMock(...args),
  writeMemoryEntry: (...args: unknown[]) => writeMemoryEntryMock(...args),
}));

const { readMemory, writeMemory } = await import("./memory-tools.js");

describe("readMemory", () => {
  it("wraps listMemoryEntries", async () => {
    listMemoryEntriesMock.mockResolvedValueOnce([{ category: "profile", content: "vegetarian" }]);
    const db = {} as Db;

    const result = await readMemory(db);

    expect(listMemoryEntriesMock).toHaveBeenCalledWith(db);
    expect(result).toEqual([{ category: "profile", content: "vegetarian" }]);
  });
});

describe("writeMemory", () => {
  it("wraps writeMemoryEntry with a single sourceRef", async () => {
    const db = {} as Db;

    await writeMemory(db, "goal", "training for a 10k", "conv1");

    expect(writeMemoryEntryMock).toHaveBeenCalledWith(db, "goal", "training for a 10k", ["conv1"]);
  });
});
