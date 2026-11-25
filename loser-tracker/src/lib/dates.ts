import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

/** Dates are handled as local yyyy-MM-dd strings everywhere. */
export const iso = (d: Date) => format(d, "yyyy-MM-dd");
export const todayIso = () => iso(new Date());
export const shift = (date: string, days: number) => iso(addDays(parseISO(date), days));
export const daysBetween = (from: string, to: string) => differenceInCalendarDays(parseISO(to), parseISO(from));
export const pretty = (date: string, pattern = "EEE, d MMM") => format(parseISO(date), pattern);
export const weekday = (date: string) => parseISO(date).getDay(); // 0 = Sunday

export const datesFrom = (start: string, count: number) =>
  Array.from({ length: count }, (_, i) => shift(start, i));
