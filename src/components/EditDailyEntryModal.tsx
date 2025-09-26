"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import EmojiPicker from "@/components/EmojiPicker";
import DailyHabitTrackerCard from "@/components/DailyHabitTrackerCard";
import { showSuccess, showError } from "@/utils/toast";
import { Habit } from "@/types/habit"; // Import the centralized Habit interface

interface DailyEntry {
  date: string;
  text: string;
  mood: string;
  timestamp: string;
}

interface DailyTrackingRecord {
  [date: string]: {
    [habitId: string]: string[];
  };
}

interface YearlyProgressRecord {
  [year: string]: {
    [habitId: string]: number;
  };
}

interface EditDailyEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEntry: DailyEntry | null;
  onSave: (updatedEntry: DailyEntry) => void;
}

const EditDailyEntryModal: React.FC<EditDailyEntryModalProps> = ({ isOpen, onClose, initialEntry, onSave }) => {
  const [journalText, setJournalText] = React.useState(initialEntry?.text || "");
  const [moodEmoji, setMoodEmoji] = React.useState(initialEntry?.mood || "😊");
  const [habits, setHabits] = React.useState<Habit[]>([]);
  const [dailyTracking, setDailyTracking] = React.useState<DailyTrackingRecord>({});
  const [yearlyProgress, setYearlyProgress] = React.useState<YearlyProgressRecord>({});

  // Load data when modal opens or initialEntry changes
  React.useEffect(() => {
    if (initialEntry) {
      setJournalText(initialEntry.text);
      setMoodEmoji(initialEntry.mood);

      const storedHabits = localStorage.getItem('dailyJournalHabits');
      if (storedHabits) {
        setHabits(JSON.parse(storedHabits));
      }

      const storedDailyTracking = localStorage.getItem('dailyHabitTracking');
      if (storedDailyTracking) {
        setDailyTracking(JSON.parse(storedDailyTracking));
      } else {
        setDailyTracking({});
      }

      const storedYearlyProgress = localStorage.getItem('yearlyHabitProgress');
      if (storedYearlyProgress) {
        setYearlyProgress(JSON.parse(storedYearlyProgress));
      } else {
        setYearlyProgress({});
      }
    }
  }, [initialEntry]);

  const handleUpdateTracking = (habitId: string, date: string, trackedValuesForDay: string[], newYearlyProgress: number) => {
    setDailyTracking(prev => {
      const newState = {
        ...prev,
        [date]: {
          ...(prev[date] || {}),
          [habitId]: trackedValuesForDay,
        },
      };
      localStorage.setItem('dailyHabitTracking', JSON.stringify(newState));
      return newState;
    });

    const currentYear = new Date(date).getFullYear().toString();
    setYearlyProgress(prev => {
      const newState = {
        ...prev,
        [currentYear]: {
          ...(prev[currentYear] || {}),
          [habitId]: newYearlyProgress,
        },
      };
      localStorage.setItem('yearlyHabitProgress', JSON.stringify(newState));
      return newState;
    });
  };

  const handleSave = () => {
    if (!initialEntry) return;

    if (!journalText.trim()) {
      showError("Journal entry cannot be empty.");
      return;
    }

    const updatedEntry: DailyEntry = {
      ...initialEntry,
      text: journalText.trim(),
      mood: moodEmoji,
      timestamp: new Date().toISOString(), // Update timestamp on edit
    };

    onSave(updatedEntry);
    showSuccess("Entry updated successfully!");
    onClose();
  };

  if (!initialEntry) return null;

  const entryDate = initialEntry.date;
  const currentYear = new Date(entryDate).getFullYear().toString();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Daily Entry for {initialEntry.date}</DialogTitle>
          <DialogDescription>
            Make changes to your journal entry and habit tracking for this day.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col items-center justify-center mb-4 w-full">
            <label htmlFor="journal-entry-edit" className="block text-sm font-medium text-gray-700 mb-2">Journal Entry</label>
            <textarea
              id="journal-entry-edit"
              rows={8}
              className="mt-1 p-4 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full resize-y"
              placeholder="Write your thoughts here..."
              value={journalText}
              onChange={(e) => setJournalText(e.target.value)}
            ></textarea>
          </div>
          <div className="flex flex-col items-center justify-center mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Mood of the Day</label>
            <EmojiPicker selectedEmoji={moodEmoji} onSelectEmoji={setMoodEmoji} />
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Daily Habit Tracking</h3>
            {habits.length === 0 ? (
              <div className="dotted-border-container">
                <p className="text-lg mb-2">No habits added yet.</p>
                <p className="text-sm text-gray-500">Add habits in the 'Habit Setup' tab.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {habits.map((habit) => {
                  const currentYearlyProgress = yearlyProgress[currentYear]?.[habit.id] || 0;
                  const initialTrackedValue = dailyTracking[entryDate]?.[habit.id]?.length > 0
                    ? dailyTracking[entryDate][habit.id][0]
                    : null;

                  return (
                    <DailyHabitTrackerCard
                      key={habit.id}
                      habit={habit}
                      entryDate={entryDate}
                      onUpdateTracking={handleUpdateTracking}
                      currentYearlyProgress={currentYearlyProgress}
                      initialTrackedValue={initialTrackedValue}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditDailyEntryModal;