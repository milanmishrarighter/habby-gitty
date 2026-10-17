// Sentinel values stored in daily_habit_tracking.tracked_values. These stand in
// for "not tracked on purpose" and must never be counted as real trackings.
export const WEEK_OFF = "WEEK_OFF"; // Retired feature; still present in older records.
export const TEMP_HOLD = "TEMP_HOLD";
// Written by the retired hard/medium/easy day types for habits a day excused.
// No longer written, but older records still carry it.
export const DIFFICULTY_SKIP = "DIFFICULTY_SKIP";

const SENTINELS = [WEEK_OFF, TEMP_HOLD, DIFFICULTY_SKIP];

export const isSentinelTracking = (trackedValues: string[] | null | undefined): boolean =>
  !!trackedValues && trackedValues.some(v => SENTINELS.includes(v));

/** True when the record holds a real tracked value rather than a deliberate skip. */
export const hasRealTrackedValue = (trackedValues: string[] | null | undefined): boolean =>
  !!trackedValues && trackedValues.length > 0 && !isSentinelTracking(trackedValues);
