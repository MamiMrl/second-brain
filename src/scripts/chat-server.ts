import path from "node:path";
import { connectMongo } from "../lib/mongo.js";
import { createChatServer } from "../chat/server.js";

// Ticket #19: the always-on local service, bound to 127.0.0.1 only (per
// #15's background-service decision — launchd packaging is a later ticket,
// #25; this just needs to run and bind correctly). Serves both the chat API
// and the built frontend static bundle, so there is one server process.
const PORT = Number(process.env.CHAT_SERVER_PORT ?? 4319);
const STATIC_DIR = path.resolve("web/dist");

async function main() {
  const { db } = await connectMongo();
  const server = createChatServer({ db, staticDir: STATIC_DIR });

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`second-brain chat server listening on http://127.0.0.1:${PORT}`);
  });
}

main().catch((err) => {
  console.error(`Chat server failed to start: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
