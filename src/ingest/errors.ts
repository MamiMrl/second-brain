import type { DocumentType } from "./types.js";

// FR-1.8: batch ingestion aborts on first failure with an actionable,
// error-type-specific message instead of a raw stack trace. Each static
// factory below corresponds to one of the known cases enumerated in FR-1.8.
export class IngestError extends Error {
  readonly source: string;

  constructor(source: string, message: string) {
    super(`${source}: ${message}`);
    this.name = "IngestError";
    this.source = source;
  }

  static fileNotFound(source: string): IngestError {
    return new IngestError(source, "file not found.");
  }

  static permissionDenied(source: string): IngestError {
    return new IngestError(source, "permission denied — check file/directory read permissions.");
  }

  static emptyFile(source: string): IngestError {
    return new IngestError(source, "file is empty — nothing to ingest.");
  }

  static pdfPasswordProtected(source: string): IngestError {
    return new IngestError(source, "PDF is password-protected. Remove the password and retry.");
  }

  static pdfCorrupted(source: string, cause?: unknown): IngestError {
    const detail = cause instanceof Error ? ` (${cause.message})` : "";
    return new IngestError(source, `PDF is corrupted or truncated and could not be parsed${detail}.`);
  }

  static pdfImageOnly(source: string): IngestError {
    return new IngestError(
      source,
      "PDF has no extractable text (likely scanned/image-only). OCR it first, then re-ingest.",
    );
  }

  static fitnessFilenameInvalid(source: string): IngestError {
    return new IngestError(
      source,
      "fitness note filename must match YYYY-MM-DD.md (e.g. 2026-07-19.md) so the date can be derived from it.",
    );
  }

  static nutritionCsvMalformed(source: string, detail: string): IngestError {
    return new IngestError(
      source,
      `Cronometer CSV export is malformed or missing expected columns (${detail}). Re-export the Diary from Cronometer and retry.`,
    );
  }

  static nutritionScreenshotUnrecognized(source: string, cause?: unknown): IngestError {
    const detail = cause instanceof Error ? ` (${cause.message})` : "";
    return new IngestError(
      source,
      `nutrition screenshot could not be transcribed into a recognizable day of intake${detail}.`,
    );
  }

  static ambiguousType(source: string): IngestError {
    return new IngestError(
      source,
      "could not auto-detect document type from its path (expected it under a `recipes/` or `fitness/` directory, " +
        "a .pdf/.txt/.html file, or a .csv with recognizable Cronometer Diary columns). " +
        "Pass an explicit --type override.",
    );
  }

  static unsupportedType(source: string, type: DocumentType): IngestError {
    return new IngestError(source, `type "${type}" is not implemented yet (kindle ingestion lands in M4).`);
  }
}
