import type { Db } from "mongodb";
import { listMemoryEntries, writeMemoryEntry } from "../memory/memory-store.js";
import type { MemoryCategory, MemoryEntry } from "../memory/types.js";

// Ticket #24: the readMemory/writeMemory capability ticket #23 built but
// deferred consuming — thin adapters over memory-store.ts's existing
// functions, exposed as agent tools (chat-agent.ts) rather than new
// read/write logic of their own.
export async function readMemory(db: Db): Promise<MemoryEntry[]> {
  return listMemoryEntries(db);
}

export async function writeMemory(db: Db, category: MemoryCategory, content: string, sourceRef: string): Promise<void> {
  await writeMemoryEntry(db, category, content, [sourceRef]);
}
