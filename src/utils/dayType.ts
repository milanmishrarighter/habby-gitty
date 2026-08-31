export type DayType = "hard" | "medium" | "easy";

export const DAY_TYPES: DayType[] = ["hard", "medium", "easy"];

export const DAY_TYPE_LABELS: Record<DayType, string> = {
  hard: "Hard Day",
  medium: "Medium Day",
  easy: "Easy Day",
};

export const DAY_TYPE_HABIT_LABELS: Record<DayType, string> = {
  hard: "Hard — required on every day type",
  medium: "Medium — skipped on hard days",
  easy: "Easy — only on easy days",
};

// Higher rank = more room in the day. A habit shows up when the day has at
// least as much room as the habit demands.
const RANK: Record<DayType, number> = { hard: 1, medium: 2, easy: 3 };

export const isHabitActiveOnDayType = (habitDayType: DayType, dayType: DayType | null): boolean => {
  if (!dayType) return true; // No day type chosen yet — show everything.
  return RANK[habitDayType] <= RANK[dayType];
};

// Sentinel values stored in daily_habit_tracking.tracked_values. These stand in
// for "not tracked on purpose" and must never be counted as real trackings.
export const WEEK_OFF = "WEEK_OFF";
export const TEMP_HOLD = "TEMP_HOLD";

export const isSentinelTracking = (trackedValues: string[] | null | undefined): boolean =>
  !!trackedValues && (trackedValues.includes(WEEK_OFF) || trackedValues.includes(TEMP_HOLD));
