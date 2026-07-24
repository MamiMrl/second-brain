// Mirrors the Document/Chunk schema in PRD.md §5.3.

export type DocumentType = "recipe" | "fitness" | "kindle" | "pdf";

export interface DocumentFields {
  type: DocumentType;
  title: string;
  source: string; // path relative to the ingested root, e.g. "recipes/sourdough-v3.md"
  language: string;
  author?: string; // kindle only
  date?: string; // fitness only, YYYY-MM-DD from filename
  sourceArtifact?: string;
  contentHash: string;
}

export interface ChunkFields {
  text: string;
  page?: number; // pdf only
  highlightDate?: string; // kindle only
  ingredients?: string[]; // recipe only, FR-1.2 "where possible"
  steps?: string[]; // recipe only, FR-1.2 "where possible"
}

export interface LoadedDocument {
  document: DocumentFields;
  chunks: ChunkFields[];
}
