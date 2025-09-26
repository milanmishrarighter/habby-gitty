"use client";

import React from 'react';
import { showSuccess, showError } from '@/utils/toast';

interface Habit {
  id: string;
  name: string;
  color: string;
  trackingValues: string[]; // All possible values to track
  yearlyGoal: {
    count: number; // Target count
    contributingValues: string[]; // Subset of trackingValues that contribute to the yearly goal
  };
}

interface DailyHabitTrackerCardProps {
  habit: Habit;
  entryDate: string; // The date for which we are tracking
  onUpdateTracking: (habitId: string, date: string, trackedValues: string[], yearlyProgress: number) => void;
  currentYearlyProgress: number;
  initialTrackedValue: string | null; // Changed to single string or null
}

const DailyHabitTrackerCard: React.FC<DailyHabitTrackerCardProps> = ({
  habit,
  entryDate,
  onUpdateTracking,
  currentYearlyProgress,
  initialTrackedValue,
}) => {
  const [selectedTrackingValue, setSelectedTrackingValue] = React.useState<string | null>(initialTrackedValue);
  const [displayYearlyProgress, setDisplayYearlyProgress] = React.useState(currentYearlyProgress);

  React.useEffect(() => {
    setSelectedTrackingValue(initialTrackedValue);
  }, [initialTrackedValue]);

  React.useEffect(() => {
    setDisplayYearlyProgress(currentYearlyProgress);
  }, [currentYearlyProgress]);

  const handleValueClick = (value: string) => {
    if (!entryDate) {
      showError("Please select a date first to track habits.");
      return;
    }

    let newSelectedValue: string | null;
    let newYearlyProgress = displayYearlyProgress;

    // Check if the clicked value is already selected (deselection)
    if (selectedTrackingValue === value) {
      newSelectedValue = null;
      // If the deselected value was a contributing value, decrement progress
      if (habit.yearlyGoal.contributingValues.includes(value)) {
        newYearlyProgress = Math.max(0, newYearlyProgress - 1);
      }
    } else {
      // A new value is being selected
      newSelectedValue = value;
      // If there was a previously selected value and it was contributing, decrement its effect
      if (selectedTrackingValue && habit.yearlyGoal.contributingValues.includes(selectedTrackingValue)) {
        newYearlyProgress = Math.max(0, newYearlyProgress - 1);
      }
      // If the newly selected value is a contributing value, increment its effect
      if (habit.yearlyGoal.contributingValues.includes(value)) {
        newYearlyProgress += 1;
      }
    }

    setSelectedTrackingValue(newSelectedValue);
    setDisplayYearlyProgress(newYearlyProgress);

    // Pass an array with one item or an empty array to onUpdateTracking
    onUpdateTracking(habit.id, entryDate, newSelectedValue ? [newSelectedValue] : [], newYearlyProgress);
    showSuccess(`Habit '${habit.name}' updated for ${entryDate}!`);
  };

  return (
    <div className="p-4 rounded-lg shadow-md flex flex-col space-y-3" style={{ backgroundColor: `${habit.color}33` }}>
      <div className="flex items-center justify-between">
        <span className="text-gray-800 font-bold text-lg">{habit.name}</span>
        <div className="flex items-center gap-2">
          {habit.yearlyGoal.count > 0 && (
            <span className="text-sm font-semibold text-gray-600">
              {displayYearlyProgress} / {habit.yearlyGoal.count}
            </span>
          )}
          <div className="w-6 h-6 rounded-full border-2 border-white shadow" style={{ backgroundColor: habit.color }}></div>
        </div>
      </div>

      {habit.trackingValues && habit.trackingValues.length > 0 && (
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
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyHabitTrackerCard;