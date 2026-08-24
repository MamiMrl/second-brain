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
      `Cronometer CSV export is malformed or missing expected columns (${detail}). Re-export from Cronometer and retry.`,
    );
  }

  static nutritionCsvMissingPair(source: string): IngestError {
    return new IngestError(
      source,
      "Cronometer nutrition CSV export needs its sibling file in the same directory — a Daily Summary export needs " +
        "a matching Servings export (and vice versa) so macros and foods can be joined into one day's chunk.",
    );
  }

  static nutritionScreenshotUnrecognized(source: string, cause?: unknown): IngestError {
    const detail = cause instanceof Error ? ` (${cause.message})` : "";
    return new IngestError(
      source,
      `nutrition screenshot could not be transcribed into a recognizable day of intake${detail}.`,
    );
  }

  static kindleUnrecognizedFormat(source: string, cause?: unknown): IngestError {
    const detail = cause instanceof Error ? ` (${cause.message})` : "";
    return new IngestError(
      source,
      `Kindle export is not a recognizable "My Clippings.txt" format${detail}. Expected Amazon's clippings ` +
        "layout (title line, metadata line, blank line, highlight text, \"==========\" separator).",
    );
  }

  static kindleEncodingInvalid(source: string): IngestError {
    return new IngestError(
      source,
      "Kindle export is UTF-16 encoded (older Kindle firmware default), not UTF-8. Re-save/convert the file to " +
        "UTF-8 and retry.",
    );
  }

  static kindleHtmlNotSupported(source: string): IngestError {
    return new IngestError(
      source,
      'HTML Kindle exports are not supported yet — only the plain-text "My Clippings.txt" export. On your Kindle, ' +
        "use Settings > My Account > Export Notes and Highlights (or copy My Clippings.txt directly from the " +
        "device) to get the .txt format instead.",
    );
  }

  static ambiguousType(source: string): IngestError {
    return new IngestError(
      source,
      "could not auto-detect document type from its path (expected it under a `recipes/` or `fitness/` directory, " +
        "a .pdf/.txt/.html file, or a .csv with recognizable Cronometer Daily Summary or Servings columns). " +
        "Pass an explicit --type override.",
    );
  }
}
