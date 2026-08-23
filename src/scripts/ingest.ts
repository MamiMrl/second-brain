import { runIngest } from "../ingest/run.js";
import type { DocumentType } from "../ingest/types.js";

// FR-1.7: `ingest <path> [--type <recipe|fitness|kindle|pdf|nutrition>]`
const VALID_TYPES: DocumentType[] = ["recipe", "fitness", "kindle", "pdf", "nutrition"];

function parseArgs(argv: string[]): { inputPath: string; typeOverride?: DocumentType } {
  let inputPath: string | undefined;
  let typeOverride: DocumentType | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--type") {
      const value = argv[++i];
      if (!VALID_TYPES.includes(value as DocumentType)) {
        throw new Error(`--type must be one of: ${VALID_TYPES.join(", ")} (got "${value}")`);
      }
      typeOverride = value as DocumentType;
    } else if (!inputPath) {
      inputPath = arg;
    } else {
      throw new Error(`Unexpected argument: "${arg}"`);
    }
  }

  if (!inputPath) throw new Error("Usage: ingest <path> [--type <recipe|fitness|kindle|pdf|nutrition>]");
  return { inputPath, typeOverride };
}

async function main() {
  const { inputPath, typeOverride } = parseArgs(process.argv.slice(2));
  console.log(`Ingesting ${inputPath}${typeOverride ? ` (--type ${typeOverride})` : ""}...`);

  const summary = await runIngest({ inputPath, typeOverride });

  console.log(`\nProcessed ${summary.filesProcessed} file(s):`);
  for (const source of summary.sources) console.log(`  - ${source}`);
  console.log(
    `\nChunks — added: ${summary.numAdded}, updated: ${summary.numUpdated}, ` +
      `deleted (stale): ${summary.numDeleted}, skipped (unchanged): ${summary.numSkipped}`,
  );
}

main().catch((err) => {
  console.error(`\nIngestion aborted: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
