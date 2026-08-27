import type { Db } from "mongodb";
import type { MemoryCategory, MemoryEntry } from "./types.js";

// Ticket #23: typed memory files + index (docs/research/user-memory-layer.md
// §2) — stored as discrete documents in a Mongo `memory` collection, one per
// synthesized fact, never a single growing blob (every mature memory system
// studied does the same, so individual entries can be added independently
// without rewriting the rest).
function memoryCollection(db: Db) {
  return db.collection<MemoryEntry>("memory");
}

export async function writeMemoryEntry(db: Db, category: MemoryCategory, content: string, sourceRefs: string[]): Promise<void> {
  const now = new Date().toISOString();
  await memoryCollection(db).insertOne({ category, content, createdAt: now, updatedAt: now, sourceRefs });
}

export async function listMemoryEntries(db: Db): Promise<MemoryEntry[]> {
  return memoryCollection(db).find({}).sort({ createdAt: 1 }).toArray();
}

const CATEGORY_ORDER: MemoryCategory[] = ["profile", "preference", "goal", "synthesis"];
const CATEGORY_LABEL: Record<MemoryCategory, string> = {
  profile: "Profile",
  preference: "Preference",
  goal: "Goal",
  synthesis: "Synthesis",
};

// Renders the memory index as a Markdown block for prepending into
// generate-answer.ts's SYSTEM_PROMPT (docs/research/user-memory-layer.md
// §3: unconditional system-prompt prepend, not a new agentic retrieval
// step). Empty when there's nothing durable to inject yet.
export function formatMemoryPrompt(entries: MemoryEntry[]): string {
  if (entries.length === 0) return "";

  const byCategory = new Map<MemoryCategory, MemoryEntry[]>();
  for (const entry of entries) {
    const bucket = byCategory.get(entry.category) ?? [];
    bucket.push(entry);
    byCategory.set(entry.category, bucket);
  }

  const sections = CATEGORY_ORDER.filter((category) => byCategory.has(category)).map((category) => {
    const lines = byCategory
      .get(category)!
      .map((entry) => `- ${entry.content}`)
      .join("\n");
    return `### ${CATEGORY_LABEL[category]}\n${lines}`;
  });

  return `What you know about the user, from prior conversations and ingested documents:\n\n${sections.join("\n\n")}`;
}

export async function readMemoryPrompt(db: Db): Promise<string> {
  return formatMemoryPrompt(await listMemoryEntries(db));
}
