"use client";

import React from 'react';
import { showSuccess, showError } from '@/utils/toast';
import { Habit } from '@/types/habit';
import { YearlyOutOfControlMissCount } from '@/types/tracking'; // Import new type
import { Switch } from "@/components/ui/switch"; // Assuming shadcn/ui Switch component

interface DailyHabitTrackerCardProps {
  habit: Habit;
  entryDate: string; // The date for which we are tracking
  onUpdateTracking: (
    habitId: string,
    date: string,
    trackedValues: string[],
    yearlyProgress: number,
    isOutOfControlMiss: boolean, // New parameter
    oldIsOutOfControlMiss: boolean, // New parameter
  ) => Promise<void>;
  currentYearlyProgress: number;
  initialTrackedValue: string | null;
  initialIsOutOfControlMiss: boolean; // New parameter
  yearlyOutOfControlMissCounts: { [habitId: string]: YearlyOutOfControlMissCount }; // New parameter
  weeklyTrackingCounts: { [trackingValue: string]: number }; // New prop
  monthlyTrackingCounts: { [trackingValue: string]: number }; // New prop
}

const DailyHabitTrackerCard: React.FC<DailyHabitTrackerCardProps> = ({
  habit,
  entryDate,
  onUpdateTracking,
  currentYearlyProgress,
  initialTrackedValue,
  initialIsOutOfControlMiss,
  yearlyOutOfControlMissCounts,
  weeklyTrackingCounts, // Destructure new prop
  monthlyTrackingCounts, // Destructure new prop
}) => {
  const [selectedTrackingValue, setSelectedTrackingValue] = React.useState<string | null>(initialTrackedValue);
  const [displayYearlyProgress, setDisplayYearlyProgress] = React.useState(currentYearlyProgress);
  const [isOutOfControlMiss, setIsOutOfControlMiss] = React.useState(initialIsOutOfControlMiss);

  const currentYear = new Date(entryDate).getFullYear().toString();
  const habitMissCount = yearlyOutOfControlMissCounts[habit.id];
  const usedMisses = habitMissCount?.used_count || 0;
  const allowedMisses = habit.allowedOutOfControlMisses || 0;
  const remainingMisses = allowedMisses - usedMisses;

  React.useEffect(() => {
    setSelectedTrackingValue(initialTrackedValue);
    setIsOutOfControlMiss(initialIsOutOfControlMiss);
  }, [initialTrackedValue, initialIsOutOfControlMiss]);

  React.useEffect(() => {
    setDisplayYearlyProgress(currentYearlyProgress);
  }, [currentYearlyProgress]);

  const handleValueClick = async (value: string) => {
    if (!entryDate) {
      showError("Please select a date first to track habits.");
      return;
    }

    let newSelectedValue: string | null;
    let newYearlyProgress = displayYearlyProgress;
    let oldIsOutOfControlMissState = isOutOfControlMiss; // Capture current state before potential change

    // Safely access contributingValues
    const contributingValues = habit.yearlyGoal?.contributingValues || [];

    if (selectedTrackingValue === value) {
      // Untracking the current value
      newSelectedValue = null;
      if (contributingValues.includes(value)) {
        newYearlyProgress = Math.max(0, newYearlyProgress - 1);
      }
    } else {
      // Tracking a new value
      newSelectedValue = value;
      if (selectedTrackingValue && contributingValues.includes(selectedTrackingValue)) {
        newYearlyProgress = Math.max(0, newYearlyProgress - 1); // Decrement if previous was contributing
      }
      if (contributingValues.includes(value)) {
        newYearlyProgress += 1; // Increment if new is contributing
      }
    }

    // If a value is selected, it cannot be an out-of-control miss
    if (newSelectedValue !== null && isOutOfControlMiss) {
      setIsOutOfControlMiss(false); // Automatically uncheck out-of-control miss if a value is tracked
    }

    setSelectedTrackingValue(newSelectedValue);
    setDisplayYearlyProgress(newYearlyProgress);

    await onUpdateTracking(
      habit.id,
      entryDate,
      newSelectedValue ? [newSelectedValue] : [],
      newYearlyProgress,
      newSelectedValue === null && isOutOfControlMiss, // Pass the state after potential auto-uncheck
      oldIsOutOfControlMissState
    );
    showSuccess(`Habit '${habit.name}' updated for ${entryDate}!`);
  };

  const handleOutOfControlMissToggle = async (checked: boolean) => {
    if (!entryDate) {
      showError("Please select a date first to track habits.");
      return;
    }

    if (selectedTrackingValue !== null) {
      showError("Cannot mark as 'Out-of-Control Miss' if a value is already tracked.");
      return;
    }

    if (checked && remainingMisses <= 0) {
      showError(`You have used all ${allowedMisses} allowed out-of-control misses for '${habit.name}' this year.`);
      return;
    }

    const oldIsOutOfControlMissState = isOutOfControlMiss;
    setIsOutOfControlMiss(checked);

    await onUpdateTracking(
      habit.id,
      entryDate,
      [], // No tracked values when marking as out-of-control miss
      displayYearlyProgress, // Yearly progress doesn't change for out-of-control miss
      checked,
      oldIsOutOfControlMissState
    );
    showSuccess(`Habit '${habit.name}' marked as out-of-control miss for ${entryDate}.`);
  };

  const isMissed = selectedTrackingValue === null;

  return (
    <div className="p-4 rounded-lg shadow-md flex flex-col space-y-3" style={{ backgroundColor: `${habit.color}33` }}>
      <div className="flex items-center justify-between">
        <span className="text-gray-800 font-bold text-lg">{habit.name}</span>
        <div className="flex items-center gap-2">
          {habit.yearlyGoal && habit.yearlyGoal.count > 0 && (
            <span className="text-sm font-semibold text-gray-600">
              {displayYearlyProgress} / {habit.yearlyGoal.count}
            </span>
          )}
          <div className="w-6 h-6 rounded-full border-2 border-white shadow" style={{ backgroundColor: habit.color }}></div>
        </div>
      </div>

      {(habit.trackingValues && habit.trackingValues.length > 0) && (
        <div className="mt-2">
          <p className="font-medium mb-1 text-left">Track for today:</p>
          <div className="flex flex-wrap gap-2">
            {habit.trackingValues.map((value, index) => (
              <div
                key={index}
                className={`cursor-pointer px-4 py-2 rounded-lg border-2 transition-all duration-200
                  ${selectedTrackingValue === value
                    ? `bg-blue-100 border-blue-500 text-blue-800`
                    : `bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200`
                  }
                  ${!entryDate ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                onClick={() => handleValueClick(value)}
              >
                {value}
                <span className="ml-2 text-xs text-gray-500">
                  (W:{weeklyTrackingCounts[value] || 0}/M:{monthlyTrackingCounts[value] || 0})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Out-of-Control Miss Toggle */}
      {isMissed && allowedMisses > 0 && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
          <label htmlFor={`out-of-control-miss-${habit.id}`} className="flex-grow text-sm font-medium text-gray-700 text-left cursor-pointer">
            Mark as Out-of-Control Miss
            <p className="text-xs text-gray-500">({remainingMisses} / {allowedMisses} remaining this year)</p>
          </label>
          <Switch
            id={`out-of-control-miss-${habit.id}`}
            checked={isOutOfControlMiss}
            onCheckedChange={handleOutOfControlMissToggle}
            disabled={!entryDate || (isOutOfControlMiss === false && remainingMisses <= 0)}
          />
        </div>
      )}
    </div>
  );
};

export default DailyHabitTrackerCard;