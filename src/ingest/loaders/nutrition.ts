import { detectLanguage } from "../language.js";
import { hashContent } from "../hash.js";
import { IngestError } from "../errors.js";
import type { ChunkFields, LoadedDocument } from "../types.js";
import { readTextFile } from "./read-file.js";
import { summarizeNutritionDay } from "./nutrition-format.js";
import { parseCsvLine } from "./csv.js";

const DAILY_SUMMARY_REQUIRED = ["Date", "Energy (kcal)", "Protein (g)", "Net Carbs (g)", "Fat (g)"];
const SERVINGS_REQUIRED = ["Day", "Food Name"];

function parseNumber(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

interface DayMacros {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// Cronometer's Daily Summary export: one row per day, macros/micros, even
// for days with no logging at all (blank Energy). Cronometer's own
// "Completed" column tracks goal-completion, not logging status, so it's
// not a reliable filter — a blank Energy cell is what actually means
// "nothing logged that day."
function parseDailySummary(text: string, source: string): Map<string, DayMacros> {
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length < 2) throw IngestError.nutritionCsvMalformed(source, "no data rows found");

  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const missing = DAILY_SUMMARY_REQUIRED.filter((col) => !header.includes(col));
  if (missing.length > 0) throw IngestError.nutritionCsvMalformed(source, `missing column(s): ${missing.join(", ")}`);

  const dateIndex = header.indexOf("Date");
  const kcalIndex = header.indexOf("Energy (kcal)");
  const proteinIndex = header.indexOf("Protein (g)");
  const carbsIndex = header.indexOf("Net Carbs (g)");
  const fatIndex = header.indexOf("Fat (g)");

  const byDate = new Map<string, DayMacros>();
  for (const line of lines.slice(1)) {
    const fields = parseCsvLine(line);
    const date = fields[dateIndex]?.trim();
    if (!date) throw IngestError.nutritionCsvMalformed(source, `row missing Date: "${line}"`);

    if (!fields[kcalIndex]?.trim()) continue; // nothing logged that day

    byDate.set(date, {
      date,
      calories: parseNumber(fields[kcalIndex]),
      protein: parseNumber(fields[proteinIndex]),
      carbs: parseNumber(fields[carbsIndex]),
      fat: parseNumber(fields[fatIndex]),
    });
  }
  return byDate;
}

// Cronometer's Servings export: one row per logged food, several rows per
// day, no macro totals — just what was eaten.
function parseServingsByDate(text: string, source: string): Map<string, string[]> {
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length < 2) throw IngestError.nutritionCsvMalformed(source, "no data rows found");

  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const missing = SERVINGS_REQUIRED.filter((col) => !header.includes(col));
  if (missing.length > 0) throw IngestError.nutritionCsvMalformed(source, `missing column(s): ${missing.join(", ")}`);

  const dayIndex = header.indexOf("Day");
  const foodIndex = header.indexOf("Food Name");

  const byDate = new Map<string, string[]>();
  for (const line of lines.slice(1)) {
    const fields = parseCsvLine(line);
    const date = fields[dayIndex]?.trim();
    const food = fields[foodIndex]?.trim();
    if (!date || !food) throw IngestError.nutritionCsvMalformed(source, `row missing Day or Food Name: "${line}"`);

    const foods = byDate.get(date) ?? [];
    foods.push(food);
    byDate.set(date, foods);
  }
  return byDate;
}

// FR-7.1: Cronometer exports nutrition as two separate files — Daily
// Summary (macros per day, no food names) and Servings (food names per
// day, no macros) — not one combined export. This joins them by date into
// one Document, one Chunk per completed day, carrying both macros and
// foods together (mirroring how kindle carries highlightDate and recipe
// carries ingredients/steps, per src/ingest/types.ts's existing pattern).
export async function loadNutritionCsvPair(
  dailySummaryAbsPath: string,
  dailySummarySource: string,
  servingsAbsPath: string,
  servingsSource: string,
): Promise<LoadedDocument> {
  const dailySummaryText = await readTextFile(dailySummaryAbsPath, dailySummarySource);
  const servingsText = await readTextFile(servingsAbsPath, servingsSource);

  const macrosByDate = parseDailySummary(dailySummaryText, dailySummarySource);
  const foodsByDate = parseServingsByDate(servingsText, servingsSource);
  if (macrosByDate.size === 0) {
    throw IngestError.nutritionCsvMalformed(dailySummarySource, "no completed days found");
  }

  const days = [...macrosByDate.values()]
    .map((day) => ({ ...day, foods: foodsByDate.get(day.date) ?? [] }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const chunks: ChunkFields[] = days.map((day) => ({
    text: summarizeNutritionDay(day),
    date: day.date,
    calories: day.calories,
    protein: day.protein,
    carbs: day.carbs,
    fat: day.fat,
    foods: day.foods,
  }));

  const title = `Nutrition diary — ${days[0].date} to ${days[days.length - 1].date}`;
  const source = `${dailySummarySource}+${servingsSource}`;

  return {
    document: {
      type: "nutrition",
      title,
      source,
      language: detectLanguage(dailySummaryText),
      contentHash: hashContent(dailySummaryText + servingsText),
    },
    chunks,
  };
}
