"use client";

import React from 'react';
import { showSuccess } from '@/utils/toast';

interface Habit {
  id: string;
  name: string;
  color: string;
  trackingValues: string[];
  yearlyGoal: {
    count: number;
    contributingValues: string[];
  };
}

interface DailyHabitTrackerCardProps {
  habit: Habit;
  entryDate: string; // The date for which we are tracking
  onUpdateTracking: (habitId: string, date: string, trackedValues: string[], yearlyProgress: number) => void;
  currentYearlyProgress: number;
  initialTrackedValues: string[];
}

const DailyHabitTrackerCard: React.FC<DailyHabitTrackerCardProps> = ({
  habit,
  entryDate,
  onUpdateTracking,
  currentYearlyProgress,
  initialTrackedValues,
}) => {
  const [trackedValues, setTrackedValues] = React.useState<string[]>(initialTrackedValues);

  React.useEffect(() => {
    setTrackedValues(initialTrackedValues);
  }, [initialTrackedValues]);

  const handleCheckboxChange = (value: string, isChecked: boolean) => {
    let newTrackedValues: string[];
    let newYearlyProgress = currentYearlyProgress;

    if (isChecked) {
      newTrackedValues = [...trackedValues, value];
      if (habit.yearlyGoal.contributingValues.includes(value)) {
        newYearlyProgress += 1;
      }
    } else {
      newTrackedValues = trackedValues.filter((v) => v !== value);
      if (habit.yearlyGoal.contributingValues.includes(value)) {
        newYearlyProgress -= 1;
      }
    }
    setTrackedValues(newTrackedValues);
    onUpdateTracking(habit.id, entryDate, newTrackedValues, newYearlyProgress);
    showSuccess(`Habit '${habit.name}' updated for ${entryDate}!`);
  };

  const progressPercentage = habit.yearlyGoal.count > 0
    ? Math.min(100, (currentYearlyProgress / habit.yearlyGoal.count) * 100)
    : 0;

  return (
    <div className="p-4 rounded-lg shadow-md flex flex-col space-y-3" style={{ backgroundColor: `${habit.color}33` }}>
      <div className="flex items-center justify-between">
        <span className="text-gray-800 font-bold text-lg">{habit.name}</span>
        <div className="w-6 h-6 rounded-full border-2 border-white shadow" style={{ backgroundColor: habit.color }}></div>
      </div>

      {habit.trackingValues && habit.trackingValues.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {habit.trackingValues.map((value, index) => (
            <span key={index} className="bg-gray-200 text-gray-700 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {value}
            </span>
          ))}
        </div>
      )}

      {habit.yearlyGoal.count > 0 && (
        <div className="mt-2 text-sm text-gray-600">
          <h4 className="font-semibold mb-1">Yearly Goal: {currentYearlyProgress} / {habit.yearlyGoal.count}</h4>
          <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
            <div
              className="h-2.5 rounded-full"
              style={{ width: `${progressPercentage}%`, backgroundColor: habit.color }}
            ></div>
          </div>
          {habit.yearlyGoal.contributingValues && habit.yearlyGoal.contributingValues.length > 0 && (
            <div className="mt-3">
              <p className="font-medium mb-1">Track for today:</p>
              <div className="flex flex-wrap gap-2">
                {habit.yearlyGoal.contributingValues.map((value, index) => (
                  <label key={index} className="inline-flex items-center space-x-2 bg-gray-100 px-3 py-1 rounded-full text-sm font-medium text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      value={value}
                      className="form-checkbox rounded text-blue-600 focus:ring-blue-500 focus:ring-2 h-4 w-4"
                      checked={trackedValues.includes(value)}
                      onChange={(e) => handleCheckboxChange(value, e.target.checked)}
                      disabled={!entryDate} // Disable if no date is selected
                    />
                    <span>{value}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DailyHabitTrackerCard;