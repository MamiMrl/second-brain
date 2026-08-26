import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import type { Db } from "mongodb";
import { createConversation as realCreateConversation, getConversation as realGetConversation } from "./conversations.js";
import { handleChatTurn as realHandleChatTurn } from "./chat-turn.js";

export interface ChatServerDeps {
  db: Db;
  createConversation?: typeof realCreateConversation;
  handleChatTurn?: typeof realHandleChatTurn;
  getConversation?: typeof realGetConversation;
  // Directory holding the built frontend static bundle, served for any
  // request that isn't one of the API routes below. Omitted in tests, which
  // only exercise the API routes.
  staticDir?: string;
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  const data = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(data) });
  res.end(data);
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function serveStatic(staticDir: string, urlPath: string, res: http.ServerResponse) {
  const filePath = path.join(staticDir, urlPath === "/" ? "index.html" : urlPath);
  const relative = path.relative(staticDir, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200);
    res.end(data);
  });
}

// Ticket #19: a plain HTTP endpoint over the chat-turn orchestration
// (chat-turn.ts), plus a minimal conversation-read route the frontend needs
// to render what it just sent. Streaming (SSE) is a later ticket (#20) —
// this returns the finalized assistant message in one response, matching
// #13/#17's "answer delivered whole" decision.
export function createChatServer(deps: ChatServerDeps): http.Server {
  const db = deps.db;
  const createConversation = deps.createConversation ?? realCreateConversation;
  const handleChatTurn = deps.handleChatTurn ?? realHandleChatTurn;
  const getConversation = deps.getConversation ?? realGetConversation;

  return http.createServer((req, res) => {
    void (async () => {
      try {
        const url = new URL(req.url ?? "/", "http://localhost");
        const segments = url.pathname.split("/").filter(Boolean);

        if (req.method === "POST" && segments.length === 1 && segments[0] === "conversations") {
          const conversationId = await createConversation(db);
          sendJson(res, 201, { conversationId });
          return;
        }

        if (req.method === "POST" && segments.length === 3 && segments[0] === "conversations" && segments[2] === "messages") {
          const conversationId = segments[1];
          const body = (await readJsonBody(req)) as { question?: unknown };
          if (typeof body.question !== "string" || body.question.length === 0) {
            sendJson(res, 400, { error: "Request body must include a non-empty `question` string." });
            return;
          }
          const assistantMessage = await handleChatTurn(db, conversationId, body.question);
          sendJson(res, 200, assistantMessage);
          return;
        }

        if (req.method === "GET" && segments.length === 2 && segments[0] === "conversations") {
          const conversationId = segments[1];
          const conversation = await getConversation(db, conversationId);
          if (!conversation) {
            sendJson(res, 404, { error: "Conversation not found." });
            return;
          }
          sendJson(res, 200, conversation);
          return;
        }

        if (req.method === "GET" && deps.staticDir) {
          serveStatic(deps.staticDir, url.pathname, res);
          return;
        }

        res.writeHead(404);
        res.end();
      } catch (err) {
        sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
      }
    })();
  });
}
