// Shared by both nutrition ingestion paths (nutrition.ts's CSV loader and
// nutrition-screenshot.ts's vision fallback) so a day's chunk text always
// reads the same regardless of which path produced it (FR-7.1/7.2).
export interface NutritionDaySummary {
  date: string;
  foods: string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function summarizeNutritionDay(day: NutritionDaySummary): string {
  return (
    `Nutrition diary — ${day.date}\n` +
    `Foods: ${day.foods.join(", ")}\n` +
    `Totals: ${Math.round(day.calories)} kcal, ${day.protein.toFixed(1)}g protein, ` +
    `${day.carbs.toFixed(1)}g carbs, ${day.fat.toFixed(1)}g fat`
  );
}
