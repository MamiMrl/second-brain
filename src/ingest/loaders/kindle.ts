import path from "node:path";
import { readMyClippingsFile, groupToBooks } from "@hadynz/kindle-clippings";
import { detectLanguage } from "../language.js";
import { hashContent } from "../hash.js";
import { IngestError } from "../errors.js";
import type { ChunkFields, LoadedDocument } from "../types.js";
import { readFileBuffer } from "./read-file.js";

const HTML_EXTENSIONS = new Set([".html", ".htm"]);

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const UTF16LE_BOM = Buffer.from([0xff, 0xfe]);
const UTF16BE_BOM = Buffer.from([0xfe, 0xff]);

// FR-1.8 "non-UTF8/BOM encoding": older Kindle firmware wrote My
// Clippings.txt as UTF-16, which readTextFile's unconditional UTF-8 decode
// would silently turn into mojibake rather than an error.
function decodeClippingsText(buffer: Buffer, source: string): string {
  if (buffer.subarray(0, 2).equals(UTF16LE_BOM) || buffer.subarray(0, 2).equals(UTF16BE_BOM)) {
    throw IngestError.kindleEncodingInvalid(source);
  }
  const body = buffer.subarray(0, 3).equals(UTF8_BOM) ? buffer.subarray(3) : buffer;
  const text = body.toString("utf8");
  if (text.trim().length === 0) throw IngestError.emptyFile(source);
  return text;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics (e.g. "Zafón" -> "Zafon") so accented titles/authors still slug to readable, stable ASCII
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatHighlightDate(date: Date | undefined): string | undefined {
  return date ? date.toISOString().slice(0, 10) : undefined;
}

// CONTEXT.md: the Book is the Document, each highlight is one Chunk. My
// Clippings.txt is a cumulative, single-file export spanning every book on
// the device, so — unlike every other loader — this one fans a single
// source file out into multiple LoadedDocuments (one per book), which is
// why it's dispatched separately in run.ts's parseAll rather than through
// loaders/index.ts's 1-file-to-1-document table.
export async function loadKindleClippings(absPath: string, source: string): Promise<LoadedDocument[]> {
  // FR-1.4 also names Amazon's HTML "Kindle Notebook" export as a valid
  // Kindle source, and FR-1.7 already auto-detects .html/.htm as kindle —
  // but it's a structurally different format @hadynz/kindle-clippings
  // doesn't parse. Fail with an honest "not supported yet" rather than
  // running it through the clippings parser and reporting it as corrupt.
  if (HTML_EXTENSIONS.has(path.extname(absPath).toLowerCase())) throw IngestError.kindleHtmlNotSupported(source);

  const buffer = await readFileBuffer(absPath, source);
  const text = decodeClippingsText(buffer, source);

  let parsedBlocks: ReturnType<typeof readMyClippingsFile>;
  try {
    parsedBlocks = readMyClippingsFile(text);
  } catch (err) {
    throw IngestError.kindleUnrecognizedFormat(source, err);
  }
  if (parsedBlocks.length === 0) throw IngestError.kindleUnrecognizedFormat(source);

  // An UNKNOWN entry type means the "highlight/note/bookmark" header phrase
  // didn't match any of the library's known locales (en/es/fr/it/pt/zh) —
  // a genuinely unrecognized export, not one of the localized-header quirks
  // it already handles.
  const unknownBlock = parsedBlocks.find((block) => block.type === "UNKNOWN");
  if (unknownBlock) {
    throw IngestError.kindleUnrecognizedFormat(
      source,
      new Error(`unrecognized entry type/locale near "${unknownBlock.title}"`),
    );
  }

  let books: ReturnType<typeof groupToBooks>;
  try {
    // @hadynz/kindle-clippings' groupToBooks is where the known-quirk
    // handling lives: drops empty-body BOOKMARK entries, merges NOTE
    // entries onto the highlight they annotate by location range, and
    // dedupes extended-highlight duplicates by substring rather than exact
    // match (Kindle re-emits a highlight in full when you extend it).
    books = groupToBooks(parsedBlocks);
  } catch (err) {
    throw IngestError.kindleUnrecognizedFormat(source, err);
  }

  const loaded: LoadedDocument[] = [];
  for (const book of books) {
    if (book.annotations.length === 0) continue;

    const chunks: ChunkFields[] = book.annotations.map((annotation) => ({
      text: annotation.note ? `${annotation.content}\n\n(My note: ${annotation.note})` : annotation.content,
      highlightDate: formatHighlightDate(annotation.createdDate),
    }));

    const allText = chunks.map((chunk) => chunk.text).join("\n");
    const bookSlug = slugify(book.author ? `${book.title}-${book.author}` : book.title);

    loaded.push({
      document: {
        type: "kindle",
        title: book.title,
        source: `${source}#${bookSlug}`,
        language: detectLanguage(allText),
        author: book.author,
        contentHash: hashContent(allText),
      },
      chunks,
    });
  }

  if (loaded.length === 0) {
    throw IngestError.kindleUnrecognizedFormat(source, new Error("no highlights or notes found (only bookmarks)"));
  }

  return loaded;
}
