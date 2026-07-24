import type { Db } from "mongodb";
import { RecordManager, type ListKeyOptions, type UpdateOptions } from "@langchain/core/indexing";

interface RecordManagerDoc {
  _id: string;
  groupId: string | null;
  updatedAt: number;
}

// FR-1.5: idempotent re-ingestion via LangChain's Indexing API. No official
// MongoDB-backed RecordManager ships in the LangChain JS ecosystem (unlike
// Postgres/Redis/etc in the now-sunsetting @langchain/community — see
// voyage-embeddings.ts) — this implements the same `RecordManager` interface
// those backends implement, against a plain Mongo collection. Not a bespoke
// dedup mechanism: it's LangChain's own documented extension point, filled
// in for the one backend the ecosystem doesn't ship.
export class MongoRecordManager extends RecordManager {
  lc_namespace = ["second_brain", "ingest", "record_manager"];

  private db: Db;
  private collectionName: string;

  constructor(db: Db, collectionName = "record_manager") {
    super();
    this.db = db;
    this.collectionName = collectionName;
  }

  private get collection() {
    return this.db.collection<RecordManagerDoc>(this.collectionName);
  }

  async createSchema(): Promise<void> {
    await this.collection.createIndex({ groupId: 1, updatedAt: 1 });
  }

  // Server time, not app time — matches SQLRecordManager's use of
  // CURRENT_TIMESTAMP, so a single time authority is used for every
  // timeAtLeast/before comparison regardless of client clock drift.
  async getTime(): Promise<number> {
    const hello = await this.db.admin().command({ hello: 1 });
    const localTime = hello.localTime as Date;
    return localTime.getTime();
  }

  async update(keys: string[], updateOptions?: UpdateOptions): Promise<void> {
    if (keys.length === 0) return;
    const { groupIds, timeAtLeast } = updateOptions ?? {};
    if (groupIds && groupIds.length !== keys.length) {
      throw new Error("Number of keys does not match number of groupIds");
    }

    const updatedAt = await this.getTime();
    if (timeAtLeast !== undefined && updatedAt < timeAtLeast) {
      throw new Error(
        `Record manager time (${updatedAt}) is behind the expected time (${timeAtLeast}) — check for clock drift.`,
      );
    }

    await this.collection.bulkWrite(
      keys.map((key, i) => ({
        updateOne: {
          filter: { _id: key },
          update: { $set: { groupId: groupIds?.[i] ?? null, updatedAt } },
          upsert: true,
        },
      })),
    );
  }

  async exists(keys: string[]): Promise<boolean[]> {
    if (keys.length === 0) return [];
    const found = await this.collection.find({ _id: { $in: keys } }, { projection: { _id: 1 } }).toArray();
    const foundIds = new Set(found.map((doc) => doc._id));
    return keys.map((key) => foundIds.has(key));
  }

  async listKeys(options?: ListKeyOptions): Promise<string[]> {
    const { before, after, groupIds, limit } = options ?? {};
    const filter: Record<string, unknown> = {};
    if (before !== undefined || after !== undefined) {
      filter.updatedAt = {
        ...(before !== undefined ? { $lt: before } : {}),
        ...(after !== undefined ? { $gt: after } : {}),
      };
    }
    if (groupIds) filter.groupId = { $in: groupIds };

    let cursor = this.collection.find(filter, { projection: { _id: 1 } });
    if (limit !== undefined) cursor = cursor.limit(limit);
    return (await cursor.toArray()).map((doc) => doc._id);
  }

  async deleteKeys(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.collection.deleteMany({ _id: { $in: keys } });
  }
}
