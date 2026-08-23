import { describe, expect, it, vi } from "vitest";
import type { Db } from "mongodb";

const retrieveChunksMock = vi.fn();
vi.mock("../query/retriever.js", () => ({ retrieveChunks: (...args: unknown[]) => retrieveChunksMock(...args) }));

const { retrieveRecipes, getRecentNutrition } = await import("./nutrition-tools.js");

describe("retrieveRecipes", () => {
  it("wraps retrieveChunks with a fixed type=recipe filter", async () => {
    retrieveChunksMock.mockResolvedValueOnce([{ text: "lentil soup recipe" }]);
    const db = {} as Db;

    const result = await retrieveRecipes(db, "high protein dinner", 4);

    expect(retrieveChunksMock).toHaveBeenCalledWith(db, "high protein dinner", { type: "recipe" }, 4);
    expect(result).toEqual([{ text: "lentil soup recipe" }]);
  });
});

function fakeCollection(docs: unknown[]) {
  return {
    find: () => ({
      toArray: async () => docs,
      sort: () => ({ toArray: async () => docs }),
    }),
  };
}

describe("getRecentNutrition", () => {
  it("returns [] when no nutrition documents exist", async () => {
    const db = {
      collection: (name: string) => (name === "documents" ? fakeCollection([]) : fakeCollection([])),
    } as unknown as Db;

    const result = await getRecentNutrition(db);
    expect(result).toEqual([]);
  });

  it("joins nutrition documents to their chunks within the recency window", async () => {
    const documents = [{ _id: "doc1" }];
    const chunks = [
      { date: "2026-08-12", calories: 2100, protein: 140, carbs: 200, fat: 70, foods: ["Chicken", "Rice"] },
      { date: "2026-08-11", calories: 1950, protein: 130, carbs: 180, fat: 65, foods: ["Yogurt", "Lentil Soup"] },
    ];

    const db = {
      collection: (name: string) => (name === "documents" ? fakeCollection(documents) : fakeCollection(chunks)),
    } as unknown as Db;

    const result = await getRecentNutrition(db, 7);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      date: "2026-08-12",
      calories: 2100,
      protein: 140,
      carbs: 200,
      fat: 70,
      foods: ["Chicken", "Rice"],
    });
  });
});
