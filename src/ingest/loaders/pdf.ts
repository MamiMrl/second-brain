import path from "node:path";
import { PDFParse, PasswordException, InvalidPDFException, FormatError } from "pdf-parse";
import { IngestError } from "../errors.js";
import { detectLanguage } from "../language.js";
import { splitPdfPageText } from "../chunk.js";
import { hashContent } from "../hash.js";
import type { LoadedDocument } from "../types.js";
import { readFileBuffer } from "./read-file.js";

// FR-1.1: parse (page-aware), chunk ~800-1200 tokens with ~150 overlap,
// preserve page numbers in metadata. @langchain/community's PDFLoader is not
// used here — it's being sunset (see voyage-embeddings.ts for the same
// precedent) and its bundled pdf-parse v1 import path is broken against the
// v2 the project installs. Calling pdf-parse directly is the path LangChain's
// own maintainers now point people toward.
export async function loadPdf(absPath: string, source: string): Promise<LoadedDocument> {
  const data = await readFileBuffer(absPath, source);

  const parser = new PDFParse({ data });
  try {
    const { pages } = await parser.getText();

    const fullText = pages.map((page) => page.text).join("\n");
    if (fullText.trim().length === 0) throw IngestError.pdfImageOnly(source);

    const chunks: LoadedDocument["chunks"] = [];
    for (const page of pages) {
      if (page.text.trim().length === 0) continue;
      const pieces = await splitPdfPageText(page.text);
      for (const text of pieces) chunks.push({ text, page: page.num });
    }

    return {
      document: {
        type: "pdf",
        title: path.basename(absPath, path.extname(absPath)),
        source,
        language: detectLanguage(fullText.slice(0, 2000)),
        contentHash: hashContent(fullText),
      },
      chunks,
    };
  } catch (err) {
    if (err instanceof IngestError) throw err;
    if (err instanceof PasswordException) throw IngestError.pdfPasswordProtected(source);
    if (err instanceof InvalidPDFException || err instanceof FormatError) throw IngestError.pdfCorrupted(source, err);
    throw IngestError.pdfCorrupted(source, err);
  } finally {
    await parser.destroy();
  }
}
