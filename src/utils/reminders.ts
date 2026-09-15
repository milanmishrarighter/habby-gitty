import { format, parseISO, isLeapYear } from "date-fns";

export interface Reminder {
  id: string;
  /** yyyy-MM-dd. For a yearly reminder only the month and day matter. */
  date: string;
  text: string;
  repeatsYearly: boolean;
}

export interface UpcomingReminder {
  reminder: Reminder;
  /** yyyy-MM-dd of the occurrence being shown. */
  occursOn: string;
}

export const mapSupabaseReminder = (row: any): Reminder => ({
  id: row.id,
  date: row.reminder_date,
  text: row.text,
  repeatsYearly: row.repeats_yearly ?? false,
});

/** The reminder's month and day placed in `year`, with Feb 29 falling back to Feb 28. */
const inYear = (date: string, year: number): string => {
  const [, month, day] = date.split("-").map(Number);
  const safeDay = month === 2 && day === 29 && !isLeapYear(new Date(year, 0, 1)) ? 28 : day;
  return format(new Date(year, month - 1, safeDay), "yyyy-MM-dd");
};

/**
 * The first time this reminder falls on or after `fromDate`, or null if a
 * one-off reminder is already in the past.
 */
export const nextOccurrence = (reminder: Reminder, fromDate: string): string | null => {
  if (!reminder.repeatsYearly) {
    return reminder.date >= fromDate ? reminder.date : null;
  }
  const fromYear = parseISO(fromDate).getFullYear();
  const thisYear = inYear(reminder.date, fromYear);
  return thisYear >= fromDate ? thisYear : inYear(reminder.date, fromYear + 1);
};

/** The next `count` reminders on or after `fromDate`, soonest first. */
export const upcomingReminders = (
  reminders: Reminder[],
  fromDate: string,
  count = 2,
): UpcomingReminder[] =>
  reminders
    .map(reminder => ({ reminder, occursOn: nextOccurrence(reminder, fromDate) }))
    .filter((item): item is UpcomingReminder => item.occursOn !== null)
    .sort((a, b) => a.occursOn.localeCompare(b.occursOn))
    .slice(0, count);
