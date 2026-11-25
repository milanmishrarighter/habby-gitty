"use client";

import React from "react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

/** Reminders this many days away or closer flash. */
export const FLASH_WITHIN_DAYS = 7;

// One flash cycle at 7 days out, and on the day itself. Every day closer
// speeds it up evenly between the two.
const SLOWEST_FLASH_SECONDS = 1.8;
const FASTEST_FLASH_SECONDS = 0.35;

export const daysUntil = (occursOn: string): number =>
  differenceInCalendarDays(parseISO(occursOn), parseISO(format(new Date(), "yyyy-MM-dd")));

export const flashSecondsFor = (days: number): number => {
  const clamped = Math.min(Math.max(days, 0), FLASH_WITHIN_DAYS);
  return FASTEST_FLASH_SECONDS
    + ((SLOWEST_FLASH_SECONDS - FASTEST_FLASH_SECONDS) * clamped) / FLASH_WITHIN_DAYS;
};

interface ReminderCountdownProps {
  /** yyyy-MM-dd of the occurrence. */
  occursOn: string;
  className?: string;
}

/**
 * A countdown pill for a reminder. Within a week it flashes, and the closer
 * the date, the faster it flashes. Further out it renders nothing.
 */
const ReminderCountdown: React.FC<ReminderCountdownProps> = ({ occursOn, className }) => {
  const days = daysUntil(occursOn);
  if (days < 0 || days > FLASH_WITHIN_DAYS) return null;

  const label = days === 0 ? "TODAY" : days === 1 ? "TOMORROW" : `${days} DAYS`;
  return (
    <span
      className={cn(
        "reminder-flash inline-flex items-center gap-1 shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold tracking-wide text-white",
        days <= 1 ? "bg-red-600" : days <= 3 ? "bg-orange-500" : "bg-amber-500",
        className,
      )}
      style={{ animationDuration: `${flashSecondsFor(days)}s` }}
      title={`${days === 0 ? "Today" : `In ${days} day${days === 1 ? "" : "s"}`} — ${format(parseISO(occursOn), "d MMM yyyy")}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-white" />
      {label}
    </span>
  );
};

export default ReminderCountdown;
