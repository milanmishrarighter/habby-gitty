import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  startOfMonth,
  endOfMonth,
  addMonths,
  format,
  isBefore,
  isSameWeek,
  isSameMonth,
  startOfYear,
  endOfYear,
  addDays,
} from 'date-fns';

// Helper to get all weeks in a year, starting on Monday
export const getWeeksInYear = (year: number) => {
  const weeks = [];
  let currentWeekStart = startOfWeek(new Date(year, 0, 1), { weekStartsOn: 1 }); // Monday start
  const yearEnd = endOfYear(new Date(year, 0, 1));

  while (isBefore(currentWeekStart, yearEnd) || isSameWeek(currentWeekStart, yearEnd, { weekStartsOn: 1 })) {
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
    weeks.push({
      start: currentWeekStart,
      end: weekEnd,
      label: `Week ${format(currentWeekStart, 'w')}`,
      periodKey: format(currentWeekStart, 'yyyy-Www'), // e.g., 2025-W39
    });
    currentWeekStart = addWeeks(currentWeekStart, 1);
  }
  return weeks;
};

// Helper to get all months in a year
export const getMonthsInYear = (year: number) => {
  const months = [];
  let currentMonthStart = startOfMonth(new Date(year, 0, 1));
  const yearEnd = endOfYear(new Date(year, 0, 1));

  while (isBefore(currentMonthStart, yearEnd) || isSameMonth(currentMonthStart, yearEnd)) {
    const monthEnd = endOfMonth(currentMonthStart);
    months.push({
      start: currentMonthStart,
      end: monthEnd,
      label: format(currentMonthStart, 'MMMM yyyy'),
      periodKey: format(currentMonthStart, 'yyyy-MM'), // e.g., 2025-09
    });
    currentMonthStart = addMonths(currentMonthStart, 1);
  }
  return months;
};

export const formatDateRange = (start: Date, end: Date) => {
  const startFormat = format(start, 'MMM dd');
  const endFormat = format(end, 'MMM dd, yyyy');
  return `${startFormat} - ${endFormat}`;
};

export const getDatesInPeriod = (startDate: Date, endDate: Date): string[] => {
  const dates: string[] = [];
  let currentDate = startDate;
  while (isBefore(currentDate, endDate) || format(currentDate, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd')) {
    dates.push(format(currentDate, 'yyyy-MM-dd'));
    currentDate = addDays(currentDate, 1);
  }
  return dates;
};