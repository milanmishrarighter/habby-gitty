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
  habitsTrackedForDay: { [habitId: string]: { trackedValues: string[], isOutOfControlMiss: boolean } } | undefined;
  allHabits: Habit[];
}

const HabitTrackingDisplay: React.FC<HabitTrackingDisplayProps> = ({ habitsTrackedForDay, allHabits }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const trackedHabitsList = React.useMemo(() => {
    if (!habitsTrackedForDay) return [];

    return Object.entries(habitsTrackedForDay)
      .map(([habitId, trackingInfo]) => {
        const habit = allHabits.find(h => h.id === habitId);
        if (!habit) return null;

        const values = Array.isArray(trackingInfo?.trackedValues) ? trackingInfo.trackedValues : [];

        if (values.length > 0) {
          return (
            <li key={habitId} className="flex items-center gap-2 text-sm text-gray-700">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: habit.color }}></div>
              <span className="font-medium">{habit.name}:</span>
              <span>{values[0]}</span>
            </li>
          );
        } else if (trackingInfo.isOutOfControlMiss) {
          return (
            <li key={habitId} className="flex items-center gap-2 text-sm text-gray-700 italic">
              <div className="w-3 h-3 rounded-full bg-gray-400"></div>
              <span className="font-medium">{habit.name}:</span>
              <span>Out-of-Control Miss</span>
            </li>
          );
        }
        return null;
      })
      .filter(Boolean); // Remove any null entries
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