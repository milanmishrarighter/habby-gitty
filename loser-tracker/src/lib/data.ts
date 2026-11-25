import { supabase } from "./supabase";

/**
 * Reuses Habby's tables:
 *  - daily_health: one row per date. `meals` holds the food items as
 *    { foodName, minCalorie, maxCalorie }, the same shape Habby wrote, so old
 *    Habby days show up here too. Items from this app use one figure for both
 *    min and max, negative for a "minus". `weight` and `waist` hold the body
 *    measurements.
 *  - saved_meals: foods saved for reuse.
 */
export interface FoodItem {
  id: string;
  foodName: string;
  minCalorie: number;
  maxCalorie: number;
  /** Set on the single item that stands in for a missed day's guessed total. */
  guess?: boolean;
  addedAt?: string;
}

export interface Day {
  date: string;
  items: FoodItem[];
  burned: number; // calories_burned from Habby's older entries
  weight: number | null;
  waist: number | null;
}

export interface SavedFood {
  id: string;
  name: string;
  calories: number;
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const makeItem = (foodName: string, calories: number, guess = false): FoodItem => ({
  id: newId(),
  foodName,
  minCalorie: calories,
  maxCalorie: calories,
  guess: guess || undefined,
  addedAt: new Date().toISOString(),
});

export const itemCalories = (item: FoodItem) =>
  ((Number(item.minCalorie) || 0) + (Number(item.maxCalorie) || 0)) / 2;

export const dayTotal = (day: Day | undefined): number =>
  day ? Math.round(day.items.reduce((sum, item) => sum + itemCalories(item), 0) - (day.burned || 0)) : 0;

export const guessOf = (day: Day | undefined) => day?.items.find(item => item.guess) ?? null;

export const emptyDay = (date: string): Day => ({ date, items: [], burned: 0, weight: null, waist: null });

const toDay = (row: any): Day => ({
  date: String(row.date).slice(0, 10),
  items: (Array.isArray(row.meals) ? row.meals : []).map((m: any) => ({
    ...m,
    id: m.id ?? newId(),
    foodName: String(m.foodName ?? "Item"),
    minCalorie: Number(m.minCalorie) || 0,
    maxCalorie: Number(m.maxCalorie) || 0,
  })),
  burned: Number(row.calories_burned) || 0,
  weight: row.weight === null || row.weight === undefined ? null : Number(row.weight),
  waist: row.waist === null || row.waist === undefined ? null : Number(row.waist),
});

export const loadDays = async (): Promise<Record<string, Day>> => {
  const { data, error } = await supabase.from("daily_health").select("*").order("date");
  if (error) throw new Error(error.message);
  return Object.fromEntries((data || []).map(row => { const day = toDay(row); return [day.date, day]; }));
};

/** Replaces the food items for a date. Nothing else on the row is touched. */
export const saveItems = async (date: string, items: FoodItem[]) => {
  const { error } = await supabase
    .from("daily_health")
    .upsert({ date, meals: items, updated_at: new Date().toISOString() }, { onConflict: "date" });
  if (error) throw new Error(error.message);
};

export const saveMeasurements = async (date: string, weight: number | null, waist: number | null) => {
  const { error } = await supabase.from("daily_health").upsert({
    date,
    weight,
    weight_checked: weight !== null,
    waist,
    updated_at: new Date().toISOString(),
  }, { onConflict: "date" });
  if (error) {
    if (/waist/i.test(error.message)) {
      throw new Error("The waist column is missing. Run the one-time SQL from the README in Supabase.");
    }
    throw new Error(error.message);
  }
};

export const loadSavedFoods = async (): Promise<SavedFood[]> => {
  const { data, error } = await supabase.from("saved_meals").select("*").order("food_name");
  if (error) throw new Error(error.message);
  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.food_name,
    calories: Math.round(((Number(row.min_calorie) || 0) + (Number(row.max_calorie) || 0)) / 2),
  }));
};

/** Saves a food for reuse, updating its calories if it's already saved. */
export const rememberFood = async (saved: SavedFood[], name: string, calories: number): Promise<SavedFood[]> => {
  const existing = saved.find(food => food.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    if (existing.calories === calories) return saved;
    const { error } = await supabase
      .from("saved_meals")
      .update({ min_calorie: calories, max_calorie: calories, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return saved.map(food => (food.id === existing.id ? { ...food, calories } : food));
  }
  const { data, error } = await supabase
    .from("saved_meals")
    .insert([{ food_name: name, min_calorie: calories, max_calorie: calories }])
    .select()
    .single();
  if (error) throw new Error(error.message);
  return [...saved, { id: data.id, name, calories }].sort((a, b) => a.name.localeCompare(b.name));
};

export const forgetFood = async (id: string) => {
  const { error } = await supabase.from("saved_meals").delete().eq("id", id);
  if (error) throw new Error(error.message);
};
