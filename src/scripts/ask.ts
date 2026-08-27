import { connectMongo } from "../lib/mongo.js";
import { answerQuery } from "../query/answer-query.js";
import { ABSTAIN_MESSAGE } from "../query/groundedness.js";
import type { DocumentType } from "../ingest/types.js";

// FR-4.1: `ask "<question>" [--type <recipe|fitness|kindle|pdf|nutrition>] [--language <lang>]`
const VALID_TYPES: DocumentType[] = ["recipe", "fitness", "kindle", "pdf", "nutrition"];

function parseArgs(argv: string[]): { question: string; type?: DocumentType; language?: string } {
  let question: string | undefined;
  let type: DocumentType | undefined;
  let language: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--type") {
      const value = argv[++i];
      if (!VALID_TYPES.includes(value as DocumentType)) {
        throw new Error(`--type must be one of: ${VALID_TYPES.join(", ")} (got "${value}")`);
      }
      type = value as DocumentType;
    } else if (arg === "--language") {
      language = argv[++i];
      if (!language) throw new Error("--language requires a value");
    } else if (!question) {
      question = arg;
    } else {
      throw new Error(`Unexpected argument: "${arg}"`);
    }
  }

  if (!question)
    throw new Error('Usage: ask "<question>" [--type <recipe|fitness|kindle|pdf|nutrition>] [--language <lang>]');
  return { question, type, language };
}

async function main() {
  const { question, type, language } = parseArgs(process.argv.slice(2));
  const { client, db } = await connectMongo();

  try {
    const result = await answerQuery(db, question, [], { type, language });

    if (result.kind === "abstain") {
      console.log(ABSTAIN_MESSAGE);
      return;
    }

    if (result.kind === "existence") {
      console.log(result.existence.answer);
      if (result.existence.sources.length > 0) {
        console.log("\nSources:");
        for (const source of result.existence.sources) console.log(`  - ${source.title} (${source.source})`);
      }
      return;
    }

    console.log(result.generated.answer);
    if (result.generated.references.length > 0) {
      console.log("\nReferences:");
      for (const ref of result.generated.references) console.log(`  [${ref.number}] ${ref.title} — ${ref.ref}`);
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(`\nQuery failed: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
