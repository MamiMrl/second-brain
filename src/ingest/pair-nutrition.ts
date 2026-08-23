import path from "node:path";
import { isCronometerDailySummaryCsv, isCronometerServingsCsv } from "./detect-type.js";

export interface NutritionPair {
  dailySummaryPath?: string;
  servingsPath?: string;
}

// Cronometer's nutrition export always arrives as two files that only make
// sense joined together (FR-7.1) — this finds them among a batch's files by
// header shape so run.ts can merge them into one Document before the normal
// per-file loop runs.
export async function findNutritionPair(absPaths: string[]): Promise<NutritionPair> {
  const pair: NutritionPair = {};
  for (const absPath of absPaths) {
    if (path.extname(absPath).toLowerCase() !== ".csv") continue;
    if (!pair.dailySummaryPath && (await isCronometerDailySummaryCsv(absPath))) {
      pair.dailySummaryPath = absPath;
    } else if (!pair.servingsPath && (await isCronometerServingsCsv(absPath))) {
      pair.servingsPath = absPath;
    }
  }
  return pair;
}
