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

/** How a cheat day went, in place of logging its meals. */
export type CheatDayOutcome = "under" | "over";

export const CHEAT_DAY_LIMIT_KCAL = 3500;

export const CHEAT_DAY_OUTCOME_LABELS: Record<CheatDayOutcome, string> = {
  under: `I ate below ${CHEAT_DAY_LIMIT_KCAL} cals`,
  over: `I definitely ate more than ${CHEAT_DAY_LIMIT_KCAL} cals`,
};

/**
 * The calories a cheat day is recorded as, since its meals aren't logged.
 * Over the limit is booked at a fixed 4250 rather than an unknown real figure.
 */
export const CHEAT_DAY_RECORDED_KCAL: Record<CheatDayOutcome, number> = {
  under: 3500,
  over: 4250,
};

/** Name of the single meal row a cheat day is stored as. */
const CHEAT_DAY_MEAL_NAME = "Cheat day";

export const cheatDayMeal = (outcome: CheatDayOutcome): MealEntry => ({
  foodName: `${CHEAT_DAY_MEAL_NAME} — ${CHEAT_DAY_OUTCOME_LABELS[outcome].toLowerCase()}`,
  minCalorie: CHEAT_DAY_RECORDED_KCAL[outcome],
  maxCalorie: CHEAT_DAY_RECORDED_KCAL[outcome],
});

/** Whether a meal row is the stand-in written for a cheat day, not real food. */
export const isCheatDayMeal = (meal: MealEntry): boolean =>
  meal.foodName.startsWith(`${CHEAT_DAY_MEAL_NAME} — `);

/** Every cheat day kept under the limit earns this. */
export const CHEAT_DAY_UNDER_REWARD = 100;
/** Going over is allowed this many times a calendar month without a fine. */
export const CHEAT_DAY_OVER_FREE_PER_MONTH = 2;
/** Charged for each over-the-limit cheat day beyond the free ones that month. */
export const CHEAT_DAY_OVER_FINE = 500;

/** What a missed day costs, by how the eating went. */
export const MISSED_DAY_FINES: Record<MissedDayEating, number> = {
  good: 0,
  average: 100,
  bad: 500,
};

/** The calories a missed day is recorded as, by how the eating went. */
export const MISSED_DAY_RECORDED_KCAL: Record<MissedDayEating, number> = {
  good: 2000,
  average: 2500,
  bad: 3500,
};

/** Name of the single meal row a missed day is stored as. */
const MISSED_DAY_MEAL_NAME = "Missed day";

export const missedDayMeal = (eating: MissedDayEating): MealEntry => ({
  foodName: `${MISSED_DAY_MEAL_NAME} — ${eating} eating`,
  minCalorie: MISSED_DAY_RECORDED_KCAL[eating],
  maxCalorie: MISSED_DAY_RECORDED_KCAL[eating],
});

/** Whether a meal row is the stand-in written for a missed day, not real food. */
export const isMissedDayMeal = (meal: MealEntry): boolean =>
  meal.foodName.startsWith(`${MISSED_DAY_MEAL_NAME} — `);

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
  cheatDayOutcome: CheatDayOutcome | null;
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
  cheatDayOutcome: null,
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
  cheatDayOutcome: (row.cheat_day_outcome as CheatDayOutcome) || null,
});

export const mapSupabaseSavedMeal = (row: any): SavedMeal => ({
  id: row.id,
  foodName: row.food_name,
  minCalorie: Number(row.min_calorie) || 0,
  maxCalorie: Number(row.max_calorie) || 0,
});
