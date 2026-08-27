import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import type { Db } from "mongodb";
import { createConversation as realCreateConversation, getConversation as realGetConversation } from "./conversations.js";
import { handleChatTurn as realHandleChatTurn } from "./chat-turn.js";
import type { PipelineStep } from "../query/answer-query.js";

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
  if (res.writableEnded) return; // client already disconnected — nothing left to respond to
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

function formatSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// Broadcasts one SSE event to every subscriber currently connected for a
// conversation — a no-op if nothing is listening (e.g. a plain POST without
// an open stream, or the CLI path, which never goes through this server).
function broadcastToConversation(subscribersByConversation: Map<string, Set<http.ServerResponse>>, conversationId: string, event: string, data: unknown) {
  const subscribers = subscribersByConversation.get(conversationId);
  if (!subscribers) return;
  const payload = formatSseEvent(event, data);
  for (const res of subscribers) res.write(payload);
}

// Ticket #19: a plain HTTP endpoint over the chat-turn orchestration
// (chat-turn.ts), plus a minimal conversation-read route the frontend needs
// to render what it just sent. Ticket #20 adds live pipeline-step status:
// a per-conversation SSE stream (GET /conversations/:id/stream) that the
// message POST broadcasts "status" events onto as each named pipeline step
// starts, then a final "answer" event carrying the same message the POST
// response returns. The answer itself is still delivered whole in the POST
// response — only status updates stream live, per #13/#17's decision.
export function createChatServer(deps: ChatServerDeps): http.Server {
  const db = deps.db;
  const createConversation = deps.createConversation ?? realCreateConversation;
  const handleChatTurn = deps.handleChatTurn ?? realHandleChatTurn;
  const getConversation = deps.getConversation ?? realGetConversation;

  const streamsByConversation = new Map<string, Set<http.ServerResponse>>();
  // The most recent status step per conversation, so a client that opens
  // the SSE stream after a question is already in flight (a reload mid-
  // answer, a second tab opened late) still sees where the pipeline is,
  // rather than sitting blank until the *next* step happens to fire.
  // Cleared once the answer lands — nothing to replay once nobody's waiting.
  const lastStepByConversation = new Map<string, { step: PipelineStep }>();

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

        if (req.method === "GET" && segments.length === 3 && segments[0] === "conversations" && segments[2] === "stream") {
          const conversationId = segments[1];
          res.writeHead(200, {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
            connection: "keep-alive",
          });
          res.write(":ok\n\n"); // flush headers immediately so the client's connection opens without waiting for the first real event

          const lastStep = lastStepByConversation.get(conversationId);
          if (lastStep) res.write(formatSseEvent("status", lastStep));

          let subscribers = streamsByConversation.get(conversationId);
          if (!subscribers) {
            subscribers = new Set();
            streamsByConversation.set(conversationId, subscribers);
          }
          subscribers.add(res);
          req.on("close", () => subscribers?.delete(res));
          return;
        }

        if (req.method === "POST" && segments.length === 3 && segments[0] === "conversations" && segments[2] === "messages") {
          const conversationId = segments[1];

          // Aborts the in-flight pipeline (generation, groundedness, filter
          // inference) the moment the client goes away mid-question — a
          // browser tab close or a manual "stop generating" — instead of
          // burning a full upstream Claude call nobody will read.
          // `res` (not `req`) is the right event here: req's `close` fires
          // as soon as the request body finishes arriving, regardless of
          // whether the client is still connected waiting on a response —
          // res's `close` fires only when the underlying socket actually
          // goes away. It also fires on ordinary completion, hence `settled`.
          const controller = new AbortController();
          let settled = false;
          res.on("close", () => {
            if (!settled) controller.abort();
          });

          const body = (await readJsonBody(req)) as { question?: unknown };
          if (typeof body.question !== "string" || body.question.length === 0) {
            settled = true;
            sendJson(res, 400, { error: "Request body must include a non-empty `question` string." });
            return;
          }

          try {
            const assistantMessage = await handleChatTurn(db, conversationId, body.question, {
              signal: controller.signal,
              onStep: (step) => {
                lastStepByConversation.set(conversationId, { step });
                broadcastToConversation(streamsByConversation, conversationId, "status", { step });
              },
            });
            settled = true;
            lastStepByConversation.delete(conversationId);
            broadcastToConversation(streamsByConversation, conversationId, "answer", assistantMessage);
            sendJson(res, 200, assistantMessage);
          } catch (err) {
            settled = true;
            lastStepByConversation.delete(conversationId);
            if (controller.signal.aborted) return; // client is gone; nothing to respond to
            throw err;
          }
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
