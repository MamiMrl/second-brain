import { describe, expect, it, vi } from "vitest";
import type { Db } from "mongodb";
import { formatMemoryPrompt, listMemoryEntries, writeMemoryEntry } from "./memory-store.js";
import type { MemoryEntry } from "./types.js";

function fakeDb() {
  const insertOne = vi.fn().mockResolvedValue({ insertedId: "id" });
  const sortMock = vi.fn();
  const find = vi.fn().mockReturnValue({ sort: sortMock });
  const db = { collection: vi.fn().mockReturnValue({ insertOne, find }) } as unknown as Db;
  return { db, insertOne, find, sortMock };
}

describe("writeMemoryEntry", () => {
  it("inserts a typed entry with its source refs and matching created/updated timestamps", async () => {
    const { db, insertOne } = fakeDb();
    await writeMemoryEntry(db, "profile", "vegetarian, avoids shellfish", ["conv1"]);

    const inserted = insertOne.mock.calls[0][0];
    expect(inserted.category).toBe("profile");
    expect(inserted.content).toBe("vegetarian, avoids shellfish");
    expect(inserted.sourceRefs).toEqual(["conv1"]);
    expect(inserted.createdAt).toBe(inserted.updatedAt);
    expect(inserted.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("listMemoryEntries", () => {
  it("queries the memory collection sorted oldest-first", async () => {
    const { db, find, sortMock } = fakeDb();
    sortMock.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) });

    await listMemoryEntries(db);

    expect(find).toHaveBeenCalledWith({});
    expect(sortMock).toHaveBeenCalledWith({ createdAt: 1 });
  });
});

function entry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    category: "profile",
    content: "vegetarian",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    sourceRefs: [],
    ...overrides,
  };
}

describe("formatMemoryPrompt", () => {
  it("returns an empty string when there are no entries", () => {
    expect(formatMemoryPrompt([])).toBe("");
  });

  it("groups entries under a labeled heading per category, in a fixed category order", () => {
    const prompt = formatMemoryPrompt([
      entry({ category: "synthesis", content: "skips breakfast on weekdays" }),
      entry({ category: "profile", content: "vegetarian" }),
      entry({ category: "goal", content: "in a strength-focused training block" }),
    ]);

    const profileIndex = prompt.indexOf("Profile");
    const goalIndex = prompt.indexOf("Goal");
    const synthesisIndex = prompt.indexOf("Synthesis");

    expect(profileIndex).toBeGreaterThan(-1);
    expect(profileIndex).toBeLessThan(goalIndex);
    expect(goalIndex).toBeLessThan(synthesisIndex);
    expect(prompt).toContain("- vegetarian");
    expect(prompt).toContain("- in a strength-focused training block");
    expect(prompt).toContain("- skips breakfast on weekdays");
  });

  it("omits categories with no entries", () => {
    const prompt = formatMemoryPrompt([entry({ category: "preference", content: "recipes under 30 min" })]);
    expect(prompt).not.toContain("Profile");
    expect(prompt).toContain("Preference");
  });
});
