import { detectLanguage } from "../language.js";
import { hashContent } from "../hash.js";
import { IngestError } from "../errors.js";
import type { ChunkFields, LoadedDocument } from "../types.js";
import { readTextFile } from "./read-file.js";
import { summarizeNutritionDay } from "./nutrition-format.js";

const REQUIRED_COLUMNS = ["Day", "Food Name", "Energy (kcal)"];

// Cronometer's Diary export: one row per logged food, several rows per day.
// A double-quoted field may itself contain commas (e.g. "Chicken, Breast"),
// so a plain `line.split(",")` would misparse it.
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function parseNumber(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

interface DayTotals {
  date: string;
  foods: string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// FR-7.1: nutrition data ingests via the same seam as every other document
// type. One Document per Cronometer CSV export batch; one Chunk per logged
// day, carrying macro/food fields in chunk metadata (mirroring how kindle
// carries highlightDate and recipe carries ingredients/steps, per
// src/ingest/types.ts's existing pattern).
export async function loadNutritionCsv(absPath: string, source: string): Promise<LoadedDocument> {
  const text = await readTextFile(absPath, source);
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length < 2) throw IngestError.nutritionCsvMalformed(source, "no data rows found");

  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const missing = REQUIRED_COLUMNS.filter((col) => !header.includes(col));
  if (missing.length > 0) {
    throw IngestError.nutritionCsvMalformed(source, `missing column(s): ${missing.join(", ")}`);
  }

  const dayIndex = header.indexOf("Day");
  const foodIndex = header.indexOf("Food Name");
  const kcalIndex = header.indexOf("Energy (kcal)");
  const proteinIndex = header.indexOf("Protein (g)");
  const carbsIndex = header.indexOf("Net Carbs (g)");
  const fatIndex = header.indexOf("Fat (g)");

  const byDate = new Map<string, DayTotals>();
  for (const line of lines.slice(1)) {
    const fields = parseCsvLine(line);
    const date = fields[dayIndex]?.trim();
    const food = fields[foodIndex]?.trim();
    if (!date || !food) throw IngestError.nutritionCsvMalformed(source, `row missing Day or Food Name: "${line}"`);

    let day = byDate.get(date);
    if (!day) {
      day = { date, foods: [], calories: 0, protein: 0, carbs: 0, fat: 0 };
      byDate.set(date, day);
    }
    day.foods.push(food);
    day.calories += parseNumber(fields[kcalIndex]);
    day.protein += parseNumber(fields[proteinIndex]);
    day.carbs += parseNumber(fields[carbsIndex]);
    day.fat += parseNumber(fields[fatIndex]);
  }

  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
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

  return {
    document: {
      type: "nutrition",
      title,
      source,
      language: detectLanguage(text),
      contentHash: hashContent(text),
    },
    chunks,
  };
}
