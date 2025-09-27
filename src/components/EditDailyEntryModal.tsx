"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import EmojiPicker from "@/components/EmojiPicker";
import DailyHabitTrackerCard from "@/components/DailyHabitTrackerCard";
import { showSuccess, showError } from "@/utils/toast";
import { Habit } from "@/types/habit";
import { DailyEntry } from "@/types/dailyEntry";
import { DailyTrackingRecord, YearlyProgressRecord, YearlyOutOfControlMissCount } from "@/types/tracking"; // Import new types
import { supabase } from "@/lib/supabase";
import { mapSupabaseHabitToHabit } from "@/utils/habitUtils"; // Import the new utility

interface EditDailyEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEntry: DailyEntry | null;
  onSave: (updatedEntry: DailyEntry) => Promise<void>;
}

const EditDailyEntryModal: React.FC<EditDailyEntryModalProps> = ({ isOpen, onClose, initialEntry, onSave }) => {
  const [journalText, setJournalText] = React.useState(initialEntry?.text || "");
  const [moodEmoji, setMoodEmoji] = React.useState(initialEntry?.mood || "😊");
  const [habits, setHabits] = React.useState<Habit[]>([]);
  const [dailyTracking, setDailyTracking] = React.useState<{ [date: string]: { [habitId: string]: { trackedValues: string[], isOutOfControlMiss: boolean } } }>({});
  const [yearlyProgress, setYearlyProgress] = React.useState<{ [year: string]: { [habitId: string]: number } }>({});
  const [yearlyOutOfControlMissCounts, setYearlyOutOfControlMissCounts] = React.useState<{ [habitId: string]: YearlyOutOfControlMissCount }>({});
  const [isLoading, setIsLoading] = React.useState(false);

  // Load data when modal opens or initialEntry changes
  React.useEffect(() => {
    const fetchData = async () => {
      if (initialEntry) {
        setJournalText(initialEntry.text);
        setMoodEmoji(initialEntry.mood);

        const fetchHabits = async () => {
          const { data, error } = await supabase
            .from('habits')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) {
            console.error("Error fetching habits for EditDailyEntryModal:", error);
            showError("Failed to load habits.");
          } else {
            setHabits((data || []).map(mapSupabaseHabitToHabit)); // Apply mapping
          }
        };
        fetchHabits();

        // Fetch daily habit tracking for the selected date
        const { data: trackingData, error: trackingError } = await supabase
          .from('daily_habit_tracking')
          .select('*')
          .eq('date', initialEntry.date);

        if (trackingError) {
          console.error("Error fetching daily tracking:", trackingError);
          showError("Failed to load daily habit tracking.");
          setDailyTracking({});
        } else {
          const newDailyTracking: { [date: string]: { [habitId: string]: { trackedValues: string[], isOutOfControlMiss: boolean } } } = { [initialEntry.date]: {} };
          trackingData.forEach(record => {
            newDailyTracking[initialEntry.date][record.habit_id] = {
              trackedValues: record.tracked_values,
              isOutOfControlMiss: record.is_out_of_control_miss,
            };
          });
          setDailyTracking(newDailyTracking);
        }

        // Fetch yearly progress for the current year
        const currentYear = new Date(initialEntry.date).getFullYear().toString();
        const { data: yearlyProgressData, error: yearlyProgressError } = await supabase
          .from('yearly_habit_progress')
          .select('*')
          .eq('year', currentYear);

        if (yearlyProgressError) {
          console.error("Error fetching yearly progress:", yearlyProgressError);
          showError("Failed to load yearly habit progress.");
          setYearlyProgress({});
        } else {
          const newYearlyProgress: { [year: string]: { [habitId: string]: number } } = { [currentYear]: {} };
          yearlyProgressData.forEach(record => {
            newYearlyProgress[currentYear][record.habit_id] = record.progress_count;
          });
          setYearlyProgress(newYearlyProgress);
        }

        // Fetch yearly out-of-control miss counts for the current year
        const { data: missCountsData, error: missCountsError } = await supabase
          .from('yearly_out_of_control_miss_counts')
          .select('*')
          .eq('year', currentYear);

        if (missCountsError) {
          console.error("Error fetching yearly out-of-control miss counts:", missCountsError);
          showError("Failed to load out-of-control miss counts.");
          setYearlyOutOfControlMissCounts({});
        } else {
          const newMissCounts: { [habitId: string]: YearlyOutOfControlMissCount } = {};
          missCountsData.forEach(record => {
            newMissCounts[record.habit_id] = record;
          });
          setYearlyOutOfControlMissCounts(newMissCounts);
        }
      }
    };
    fetchData();
  }, [initialEntry]);

  const handleUpdateTracking = async (
    habitId: string,
    date: string,
    trackedValuesForDay: string[],
    newYearlyProgress: number,
    isOutOfControlMiss: boolean,
    oldIsOutOfControlMiss: boolean,
  ) => {
    // Update daily tracking in Supabase
    const dailyTrackingRecord = {
      date: date,
      habit_id: habitId,
      tracked_values: trackedValuesForDay,
      is_out_of_control_miss: isOutOfControlMiss,
    };

    const { error: dailyTrackingError } = await supabase
      .from('daily_habit_tracking')
      .upsert(dailyTrackingRecord, { onConflict: 'date,habit_id' });

    if (dailyTrackingError) {
      console.error("Error updating daily tracking:", dailyTrackingError);
      showError("Failed to update daily habit tracking.");
    } else {
      setDailyTracking(prev => ({
        ...prev,
        [date]: {
          ...(prev[date] || {}),
          [habitId]: {
            trackedValues: trackedValuesForDay,
            isOutOfControlMiss: isOutOfControlMiss,
          },
        },
      }));
    }

    // Update yearly progress in Supabase
    const currentYear = new Date(date).getFullYear().toString();
    const yearlyProgressRecord = {
      year: currentYear,
      habit_id: habitId,
      progress_count: newYearlyProgress,
    };

    const { error: yearlyProgressError } = await supabase
      .from('yearly_habit_progress')
      .upsert(yearlyProgressRecord, { onConflict: 'year,habit_id' });

    if (yearlyProgressError) {
      console.error("Error updating yearly progress:", yearlyProgressError);
      showError("Failed to update yearly habit progress.");
    } else {
      setYearlyProgress(prev => ({
        ...prev,
        [currentYear]: {
          ...(prev[currentYear] || {}),
          [habitId]: newYearlyProgress,
        },
      }));
    }

    // Update yearly out-of-control miss counts in Supabase
    let updatedUsedCount = yearlyOutOfControlMissCounts[habitId]?.used_count || 0;
    if (isOutOfControlMiss && !oldIsOutOfControlMiss) {
      updatedUsedCount += 1;
    } else if (!isOutOfControlMiss && oldIsOutOfControlMiss) {
      updatedUsedCount = Math.max(0, updatedUsedCount - 1);
    }

    const yearlyMissCountRecord = {
      habit_id: habitId,
      year: currentYear,
      used_count: updatedUsedCount,
    };

    const { data: missCountUpsertData, error: missCountError } = await supabase
      .from('yearly_out_of_control_miss_counts')
      .upsert(yearlyMissCountRecord, { onConflict: 'habit_id,year' })
      .select();

    if (missCountError) {
      console.error("Error updating yearly out-of-control miss count:", missCountError);
      showError("Failed to update out-of-control miss count.");
    } else if (missCountUpsertData && missCountUpsertData.length > 0) {
      setYearlyOutOfControlMissCounts(prev => ({
        ...prev,
        [habitId]: missCountUpsertData[0],
      }));
    }
  };

  const handleSave = async () => {
    if (!initialEntry) return;

    if (!journalText.trim()) {
      showError("Journal entry cannot be empty.");
      return;
    }

    setIsLoading(true);
    const updatedEntry: DailyEntry = {
      ...initialEntry,
      text: journalText.trim(),
      mood: moodEmoji,
      timestamp: new Date().toISOString(),
    };

    await onSave(updatedEntry);
    setIsLoading(false);
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
                  const initialTrackedValue = entryDate && dailyTracking[entryDate]?.[habit.id]?.trackedValues?.length > 0
                    ? dailyTracking[entryDate][habit.id].trackedValues[0]
                    : null;
                  const initialIsOutOfControlMiss = entryDate && dailyTracking[entryDate]?.[habit.id]?.isOutOfControlMiss || false;

                  return (
                    <DailyHabitTrackerCard
                      key={habit.id}
                      habit={habit}
                      entryDate={entryDate}
                      onUpdateTracking={handleUpdateTracking}
                      currentYearlyProgress={currentYearlyProgress}
                      initialTrackedValue={initialTrackedValue}
                      initialIsOutOfControlMiss={initialIsOutOfControlMiss}
                      yearlyOutOfControlMissCounts={yearlyOutOfControlMissCounts}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditDailyEntryModal;