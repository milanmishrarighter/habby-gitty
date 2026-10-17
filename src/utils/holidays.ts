import { supabase } from "@/lib/supabase";
import { addDays, format, parseISO } from "date-fns";

/**
 * Holidays: date ranges during which no fine of any kind is calculated. Habits,
 * health and journal entries are still recorded as normal — only fines are off.
 *
 * Both the ranges and the yearly allowance live in app_settings.settings_data,
 * so they need no table of their own:
 *   yearly_holidays_allowed: number            — holiday days allowed per calendar year
 *   holiday_ranges: { id, start, end }[]       — inclusive yyyy-MM-dd bounds
 */
export interface HolidayRange {
  id: string;
  start: string; // yyyy-MM-dd, inclusive
  end: string;   // yyyy-MM-dd, inclusive
}

export const HOLIDAY_RANGES_KEY = "holiday_ranges";
export const HOLIDAYS_ALLOWED_KEY = "yearly_holidays_allowed";

// Hard stop on day-by-day walks, so a corrupt range can never loop for long.
const MAX_WALK_DAYS = 800;

const isDateString = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** Every yyyy-MM-dd from start to end, inclusive. Parsed as local dates. */
export const datesBetween = (start: string, end: string): string[] => {
  const dates: string[] = [];
  let day = parseISO(start);
  const last = parseISO(end);
  while (day <= last && dates.length < MAX_WALK_DAYS) {
    dates.push(format(day, "yyyy-MM-dd"));
    day = addDays(day, 1);
  }
  return dates;
};

export const readHolidayRanges = (settingsData: Record<string, any> | null | undefined): HolidayRange[] => {
  const raw = settingsData?.[HOLIDAY_RANGES_KEY];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r: any) => r && isDateString(r.start) && isDateString(r.end) && r.start <= r.end)
    .map((r: any) => ({ id: String(r.id ?? `${r.start}:${r.end}`), start: r.start, end: r.end }))
    .sort((a, b) => (a.start < b.start ? -1 : 1));
};

export const readHolidaysAllowed = (settingsData: Record<string, any> | null | undefined): number =>
  Math.max(0, Number(settingsData?.[HOLIDAYS_ALLOWED_KEY]) || 0);

/** yyyy-MM-dd strings compare correctly as plain strings. */
export const isHoliday = (ranges: HolidayRange[], date: string): boolean =>
  ranges.some(r => r.start <= date && date <= r.end);

/** The range covering `date`, if any. */
export const holidayRangeFor = (ranges: HolidayRange[], date: string): HolidayRange | undefined =>
  ranges.find(r => r.start <= date && date <= r.end);

/** How many days of [start, end] are holidays. */
export const countHolidayDaysBetween = (ranges: HolidayRange[], start: string, end: string): number =>
  ranges.reduce((total, r) => {
    const from = r.start > start ? r.start : start;
    const to = r.end < end ? r.end : end;
    return from <= to ? total + datesBetween(from, to).length : total;
  }, 0);

export const holidayDaysUsedInYear = (ranges: HolidayRange[], year: string | number): number =>
  countHolidayDaysBetween(ranges, `${year}-01-01`, `${year}-12-31`);

/**
 * The furthest end date a new holiday starting on `start` may run to: it stops
 * before running into an existing holiday, and before any calendar year it
 * touches would go over the allowance. Null when `start` itself isn't allowed.
 */
export const latestAllowedEnd = (
  ranges: HolidayRange[],
  start: string,
  allowedPerYear: number,
): string | null => {
  if (!isDateString(start)) return null;
  const usedByYear: Record<string, number> = {};
  let latest: string | null = null;
  let day = parseISO(start);

  for (let i = 0; i < MAX_WALK_DAYS; i++) {
    const date = format(day, "yyyy-MM-dd");
    if (isHoliday(ranges, date)) break;
    const year = date.slice(0, 4);
    if (usedByYear[year] === undefined) usedByYear[year] = holidayDaysUsedInYear(ranges, year);
    if (usedByYear[year] + 1 > allowedPerYear) break;
    usedByYear[year] += 1;
    latest = date;
    day = addDays(day, 1);
  }
  return latest;
};

