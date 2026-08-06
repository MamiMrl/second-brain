import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  mongodbAtlasUri: () => required("MONGODB_ATLAS_URI"),
  mongodbDbName: () => process.env.MONGODB_DB_NAME ?? "second_brain",
  anthropicApiKey: () => required("ANTHROPIC_API_KEY"),
  claudeModel: () => process.env.CLAUDE_MODEL ?? "claude-haiku-4-5-20251001",
  voyageApiKey: () => required("VOYAGE_API_KEY"),
  voyageModel: () => process.env.VOYAGE_MODEL ?? "voyage-3.5",
  filterModel: () => process.env.FILTER_MODEL ?? "qwen3:8b",
  ollamaBaseUrl: () => process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
};
