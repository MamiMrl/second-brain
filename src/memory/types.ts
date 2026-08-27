// Ticket #23: typed memory files + index, mirroring Claude Code's own
// auto-memory scheme but recategorized for a personal life-documents domain
// (docs/research/user-memory-layer.md §2). Stored as documents in a Mongo
// `memory` collection, one entry per category-tagged synthesized fact — not
// one growing blob, per every mature memory system studied.

export type MemoryCategory = "profile" | "preference" | "goal" | "synthesis";

export interface MemoryEntry {
  category: MemoryCategory;
  content: string; // synthesized statement, never a raw quote
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  sourceRefs: string[]; // conversationId(s) or documentId(s) that triggered this write
}
