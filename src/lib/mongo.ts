import { MongoClient, type Db } from "mongodb";
import { env } from "./env.js";

export async function connectMongo(): Promise<{ client: MongoClient; db: Db }> {
  const client = new MongoClient(env.mongodbAtlasUri());
  await client.connect();
  return { client, db: client.db(env.mongodbDbName()) };
}
