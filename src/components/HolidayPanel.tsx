"use client";

import React from "react";
import { format, parseISO } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import DeleteConfirmationModal from "@/components/DeleteConfirmationModal";
import { showSuccess, showError } from "@/utils/toast";
import {
  HolidayRange,
  datesBetween,
  holidayDaysUsedInYear,
  holidayRangeFor,
  latestAllowedEnd,
  validateHolidayRange,
  updateHolidayRanges,
  withdrawDayFinesForRange,
} from "@/utils/holidays";

interface HolidayPanelProps {
  /** The dates the entry form is currently showing. */
  entryDates: string[];
  ranges: HolidayRange[];
  allowedPerYear: number;
  onRangesChange: (ranges: HolidayRange[]) => void;
  isAuthenticated: boolean;
}

const pretty = (date: string) => format(parseISO(date), "EEE, d MMM yyyy");

const describeRange = (range: HolidayRange) => {
  const days = datesBetween(range.start, range.end).length;
  return range.start === range.end
    ? `${pretty(range.start)} (1 day)`
    : `${pretty(range.start)} → ${pretty(range.end)} (${days} days)`;
};

const HolidayPanel: React.FC<HolidayPanelProps> = ({
  entryDates,
  ranges,
  allowedPerYear,
  onRangesChange,
  isAuthenticated,
}) => {
  const firstDate = entryDates[0] || format(new Date(), "yyyy-MM-dd");
  const [isBooking, setIsBooking] = React.useState(false);
  const [start, setStart] = React.useState(firstDate);
  const [end, setEnd] = React.useState(firstDate);
  const [isSaving, setIsSaving] = React.useState(false);
  const [rangeToRemove, setRangeToRemove] = React.useState<HolidayRange | null>(null);

  // Opening the form starts it on the date being entered.
  const openBooking = (open: boolean) => {
    setIsBooking(open);
    if (open) {
      setStart(firstDate);
      setEnd(firstDate);
    }
  };

  const year = (start || firstDate).slice(0, 4);
  const usedThisYear = holidayDaysUsedInYear(ranges, year);
  const leftThisYear = Math.max(0, allowedPerYear - usedThisYear);

  // The end picker can't go past the allowance or into an existing holiday.
  const maxEnd = React.useMemo(
    () => (start ? latestAllowedEnd(ranges, start, allowedPerYear) : null),
    [ranges, start, allowedPerYear],
  );
  const bookingError = isBooking ? validateHolidayRange(ranges, start, end, allowedPerYear) : null;
  const requestedDays = start && end && end >= start ? datesBetween(start, end).length : 0;

  const handleStartChange = (value: string) => {
    setStart(value);
    const nextMax = value ? latestAllowedEnd(ranges, value, allowedPerYear) : null;
    // Keep the end inside what the new start allows.
    if (!end || end < value) setEnd(value);
    else if (nextMax && end > nextMax) setEnd(nextMax);
  };

  const handleBook = async () => {
    if (!isAuthenticated) {
      showError("You must be logged in to book a holiday.");
      return;
    }
    if (bookingError) {
      showError(bookingError);
      return;
    }
    setIsSaving(true);
    try {
      // Validated again against the stored ranges, in case they changed elsewhere.
      let refused = null as string | null;
      const next = await updateHolidayRanges((stored, settingsData) => {
        refused = validateHolidayRange(stored, start, end, Number(settingsData?.yearly_holidays_allowed) || 0);
        if (refused) return stored;
        const id = typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${start}:${end}:${Date.now()}`;
        return [...stored, { id, start, end }];
      });
      onRangesChange(next);
      if (refused) {
        showError(refused);
        return;
      }

      const withdrawn = await withdrawDayFinesForRange(start, end);
      showSuccess(
        `Holiday booked: ${requestedDays} day${requestedDays === 1 ? "" : "s"}. No fines will be calculated for them.`
        + (withdrawn > 0 ? ` ${withdrawn} fine${withdrawn === 1 ? " already recorded was" : "s already recorded were"} withdrawn.` : ""),
      );
      setIsBooking(false);
    } catch (err) {
      console.error("Error booking holiday:", err);
      showError(err instanceof Error ? err.message : "Failed to book the holiday.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    const range = rangeToRemove;
    setRangeToRemove(null);
    if (!range) return;
    setIsSaving(true);
    try {
      const next = await updateHolidayRanges(stored => stored.filter(r => r.id !== range.id));
      onRangesChange(next);
      showSuccess("Holiday removed. Fines for those days are calculated again the next time you save their entries.");
    } catch (err) {
      console.error("Error removing holiday:", err);
      showError(err instanceof Error ? err.message : "Failed to remove the holiday.");
    } finally {
      setIsSaving(false);
    }
  };

  // Holidays covering any of the dates on screen.
  const activeHolidays = ranges.filter(range => entryDates.some(date => holidayRangeFor([range], date)));
  const holidayDatesOnScreen = entryDates.filter(date => holidayRangeFor(ranges, date));
  // Upcoming and this year's holidays, for managing them.
  const listYear = firstDate.slice(0, 4);
  const listed = ranges.filter(range => range.end >= `${listYear}-01-01`);

  return (
    <div className="w-full max-w-md mb-4 p-3 bg-sky-50 border border-sky-200 rounded-lg text-left">
      <div className="flex items-center justify-between gap-4">
        <label htmlFor="on-holiday-switch" className="flex-grow text-sm font-medium text-sky-900 cursor-pointer">
          On holiday
          <p className="text-xs text-sky-700">
            {allowedPerYear > 0
              ? `${leftThisYear} of ${allowedPerYear} holiday days left in ${year}. No fines are calculated on holidays.`
              : "Set how many holiday days you get a year in Settings first."}
          </p>
        </label>
        <Switch
          id="on-holiday-switch"
          checked={isBooking}
          onCheckedChange={openBooking}
          disabled={isSaving || !isAuthenticated || allowedPerYear <= 0}
        />
      </div>

      {activeHolidays.length > 0 && (
        <div className="mt-3 p-2 rounded bg-sky-100 border border-sky-300 text-xs text-sky-900">
          {entryDates.length > 1
            ? `${holidayDatesOnScreen.length} of these ${entryDates.length} days ${holidayDatesOnScreen.length === 1 ? "is a holiday" : "are holidays"}`
            : "This day is a holiday"}
          {" "}({activeHolidays.map(describeRange).join("; ")}). Record entries as usual — no fines are calculated for holiday days.
        </div>
      )}

      {isBooking && (
        <div className="mt-3 pt-3 border-t border-sky-200">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col">
              <label htmlFor="holiday-start" className="text-xs font-medium text-gray-700 mb-1">From</label>
              <input
                type="date"
                id="holiday-start"
                className="p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                value={start}
                onChange={(e) => handleStartChange(e.target.value)}
              />
            </div>
            <div className="flex flex-col">
              <label htmlFor="holiday-end" className="text-xs font-medium text-gray-700 mb-1">To</label>
              <input
                type="date"
                id="holiday-end"
                className="p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                value={end}
                min={start}
                max={maxEnd ?? start}
                onChange={(e) => setEnd(e.target.value)}
                disabled={!maxEnd}
              />
            </div>
            <Button
              type="button"
              onClick={handleBook}
              disabled={isSaving || !!bookingError}
              className="bg-sky-600 hover:bg-sky-700"
            >
              {isSaving ? "Saving..." : requestedDays > 0 ? `Book ${requestedDays} day${requestedDays === 1 ? "" : "s"}` : "Book holiday"}
            </Button>
          </div>
          {maxEnd && (
            <p className="text-xs text-gray-600 mt-2">
              Starting {pretty(start)}, you can book up to {pretty(maxEnd)}.
            </p>
          )}
          {bookingError && (
            <p className="mt-2 p-2 rounded bg-red-50 border border-red-200 text-xs text-red-800">{bookingError}</p>
          )}
        </div>
      )}

      {listed.length > 0 && (
        <div className="mt-3 pt-3 border-t border-sky-200">
          <p className="text-xs font-semibold text-sky-900 mb-1">Booked holidays</p>
          <ul className="space-y-1">
            {listed.map(range => (
              <li key={range.id} className="flex items-center justify-between gap-2 text-xs text-gray-700">
                <span>{describeRange(range)}</span>
                <button
                  type="button"
                  className="text-red-600 hover:text-red-800 underline disabled:opacity-50"
                  onClick={() => setRangeToRemove(range)}
                  disabled={isSaving}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <DeleteConfirmationModal
        isOpen={!!rangeToRemove}
        onClose={() => setRangeToRemove(null)}
        onConfirm={handleRemove}
        itemToDeleteName={rangeToRemove ? `the holiday ${describeRange(rangeToRemove)}` : "this holiday"}
      />
    </div>
  );
};

export default HolidayPanel;
