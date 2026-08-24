import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadKindleClippings } from "./kindle.js";
import { IngestError } from "../errors.js";

const CLIPPINGS = path.resolve("fixtures/kindle/My Clippings.txt");
const SOURCE = "fixtures/kindle/My Clippings.txt";

// Written under the OS tmpdir, not fixtures/kindle/, so these transient
// scratch files can never be picked up by run.test.ts's parseAll(fixtures/kindle)
// walk if it happens to run concurrently in another vitest worker.
async function withTempFile<T>(
  content: string | Buffer,
  fn: (absPath: string, source: string) => Promise<T>,
  extension = ".txt",
): Promise<T> {
  const absPath = path.join(os.tmpdir(), `kindle-loader-test-${Math.random().toString(36).slice(2)}${extension}`);
  await fs.writeFile(absPath, content);
  try {
    return await fn(absPath, "fixtures/kindle/My Clippings.txt");
  } finally {
    await fs.unlink(absPath);
  }
}

describe("loadKindleClippings", () => {
  it("produces one Document per book, capturing title and author", async () => {
    const docs = await loadKindleClippings(CLIPPINGS, SOURCE);

    expect(docs).toHaveLength(2);
    const titles = docs.map((d) => d.document.title);
    expect(titles).toContain("Atomic Habits");
    expect(titles).toContain("La Sombra del Viento");

    const atomicHabits = docs.find((d) => d.document.title === "Atomic Habits")!;
    expect(atomicHabits.document.type).toBe("kindle");
    expect(atomicHabits.document.author).toBe("James Clear");
  });

  it("produces one Chunk per highlight, carrying highlightDate", async () => {
    const docs = await loadKindleClippings(CLIPPINGS, SOURCE);
    const atomicHabits = docs.find((d) => d.document.title === "Atomic Habits")!;

    expect(atomicHabits.chunks).toHaveLength(2);
    for (const chunk of atomicHabits.chunks) {
      expect(chunk.highlightDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("dedupes extended-highlight duplicates by substring, keeping the fuller text", async () => {
    const docs = await loadKindleClippings(CLIPPINGS, SOURCE);
    const atomicHabits = docs.find((d) => d.document.title === "Atomic Habits")!;

    const texts = atomicHabits.chunks.map((c) => c.text);
    expect(texts.some((t) => t.includes("Small habits compound into remarkable results"))).toBe(true);
    // The truncated original ("...with your current results.") must not survive as its own chunk.
    expect(texts.filter((t) => t.startsWith("You should be far more concerned"))).toHaveLength(1);
  });

  it("merges a Note onto the highlight it annotates, into the chunk text", async () => {
    const docs = await loadKindleClippings(CLIPPINGS, SOURCE);
    const atomicHabits = docs.find((d) => d.document.title === "Atomic Habits")!;

    const annotated = atomicHabits.chunks.find((c) => c.text.includes("My note:"));
    expect(annotated?.text).toContain("This is the book's whole thesis");
  });

  it("drops empty-body Bookmark entries without producing a chunk or erroring", async () => {
    const docs = await loadKindleClippings(CLIPPINGS, SOURCE);
    const atomicHabits = docs.find((d) => d.document.title === "Atomic Habits")!;

    // Fixture has 1 bookmark among Atomic Habits' entries; it must not appear as a chunk.
    expect(atomicHabits.chunks.every((c) => c.text.trim().length > 0)).toBe(true);
  });

  it("handles a localized (Spanish) header without erroring", async () => {
    const docs = await loadKindleClippings(CLIPPINGS, SOURCE);
    const book = docs.find((d) => d.document.title === "La Sombra del Viento")!;

    expect(book.document.language).toBe("es");
    expect(book.chunks).toHaveLength(1);
    expect(book.chunks[0].text).toContain("Todo lo que sucede en el mundo");
  });

  it("derives a stable, per-book source so a cumulative re-export merges into the same Book Document", async () => {
    const v1 = `Atomic Habits (James Clear)
- Your Highlight on page 34 | location 512-514 | Added on Monday, June 12, 2023 8:45:03 PM

First highlight.
==========
`;
    const v2 = `Atomic Habits (James Clear)
- Your Highlight on page 34 | location 512-514 | Added on Monday, June 12, 2023 8:45:03 PM

First highlight.
==========
Atomic Habits (James Clear)
- Your Highlight on page 90 | location 1300-1302 | Added on Wednesday, June 14, 2023 6:00:00 AM

A newly added highlight from an updated cumulative export.
==========
`;

    const [docsV1, docsV2] = await Promise.all([
      withTempFile(v1, (absPath, source) => loadKindleClippings(absPath, source)),
      withTempFile(v2, (absPath, source) => loadKindleClippings(absPath, source)),
    ]);

    // withTempFile passes the same logical `source` for both calls (simulating
    // re-ingesting the same My Clippings.txt path with newer content) — the
    // derived per-book Document source must match exactly so upsertDocument
    // (keyed on `source`) updates the existing Book rather than creating a
    // second one.
    expect(docsV1[0].document.source).toBe(docsV2[0].document.source);
    expect(docsV1[0].chunks).toHaveLength(1);
    expect(docsV2[0].chunks).toHaveLength(2);
  });

  it("throws a Kindle-format IngestError for an unrecognized entry type/locale", async () => {
    const bad = `Some German Book (Some Author)
- Ihre Markierung auf Seite 10 | Position 200-201 | Hinzugefügt am Montag, 1. Mai 2023 10:00:00

Unbekannter Eintragstyp.
==========
`;
    await withTempFile(bad, async (absPath, source) => {
      await expect(loadKindleClippings(absPath, source)).rejects.toThrow(IngestError);
    });
  });

  it("throws a Kindle-format IngestError for content with no recognizable clippings structure", async () => {
    await withTempFile("just some random text\nwith no separators at all\n", async (absPath, source) => {
      await expect(loadKindleClippings(absPath, source)).rejects.toThrow(IngestError);
    });
  });

  it("throws when every entry is a bookmark (no highlights or notes to ingest)", async () => {
    const onlyBookmarks = `Some Book (Some Author)
- Your Bookmark on page 1 | location 1 | Added on Monday, June 12, 2023 8:45:03 PM


==========
`;
    await withTempFile(onlyBookmarks, async (absPath, source) => {
      await expect(loadKindleClippings(absPath, source)).rejects.toThrow(IngestError);
    });
  });

  it("throws emptyFile for an empty export", async () => {
    await withTempFile("", async (absPath, source) => {
      await expect(loadKindleClippings(absPath, source)).rejects.toThrow(IngestError);
    });
  });

  it("throws kindleEncodingInvalid for a UTF-16 encoded export", async () => {
    const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("Title (Author)\r\n", "utf16le")]);
    await withTempFile(utf16, async (absPath, source) => {
      await expect(loadKindleClippings(absPath, source)).rejects.toThrow(IngestError);
    });
  });

  it("throws a not-supported-yet IngestError for an HTML Kindle export, without misreporting it as corrupt", async () => {
    await withTempFile(
      "<html><body>Kindle Notebook export</body></html>",
      async (absPath, source) => {
        await expect(loadKindleClippings(absPath, source)).rejects.toThrow(/not supported yet/i);
      },
      ".html",
    );
  });
});
