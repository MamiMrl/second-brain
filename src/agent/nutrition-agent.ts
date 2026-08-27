import type { Db } from "mongodb";
import { z } from "zod";
import { createSdkMcpServer, query, tool } from "@anthropic-ai/claude-agent-sdk";
import { env } from "../lib/env.js";
import { buildGetRecentNutritionTool, retrieveRecipes } from "./nutrition-tools.js";

const NUTRITION_MCP_SERVER = "nutrition";
const RETRIEVE_RECIPES_TOOL = "mcp__nutrition__retrieveRecipes";
const GET_RECENT_NUTRITION_TOOL = "mcp__nutrition__getRecentNutrition";

// FR-7.4: the agent — not deterministic code — owns the variety/groundedness
// judgment calls. It's instructed to look at recent intake before
// recommending, to vary its pick rather than always returning the same top
// match, and to never recommend a recipe retrieveRecipes didn't actually
// return (the same "don't fabricate" principle as FR-3.1/3.3, applied to
// this Agent SDK code path instead of the LangChain groundedness gate).
const SYSTEM_PROMPT =
  "You are a nutrition-aware cooking assistant. You reason over the user's own logged nutrition intake " +
  "and their own saved recipes to recommend what to cook next.\n\n" +
  `1. Call ${GET_RECENT_NUTRITION_TOOL} first to see recent days of intake — macros and foods eaten.\n` +
  "2. Reason about variety and repetition: avoid recommending something too similar to what was just eaten, " +
  "and don't default to the same suggestion every time — favor variety across invocations.\n" +
  `3. Call ${RETRIEVE_RECIPES_TOOL} with a query describing what would round out today's intake ` +
  "(e.g. a macro that's been low, a food group not eaten recently) to find a grounded candidate.\n" +
  `4. Recommend exactly ONE recipe from the ${RETRIEVE_RECIPES_TOOL} results. NEVER invent a recipe that tool ` +
  "didn't return — if nothing relevant comes back, say so honestly instead of fabricating one.\n" +
  "5. Briefly explain why, referencing the recent intake pattern that motivated the pick.";

const PROMPT = "Based on my recent nutrition intake and my saved recipes, what should I cook next?";

export interface NutritionSuggestion {
  recommendation: string;
}

function buildNutritionServer(db: Db) {
  return createSdkMcpServer({
    name: NUTRITION_MCP_SERVER,
    tools: [
      tool(
        "retrieveRecipes",
        "Vector-search the user's own ingested recipes (type=recipe) for candidates matching a description. " +
          "Only recipes actually in the user's corpus can be returned — never invent one.",
        { query: z.string().describe("what to search for, e.g. 'high protein dinner with vegetables'") },
        async ({ query: searchQuery }) => {
          const chunks = await retrieveRecipes(db, searchQuery);
          const results = chunks.map((chunk) => ({ title: chunk.title, source: chunk.source, text: chunk.text }));
          return { content: [{ type: "text", text: JSON.stringify(results) }] };
        },
      ),
      buildGetRecentNutritionTool(db),
    ],
  });
}

// FR-7.3/7.4: on-demand only (no cron, no daemon) — a single query() call
// per invocation, mirroring the existing ask.ts CLI shape but as a
// proactive recommendation rather than a retrieve-and-cite Q&A.
export async function suggestNutrition(db: Db): Promise<NutritionSuggestion> {
  const nutritionServer = buildNutritionServer(db);

  let recommendation = "";
  for await (const message of query({
    prompt: PROMPT,
    options: {
      mcpServers: { [NUTRITION_MCP_SERVER]: nutritionServer },
      allowedTools: [RETRIEVE_RECIPES_TOOL, GET_RECENT_NUTRITION_TOOL],
      permissionMode: "bypassPermissions",
      systemPrompt: SYSTEM_PROMPT,
      model: env.claudeModel(),
    },
  })) {
    if (message.type === "result" && message.subtype === "success") {
      recommendation = message.result;
    }
  }

  if (!recommendation) throw new Error("nutrition agent produced no recommendation");
  return { recommendation };
}
