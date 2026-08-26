// Schema for the `conversations` collection (see chat walking skeleton spec:
// https://github.com/MamiMrl/second-brain/issues/19), separate from the
// documents/chunks Document/Chunk model in PRD.md §5.3 — a Conversation is
// raw transcript, not ingested content.

export type MessageRole = "user" | "assistant";
export type PipelinePath = "deterministic" | "agentic";

// Identifies a chunk that backed an assistant answer, for later "why did it
// answer that" auditing (PRD.md's citation-first design) — not the same
// shape as GeneratedAnswer's Reference, which is display-formatted.
export interface CitedChunkRef {
  documentId: string;
  chunkIndex: number;
}

export interface ChatMessage {
  role: MessageRole;
  text: string;
  timestamp: string; // ISO 8601
  citedChunks: CitedChunkRef[];
  pipelinePath: PipelinePath;
}

export interface Conversation {
  _id: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}
