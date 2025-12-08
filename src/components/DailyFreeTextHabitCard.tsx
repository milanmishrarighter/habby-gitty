"use client";

import React from 'react';
import { Habit } from '@/types/habit';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { showSuccess, showError } from '@/utils/toast';

interface DailyFreeTextHabitCardProps {
  habit: Habit;
  entryDate: string; // The date for which we are tracking
  onUpdateTracking: (
    habitId: string,
    date: string,
    textValue: string,
  ) => Promise<void>;
  initialTextValue: string | null;
  isWeekOffForThisDay: boolean;
}

const DailyFreeTextHabitCard: React.FC<DailyFreeTextHabitCardProps> = ({
  habit,
  entryDate,
  onUpdateTracking,
  initialTextValue,
  isWeekOffForThisDay,
}) => {
  const [textValue, setTextValue] = React.useState(initialTextValue || "");
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    // If the day is marked as week off, clear local state
    if (isWeekOffForThisDay) {
      setTextValue(""); // Clear text if week is off
    } else {
      setTextValue(initialTextValue || "");
    }
  }, [initialTextValue, isWeekOffForThisDay]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTextValue(e.target.value);
  };

  const handleSave = async () => {
    if (isWeekOffForThisDay) {
      showError("This day is part of a 'Week Off'. Individual habit tracking is disabled.");
      return;
    }
    if (!entryDate) {
      showError("Please select a date first to track habits.");
      return;
    }

    setIsSaving(true);
    try {
      await onUpdateTracking(habit.id, entryDate, textValue);
      showSuccess(`Habit '${habit.name}' text updated for ${entryDate}!`);
    } catch (error) {
      console.error("Error saving free text habit:", error);
      showError("Failed to save free text habit.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 rounded-lg shadow-md flex flex-col space-y-3" style={{ backgroundColor: `${habit.color}33` }}>
      <div className="flex items-center justify-between">
        <span className="text-gray-800 font-bold text-lg">{habit.name}</span>
        <div className="w-6 h-6 rounded-full border-2 border-white shadow" style={{ backgroundColor: habit.color }}></div>
      </div>

      {habit.hintText && (
        <p className="text-sm text-gray-600 italic text-left -mt-2">{habit.hintText}</p>
      )}

      {isWeekOffForThisDay ? (
        <div className="dotted-border-container py-6">
          <p className="text-lg font-semibold text-blue-700">Week Off!</p>
          <p className="text-sm text-gray-600">This week is marked off for habit tracking.</p>
        </div>
      ) : (
        <div className="mt-2">
          <label htmlFor={`text-habit-${habit.id}`} className="font-medium mb-1 text-left block">
            Enter your thoughts for today:
          </label>
          <Textarea
            id={`text-habit-${habit.id}`}
            value={textValue}
            onChange={handleTextChange}
            onBlur={handleSave} // Save when the textarea loses focus
            placeholder="Type your entry here..."
            rows={4}
            className="w-full p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isSaving || !entryDate}
          />
          <p className="text-xs text-gray-500 mt-1 text-left">Your entry will save automatically when you click outside or tab away.</p>
        </div>
      )}
    </div>
  );
};

export default DailyFreeTextHabitCard;