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
  claudeModel: () => process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6",
  voyageApiKey: () => required("VOYAGE_API_KEY"),
  voyageModel: () => process.env.VOYAGE_MODEL ?? "voyage-3.5",
};
