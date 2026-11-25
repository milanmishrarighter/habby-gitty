import { daysBetween, shift, weekday, datesFrom } from "./dates";

/**
 * Months here are not calendar months: every 4 weeks from the start Monday is
 * one month, and every 7 days from it is one week.
 */
export const DAYS_PER_WEEK = 7;
export const WEEKS_PER_MONTH = 4;
export const DAYS_PER_MONTH = DAYS_PER_WEEK * WEEKS_PER_MONTH;

export interface Limits {
  weekdayLimit: number;
  saturdayLimit: number;
  sundayLimit: number;
  weeklyLimit: number;
  monthlyLimit: number;
}

export interface Span {
  index: number; // 0 = the first month/week from the start date
  start: string;
  end: string;
  dates: string[];
}

const spanAt = (cycleStart: string, length: number, index: number): Span => {
  const start = shift(cycleStart, index * length);
  return { index, start, end: shift(start, length - 1), dates: datesFrom(start, length) };
};

/** Which month (0-based) a date falls in; negative before the start date. */
export const monthIndexOf = (cycleStart: string, date: string) =>
  Math.floor(daysBetween(cycleStart, date) / DAYS_PER_MONTH);

export const monthAt = (cycleStart: string, index: number) => spanAt(cycleStart, DAYS_PER_MONTH, index);
export const monthOf = (cycleStart: string, date: string) => monthAt(cycleStart, monthIndexOf(cycleStart, date));

export const weekOf = (cycleStart: string, date: string) =>
  spanAt(cycleStart, DAYS_PER_WEEK, Math.floor(daysBetween(cycleStart, date) / DAYS_PER_WEEK));

/** The visual target for a single day: Saturday and Sunday have their own. */
export const dayLimit = (limits: Limits, date: string) => {
  const day = weekday(date);
  if (day === 6) return limits.saturdayLimit;
  if (day === 0) return limits.sundayLimit;
  return limits.weekdayLimit;
};

/** good under 85% of the limit, close up to it, over beyond it. */
export type Standing = "good" | "close" | "over" | "unset";
export const standing = (used: number, limit: number): Standing => {
  if (!limit) return "unset";
  if (used > limit) return "over";
  if (used >= limit * 0.85) return "close";
  return "good";
};
