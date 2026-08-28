import type { Db } from "mongodb";
import { z } from "zod";
import { createSdkMcpServer, query, tool } from "@anthropic-ai/claude-agent-sdk";
import { env } from "../lib/env.js";
import { searchDocuments, checkExistence } from "./chat-tools.js";
import { buildGetRecentNutritionTool } from "./nutrition-tools.js";
import { readMemory, writeMemory } from "./memory-tools.js";
import { isGrounded } from "../query/groundedness.js";
import type { RetrievedChunk } from "../query/retriever.js";
import type { AskResult, PipelineOptions } from "../query/answer-query.js";
import type { ConversationTurn } from "../query/types.js";

const CHAT_MCP_SERVER = "chat";
const SEARCH_DOCUMENTS_TOOL = "mcp__chat__searchDocuments";
const CHECK_EXISTENCE_TOOL = "mcp__chat__checkExistence";
const GET_RECENT_NUTRITION_TOOL = "mcp__chat__getRecentNutrition";
const READ_MEMORY_TOOL = "mcp__chat__readMemory";
const WRITE_MEMORY_TOOL = "mcp__chat__writeMemory";

const DOCUMENT_TYPES = ["recipe", "fitness", "kindle", "pdf", "nutrition"] as const;
const MEMORY_CATEGORIES = ["profile", "preference", "goal", "synthesis"] as const;

// Ticket #24: the second, agentic entry point alongside answerQuery() —
// same @anthropic-ai/claude-agent-sdk query() + in-process MCP-server pattern
// as nutrition-agent.ts, generalized per docs/research/agentic-vs-
// deterministic-query-pipeline.md §3's tool shape (searchDocuments,
// checkExistence, getRecentNutrition, readMemory/writeMemory — five tools,
// not one per DocumentType).
const SYSTEM_PROMPT =
  "You are a personal document assistant answering open-ended, multi-domain questions by reasoning across the " +
  "user's own ingested documents (recipes, fitness notes, Kindle highlights, PDFs, nutrition logs) and what's " +
  "already remembered about them.\n\n" +
  `1. Call ${READ_MEMORY_TOOL} first to see what's already known about the user.\n` +
  `2. Use ${SEARCH_DOCUMENTS_TOOL} (optionally scoped by type/book/dateRange) to find relevant chunks — call it as ` +
  "many times as needed across different domains to answer a multi-domain question.\n" +
  `3. Use ${CHECK_EXISTENCE_TOOL} instead of searchDocuments when the question asks whether something exists or ` +
  "how many of something there are.\n" +
  `4. Use ${GET_RECENT_NUTRITION_TOOL} for questions about recent logged nutrition intake.\n` +
  "5. NEVER state a fact that none of your tool calls actually returned — if nothing relevant comes back, say so " +
  "honestly instead of fabricating one.\n" +
  `6. If this turn reveals a new durable, synthesized fact about the user, call ${WRITE_MEMORY_TOOL} to store it — ` +
  "never a raw quote, never session-scoped trivia.";

function formatHistory(history: ConversationTurn[]): string {
  if (history.length === 0) return "";
  const transcript = history.map((turn) => `${turn.role === "user" ? "User" : "Assistant"}: ${turn.text}`).join("\n");
  return `Prior conversation:\n${transcript}\n\n`;
}

