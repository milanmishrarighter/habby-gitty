export interface SavedMeal {
  id: string;
  foodName: string;
  minCalorie: number;
  maxCalorie: number;
}

/** A meal as eaten on one particular day. */
export interface MealEntry {
  foodName: string;
  minCalorie: number;
  maxCalorie: number;
}

export type ShittyDayGrade = "A" | "B" | "C" | "D";
export const SHITTY_DAY_GRADES: ShittyDayGrade[] = ["A", "B", "C", "D"];

export type MissedDayEating = "good" | "average" | "bad";

/** What a missed day costs, by how the eating went. */
export const MISSED_DAY_FINES: Record<MissedDayEating, number> = {
  good: 0,
  average: 100,
  bad: 500,
};

export const MISSED_DAY_EATING_LABELS: Record<MissedDayEating, string> = {
  good: "Good — no fine",
  average: "Average — ₹100 fine",
  bad: "Bad — ₹500 fine",
};

export interface DailyHealthRecord {
  id?: string;
  date: string;
  meals: MealEntry[];
  caloriesBurned: number;
  isCheatDay: boolean;
  weightChecked: boolean;
  weight: number | null;
  shittyDay: ShittyDayGrade | null;
  missedDay: boolean;
  missedDayEating: MissedDayEating | null;
}

export interface CalorieSettings {
  target: number;
  maintaining: number;
  cheatDay: number;
  overEating: number;
}

export const EMPTY_CALORIE_SETTINGS: CalorieSettings = {
  target: 0,
  maintaining: 0,
  cheatDay: 0,
  overEating: 0,
};

export const emptyHealthRecord = (date: string): DailyHealthRecord => ({
  date,
  meals: [],
  caloriesBurned: 0,
  isCheatDay: false,
  weightChecked: false,
  weight: null,
  shittyDay: null,
  missedDay: false,
  missedDayEating: null,
});

export const mapSupabaseHealthRecord = (row: any): DailyHealthRecord => ({
  id: row.id,
  date: row.date,
  meals: Array.isArray(row.meals) ? row.meals : [],
  caloriesBurned: Number(row.calories_burned) || 0,
  isCheatDay: row.is_cheat_day ?? false,
  weightChecked: row.weight_checked ?? false,
  weight: row.weight === null || row.weight === undefined ? null : Number(row.weight),
  shittyDay: (row.shitty_day as ShittyDayGrade) || null,
  missedDay: row.missed_day ?? false,
  missedDayEating: (row.missed_day_eating as MissedDayEating) || null,
});

export const mapSupabaseSavedMeal = (row: any): SavedMeal => ({
  id: row.id,
  foodName: row.food_name,
  minCalorie: Number(row.min_calorie) || 0,
  maxCalorie: Number(row.max_calorie) || 0,
});
