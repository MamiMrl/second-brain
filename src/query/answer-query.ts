import type { Db } from "mongodb";
import { resolveQueryFilters } from "./resolve-filters.js";
import { answerExistenceQuery } from "./answer-existence-query.js";
import { retrieveChunks } from "./retriever.js";
import { generateAnswer, type GeneratedAnswer } from "./generate-answer.js";
import { hasRetrievalSignal, isGrounded } from "./groundedness.js";
import type { ExistenceAnswer } from "./existence-answer.js";
import type { CliFilterOverrides } from "./types.js";

export type AskResult =
  | { kind: "existence"; existence: ExistenceAnswer }
  | { kind: "abstain"; reason: "no-signal" | "ungrounded" }
  | { kind: "generated"; generated: GeneratedAnswer };

// FR-4.1 entry point: resolves filters + existence routing (FR-2.2/2.4),
// then either the existence-scan path (bypasses FR-3.3, per FR-2.4) or the
// standard retrieve+generate path, gated by FR-3.3's two inline groundedness
// layers — layer (3), the offline LangSmith run, is FR-5.3's concern.
export async function answerQuery(db: Db, question: string, overrides: CliFilterOverrides = {}): Promise<AskResult> {
  const resolved = await resolveQueryFilters(question, overrides);

  const existence = await answerExistenceQuery(db, question, resolved);
  if (existence) return { kind: "existence", existence };

  const chunks = await retrieveChunks(db, question, resolved.filter);
  if (!hasRetrievalSignal(chunks)) return { kind: "abstain", reason: "no-signal" };

  const generated = await generateAnswer(question, chunks);
  if (!(await isGrounded(question, generated.answer, chunks))) return { kind: "abstain", reason: "ungrounded" };

  return { kind: "generated", generated };
}
