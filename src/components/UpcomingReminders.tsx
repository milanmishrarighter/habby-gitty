"use client";

import React from "react";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { Bell } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Reminder, mapSupabaseReminder, upcomingReminders } from "@/utils/reminders";

interface UpcomingRemindersProps {
  /** The date the entry is being written for; reminders are counted from here. */
  fromDate: string;
}

const UpcomingReminders: React.FC<UpcomingRemindersProps> = ({ fromDate }) => {
  const [reminders, setReminders] = React.useState<Reminder[]>([]);

  React.useEffect(() => {
    let mounted = true;
    supabase.from("reminders").select("*").then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        console.error("Error loading reminders:", error);
        return;
      }
      setReminders((data || []).map(mapSupabaseReminder));
    });
    return () => { mounted = false; };
  }, []);

  if (!fromDate) return null;
  const upcoming = upcomingReminders(reminders, fromDate, 2);
  if (upcoming.length === 0) return null;

  const describeWhen = (occursOn: string) => {
    const days = differenceInCalendarDays(parseISO(occursOn), parseISO(fromDate));
    if (days === 0) return "that day";
    if (days === 1) return "the next day";
    return `in ${days} days`;
  };

  return (
    <div className="w-full max-w-md mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-left">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <Bell className="h-4 w-4" />
        Next {upcoming.length === 1 ? "approaching reminder" : "2 approaching reminders"}
      </p>
      <ul className="mt-2 space-y-1">
        {upcoming.map(({ reminder, occursOn }) => (
          <li key={reminder.id} className="flex justify-between gap-3 text-sm text-amber-900">
            <span>{reminder.text}</span>
            <span className="shrink-0 text-amber-700">
              {format(parseISO(occursOn), "EEE, d MMM")} · {describeWhen(occursOn)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default UpcomingReminders;
