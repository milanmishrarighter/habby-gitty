import { DailyHealthRecord, CalorieSettings, MealEntry } from "@/types/health";

export interface CalorieTotals {
  min: number;
  max: number;
  /** Midpoint of the range — what the allowance checks are judged on. */
  average: number;
}

export const calorieTotals = (
  meals: MealEntry[],
  caloriesBurned: number,
): CalorieTotals => {
  const min = meals.reduce((sum, meal) => sum + (Number(meal.minCalorie) || 0), 0) - (caloriesBurned || 0);
  const max = meals.reduce((sum, meal) => sum + (Number(meal.maxCalorie) || 0), 0) - (caloriesBurned || 0);
  return { min, max, average: (min + max) / 2 };
};

export type CalorieBand = "target" | "maintaining" | "cheat" | "over" | "unset";

export const BAND_LABELS: Record<CalorieBand, string> = {
  target: "At or under target",
  maintaining: "Maintaining",
  cheat: "Cheat day range",
  over: "Over-eating",
  unset: "Set your calorie levels in Settings",
};

/** Which band the day's average intake falls into. */
export const calorieBandFor = (average: number, settings: CalorieSettings): CalorieBand => {
  if (!settings.target && !settings.maintaining && !settings.cheatDay && !settings.overEating) {
    return "unset";
  }
  if (settings.target && average <= settings.target) return "target";
  if (settings.maintaining && average <= settings.maintaining) return "maintaining";
  if (settings.cheatDay && average <= settings.cheatDay) return "cheat";
  return "over";
};

export interface AllowanceUsage {
  targetDays: number;      // days at or under target this week
  maintainingDays: number; // days above target but at or under maintaining
}

/**
 * The weekly allowance: on non-cheat days you may sit at maintaining level twice
 * a week, and at target level four times.
 */
export const WEEKLY_MAINTAINING_ALLOWANCE = 2;
export const WEEKLY_TARGET_ALLOWANCE = 4;

export const summariseWeek = (
  records: DailyHealthRecord[],
  settings: CalorieSettings,
): AllowanceUsage => {
  let targetDays = 0;
  let maintainingDays = 0;

  records.forEach(record => {
    if (record.isCheatDay) return; // Cheat days sit outside the allowance.
    const { average } = calorieTotals(record.meals, record.caloriesBurned);
    if (record.meals.length === 0) return;
    const band = calorieBandFor(average, settings);
    if (band === "target") targetDays += 1;
    else if (band === "maintaining") maintainingDays += 1;
  });

  return { targetDays, maintainingDays };
};

export interface HealthWarning {
  text: string;
  tone: "error" | "warning" | "ok";
}

/** Everything worth telling the user about today's intake. */
export const healthWarningsFor = (
  record: DailyHealthRecord,
  settings: CalorieSettings,
  weekUsage: AllowanceUsage,
): HealthWarning[] => {
  const warnings: HealthWarning[] = [];
  if (record.meals.length === 0) return warnings;

  const { average } = calorieTotals(record.meals, record.caloriesBurned);
  const band = calorieBandFor(average, settings);

  if (band === "unset") {
    warnings.push({ text: BAND_LABELS.unset, tone: "warning" });
    return warnings;
  }

  if (record.isCheatDay) {
    if (settings.cheatDay && average > settings.cheatDay) {
      warnings.push({
        text: `Cheat day limit exceeded — ${Math.round(average)} kcal against a limit of ${settings.cheatDay}.`,
        tone: "error",
      });
    } else {
      warnings.push({ text: `Within the cheat day limit of ${settings.cheatDay} kcal.`, tone: "ok" });
    }
    return warnings;
  }

  if (band === "over") {
    warnings.push({
      text: `Over-eating — ${Math.round(average)} kcal is past every level you've set.`,
      tone: "error",
    });
  } else if (band === "cheat") {
    warnings.push({
      text: `${Math.round(average)} kcal is in cheat-day range but today isn't marked as one.`,
      tone: "error",
    });
  } else if (band === "maintaining") {
    // Today would be a maintaining day; is there room left this week?
    const used = weekUsage.maintainingDays;
    warnings.push(used >= WEEKLY_MAINTAINING_ALLOWANCE
      ? {
        text: `You've already used ${used}/${WEEKLY_MAINTAINING_ALLOWANCE} maintaining days this week.`,
        tone: "error",
      }
      : {
        text: `Maintaining day ${used + 1} of ${WEEKLY_MAINTAINING_ALLOWANCE} this week.`,
        tone: "warning",
      });
  } else if (band === "target") {
    const used = weekUsage.targetDays;
    warnings.push({
      text: `At or under target — day ${used + 1} of ${WEEKLY_TARGET_ALLOWANCE} this week. Earns ₹50.`,
      tone: "ok",
    });
  }

  return warnings;
};

export const readCalorieSettings = (settingsData: Record<string, any> | undefined): CalorieSettings => ({
  target: Number(settingsData?.target_calories) || 0,
  maintaining: Number(settingsData?.maintaining_calories) || 0,
  cheatDay: Number(settingsData?.cheat_day_calories) || 0,
  overEating: Number(settingsData?.over_eating_calories) || 0,
});