/** Why [start, end] can't be booked as a holiday, or null when it can. */
export const validateHolidayRange = (
  ranges: HolidayRange[],
  start: string,
  end: string,
  allowedPerYear: number,
): string | null => {
  if (!isDateString(start) || !isDateString(end)) return "Pick both a start and an end date.";
  if (end < start) return "The end date must be on or after the start date.";
  if (allowedPerYear <= 0) return "No holiday days are allowed yet — set a yearly allowance in Settings.";

  const clash = ranges.find(r => r.start <= end && start <= r.end);
  if (clash) return `This overlaps the holiday already booked for ${clash.start} → ${clash.end}.`;

  const requested: Record<string, number> = {};
  datesBetween(start, end).forEach(date => {
    const year = date.slice(0, 4);
    requested[year] = (requested[year] || 0) + 1;
  });
  for (const [year, days] of Object.entries(requested)) {
    const used = holidayDaysUsedInYear(ranges, year);
    if (used + days > allowedPerYear) {
      const left = Math.max(0, allowedPerYear - used);
      return `That's ${days} day${days === 1 ? "" : "s"} in ${year}, but only ${left} of your ${allowedPerYear} holiday days are left for ${year}.`;
    }
  }
  return null;
};

/** Reads the holiday ranges straight from the database. */
export const fetchHolidayRanges = async (): Promise<HolidayRange[]> => {
  const { data, error } = await supabase
    .from("app_settings")
    .select("settings_data")
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("Error fetching holidays:", error);
    throw new Error("Couldn't load your holidays.");
  }
  return readHolidayRanges(data?.settings_data);
};

/**
 * Applies `change` to the stored ranges and writes them back. The settings row
 * is read fresh first so nothing else in settings_data is overwritten.
 */
export const updateHolidayRanges = async (
  change: (ranges: HolidayRange[], settingsData: Record<string, any>) => HolidayRange[],
): Promise<HolidayRange[]> => {
  const { data, error } = await supabase
    .from("app_settings")
    .select("id, settings_data")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const settingsData: Record<string, any> = data?.settings_data || {};
  const next = change(readHolidayRanges(settingsData), settingsData)
    .slice()
    .sort((a, b) => (a.start < b.start ? -1 : 1));
  const updated = { ...settingsData, [HOLIDAY_RANGES_KEY]: next };

  const { error: writeError } = data
    ? await supabase.from("app_settings").update({ settings_data: updated }).eq("id", data.id)
    : await supabase.from("app_settings").insert([{ settings_data: updated }]);
  if (writeError) throw new Error(writeError.message);
  return next;
};

/**
 * Withdraws the unpaid automatic fines already booked against single holiday
 * days — late entries, health fines, out-of-control misses and daily habit
 * conditions. These all key on the date itself, so their tracking_value ends
 * in `:yyyy-MM-dd`. Weekly, monthly and yearly fines are re-judged with the
 * holiday taken into account the next time an entry in that period is saved.
 */
export const withdrawDayFinesForRange = async (start: string, end: string): Promise<number> => {
  const { data, error } = await supabase
    .from("fines_status")
    .select("id, tracking_value, entry_date")
    .eq("type", "fine")
    .eq("is_auto", true)
    .eq("status", "unpaid")
    .gte("entry_date", start)
    .lte("entry_date", end);
  if (error) throw new Error(error.message);

  const ids = (data || [])
    .filter((row: any) => {
      const date = String(row.entry_date).slice(0, 10);
      return typeof row.tracking_value === "string" && row.tracking_value.endsWith(`:${date}`);
    })
    .map((row: any) => row.id);
  if (ids.length === 0) return 0;

  const { error: deleteError } = await supabase.from("fines_status").delete().in("id", ids);
  if (deleteError) throw new Error(deleteError.message);
  return ids.length;
};
