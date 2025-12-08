"use client";

import React from "react";
import { Habit } from "@/types/habit";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown } from "lucide-react";

interface HabitTrackingDisplayProps {
  habitsTrackedForDay: { 
    [habitId: string]: { 
      trackedValues?: string[] | string; // Accept string[] or string
      textValue?: string;
      isOutOfControlMiss: boolean;
    } 
  } | undefined;
  allHabits: Habit[];
}

const HabitTrackingDisplay: React.FC<HabitTrackingDisplayProps> = ({ habitsTrackedForDay, allHabits }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const trackedHabitsList = React.useMemo(() => {
    if (!habitsTrackedForDay) return [];

    return Object.entries(habitsTrackedForDay)
      .map(([habitIdRaw, trackingInfo]) => {
        // Normalize ids to strings to avoid strict equality mismatches (e.g., number vs string vs uuid string)
        const habitId = String(habitIdRaw);
        const habit = allHabits.find(h => String(h.id) === habitId);

        // Fallbacks if habit metadata is missing (e.g., old habits not returned due to user_id/RLS)
        const name = habit?.name ?? "Unknown habit";
        const color = habit?.color ?? "#9ca3af"; // gray-400
        const type = habit?.type; // may be undefined if not found

        // Normalize trackedValues to an array of strings
        const trackedValuesArray: string[] = Array.isArray(trackingInfo.trackedValues)
          ? trackingInfo.trackedValues
          : (typeof trackingInfo.trackedValues === "string" && trackingInfo.trackedValues.trim() !== ""
              ? [trackingInfo.trackedValues]
              : []);

        // Show tracked value if it's a tracking habit OR if we can infer tracking from having tracked values
        if ((type === "tracking" || (!type && trackedValuesArray.length > 0)) && trackedValuesArray.length > 0) {
          return (
            <li key={habitId} className="flex items-center gap-2 text-sm text-gray-700">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
              <span className="font-medium">{name}:</span>
              <span>{trackedValuesArray[0]}</span>
            </li>
          );
        } else if (trackingInfo.isOutOfControlMiss) {
          return (
            <li key={habitId} className="flex items-center gap-2 text-sm text-gray-700 italic">
              <div className="w-3 h-3 rounded-full bg-gray-400"></div>
              <span className="font-medium">{name}:</span>
              <span>Out-of-Control Miss</span>
            </li>
          );
        } else if (!trackingInfo.textValue) {
          // Not a free-text record (no text present) and no explicit tracking value:
          // still show that the habit was tracked for the day.
          return (
            <li key={habitId} className="flex items-center gap-2 text-sm text-gray-700">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
              <span className="font-medium">{name}</span>
              <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-700">Tracked</span>
            </li>
          );
        }
        return null;
      })
      .filter(Boolean) as React.ReactNode[]; // Remove any null entries
  }, [habitsTrackedForDay, allHabits]);

  if (!habitsTrackedForDay || trackedHabitsList.length === 0) {
    return <p className="text-sm text-gray-500 italic mt-4 pt-2 border-t border-gray-100 text-left">No habits tracked for this day.</p>;
  }

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="mt-4 pt-2 border-t border-gray-100 text-left"
    >
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-800 text-sm">Habits Tracked:</h4>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-9 p-0">
            <ChevronsUpDown className="h-4 w-4" />
            <span className="sr-only">Toggle habits</span>
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="space-y-1 mt-2">
        <ul className="list-none space-y-1">
          {trackedHabitsList}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default HabitTrackingDisplay;