// Every searchDocuments/checkExistence tool call across the loop pushes its
// chunks here, so the post-loop groundedness check (§2 of the research doc)
// can run against everything the agent actually saw, not just its final
// tool call.
function buildChatServer(db: Db, conversationId: string, accumulatedChunks: RetrievedChunk[]) {
  return createSdkMcpServer({
    name: CHAT_MCP_SERVER,
    tools: [
      tool(
        "searchDocuments",
        "Vector-search the user's ingested documents for chunks matching a description, optionally scoped by " +
          "type/book/dateRange. Only chunks actually in the user's corpus can be returned — never invent one.",
        {
          query: z.string().describe("what to search for, e.g. 'high protein dinner with vegetables'"),
          type: z.enum(DOCUMENT_TYPES).optional().describe("restrict to this document type"),
          book: z.string().optional().describe("restrict to this Kindle book title or author"),
          dateRangeStart: z.string().optional().describe("inclusive start date, ISO YYYY-MM-DD"),
          dateRangeEnd: z.string().optional().describe("inclusive end date, ISO YYYY-MM-DD"),
        },
        async ({ query: searchQuery, type, book, dateRangeStart, dateRangeEnd }) => {
          const dateRange = dateRangeStart || dateRangeEnd ? { start: dateRangeStart, end: dateRangeEnd } : undefined;
          const chunks = await searchDocuments(db, { query: searchQuery, type, book, dateRange });
          accumulatedChunks.push(...chunks);
          const results = chunks.map((chunk) => ({ title: chunk.title, source: chunk.source, text: chunk.text }));
          return { content: [{ type: "text", text: JSON.stringify(results) }] };
        },
      ),
      tool(
        "checkExistence",
        "Exhaustively check whether documents of a type/book exist, without ranking — for existence/count questions.",
        {
          type: z.enum(DOCUMENT_TYPES).optional().describe("restrict to this document type"),
          book: z.string().optional().describe("restrict to this Kindle book title or author"),
        },
        async ({ type, book }) => {
          const chunks = await checkExistence(db, { type, book });
          accumulatedChunks.push(...chunks);
          const results = chunks.map((chunk) => ({ title: chunk.title, source: chunk.source, text: chunk.text }));
          return { content: [{ type: "text", text: JSON.stringify(results) }] };
        },
      ),
      buildGetRecentNutritionTool(db),
      tool("readMemory", "Read durable, synthesized facts already remembered about the user.", {}, async () => {
        const entries = await readMemory(db);
        return { content: [{ type: "text", text: JSON.stringify(entries) }] };
      }),
      tool(
        "writeMemory",
        "Store a new durable, synthesized fact about the user for future turns — never a raw quote, never " +
          "session-scoped trivia.",
        {
          category: z.enum(MEMORY_CATEGORIES).describe("profile, preference, goal, or synthesis"),
          content: z.string().describe("the synthesized statement to remember, written as a standalone fact"),
        },
        async ({ category, content }) => {
          await writeMemory(db, category, content, conversationId);
          return { content: [{ type: "text", text: "stored" }] };
        },
      ),
    ],
  });
}

// Ticket #24: mirrors answerQuery()'s shape (same AskResult union, same
// PipelineOptions) so chat-turn.ts can dispatch to either path uniformly.
// Only ever returns "generated" or "abstain" — there's no existence-routing
// branch here, per docs/research/agentic-vs-deterministic-query-pipeline.md's
// scope (existence-routing stays a deterministic-pipeline-only concern).
export async function answerChatAgentically(
  db: Db,
  conversationId: string,
  question: string,
  history: ConversationTurn[] = [],
  options: PipelineOptions = {},
): Promise<AskResult> {
  const { signal, onStep } = options;
  const accumulatedChunks: RetrievedChunk[] = [];
  const chatServer = buildChatServer(db, conversationId, accumulatedChunks);

  onStep?.("generating-answer");

  let answer = "";
  for await (const message of query({
    prompt: `${formatHistory(history)}Question: ${question}`,
    options: {
      mcpServers: { [CHAT_MCP_SERVER]: chatServer },
      allowedTools: [SEARCH_DOCUMENTS_TOOL, CHECK_EXISTENCE_TOOL, GET_RECENT_NUTRITION_TOOL, READ_MEMORY_TOOL, WRITE_MEMORY_TOOL],
      permissionMode: "bypassPermissions",
      systemPrompt: SYSTEM_PROMPT,
      model: env.claudeModel(),
    },
  })) {
    if (message.type === "result" && message.subtype === "success") {
      answer = message.result;
    }
  }

  if (!answer) return { kind: "abstain", reason: "ungrounded" };

  onStep?.("checking-groundedness");
  // §2 of docs/research/agentic-vs-deterministic-query-pipeline.md: the same
  // isGrounded() post-generation check the deterministic pipeline uses,
  // applied here as a code-level gate rather than left to the system prompt
  // alone (closing the gap nutrition-agent.ts currently leaves open).
  const grounded = await isGrounded(question, answer, accumulatedChunks, signal);
  if (!grounded) return { kind: "abstain", reason: "ungrounded" };

  return { kind: "generated", generated: { answer, references: [] }, chunks: accumulatedChunks };
}
