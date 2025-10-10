"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import EmojiPicker from "@/components/EmojiPicker";
import DailyHabitTrackerCard from "@/components/DailyHabitTrackerCard";
import OverwriteConfirmationModal from "@/components/OverwriteConfirmationModal"; // Import OverwriteConfirmationModal
import { showSuccess, showError } from "@/utils/toast";
import { Habit } from "@/types/habit";
import { DailyEntry } from "@/types/dailyEntry";
import { DailyTrackingRecord, YearlyProgressRecord, YearlyOutOfControlMissCount } from "@/types/tracking";
import { supabase } from "@/lib/supabase";
import { mapSupabaseHabitToHabit } from "@/utils/habitUtils";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'; // Import format for date

interface EditDailyEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEntry: DailyEntry | null;
  onSave: (updatedEntry: DailyEntry, oldDate: string) => Promise<void>; // Modified onSave signature
}

const EditDailyEntryModal: React.FC<EditDailyEntryModalProps> = ({ isOpen, onClose, initialEntry, onSave }) => {
  const [editedDate, setEditedDate] = React.useState(initialEntry?.date || "");
  const [journalText, setJournalText] = React.useState(initialEntry?.text || "");
  const [moodEmoji, setMoodEmoji] = React.useState(initialEntry?.mood || "😊");
  const [habits, setHabits] = React.useState<Habit[]>([]);
  const [dailyTracking, setDailyTracking] = React.useState<{ [date: string]: { [habitId: string]: { trackedValues: string[], isOutOfControlMiss: boolean } } }>({});
  const [yearlyProgress, setYearlyProgress] = React.useState<{ [year: string]: { [habitId: string]: number } }>({});
  const [yearlyOutOfControlMissCounts, setYearlyOutOfControlMissCounts] = React.useState<{ [habitId: string]: YearlyOutOfControlMissCount }>({});
  const [weeklyTrackingCounts, setWeeklyTrackingCounts] = React.useState<{ [habitId: string]: { [trackingValue: string]: number } }>({});
  const [monthlyTrackingCounts, setMonthlyTrackingCounts] = React.useState<{ [habitId: string]: { [trackingValue: string]: number } }>({});
  const [isLoading, setIsLoading] = React.useState(false);

  const [showOverwriteConfirmModal, setShowOverwriteConfirmModal] = React.useState(false);
  const [pendingSaveData, setPendingSaveData] = React.useState<{ updatedEntry: DailyEntry; oldDate: string } | null>(null);

  // Reset states when modal opens or initialEntry changes
  React.useEffect(() => {
    if (initialEntry) {
      setEditedDate(initialEntry.date);
      setJournalText(initialEntry.text);
      setMoodEmoji(initialEntry.mood);
      setDailyTracking({}); // Clear tracking to refetch for new date
      setYearlyProgress({});
      setYearlyOutOfControlMissCounts({});
      setWeeklyTrackingCounts({});
      setMonthlyTrackingCounts({});
      setHabits([]); // Clear habits to refetch
      setPendingSaveData(null);
      setShowOverwriteConfirmModal(false);
    }
  }, [initialEntry]);

  // Load data when modal opens or editedDate changes
  React.useEffect(() => {
    const fetchData = async () => {
      if (!initialEntry || !editedDate) return;

      setIsLoading(true);
      try {
        const selectedDate = new Date(editedDate);
        const currentYear = selectedDate.getFullYear().toString();

        // Fetch habits
        const { data: habitsData, error: habitsError } = await supabase
          .from('habits')
          .select('*')
          .order('created_at', { ascending: false });

        if (habitsError) {
          console.error("Error fetching habits for EditDailyEntryModal:", habitsError);
          showError("Failed to load habits.");
        } else {
          setHabits((habitsData || []).map(mapSupabaseHabitToHabit));
        }

        // Fetch daily habit tracking for the selected date
        const { data: trackingData, error: trackingError } = await supabase
          .from('daily_habit_tracking')
          .select('*')
          .eq('date', editedDate);

        if (trackingError) {
          console.error("Error fetching daily tracking:", trackingError);
          showError("Failed to load daily habit tracking.");
          setDailyTracking({});
        } else {
          const newDailyTracking: { [date: string]: { [habitId: string]: { trackedValues: string[], isOutOfControlMiss: boolean } } } = { [editedDate]: {} };
          trackingData.forEach(record => {
            newDailyTracking[editedDate][record.habit_id] = {
              trackedValues: record.tracked_values,
              isOutOfControlMiss: record.is_out_of_control_miss,
            };
          });
          setDailyTracking(newDailyTracking);
        }

        // Fetch yearly progress for the current year
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

        // --- Calculate Weekly and Monthly Tracking Counts ---
        const startOfCurrentWeek = format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'); // Monday start
        const endOfCurrentWeek = format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        const startOfCurrentMonth = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
        const endOfCurrentMonth = format(endOfMonth(selectedDate), 'yyyy-MM-dd');

        // Fetch all tracking records for the current week
        const { data: weeklyRecords, error: weeklyError } = await supabase
          .from('daily_habit_tracking')
          .select('*')
          .gte('date', startOfCurrentWeek)
          .lte('date', endOfCurrentWeek);

        if (weeklyError) {
          console.error("Error fetching weekly tracking records:", weeklyError);
          showError("Failed to load weekly tracking data.");
        } else {
          const calculatedWeeklyCounts: { [hId: string]: { [tValue: string]: number } } = {};
          weeklyRecords.forEach(record => {
            if (!calculatedWeeklyCounts[record.habit_id]) {
              calculatedWeeklyCounts[record.habit_id] = {};
            }
            record.tracked_values.forEach(value => {
              calculatedWeeklyCounts[record.habit_id][value] = (calculatedWeeklyCounts[record.habit_id][value] || 0) + 1;
            });
          });
          setWeeklyTrackingCounts(calculatedWeeklyCounts);
        }

        // Fetch all tracking records for the current month
        const { data: monthlyRecords, error: monthlyError } = await supabase
          .from('daily_habit_tracking')
          .select('*')
          .gte('date', startOfCurrentMonth)
          .lte('date', endOfCurrentMonth);

        if (monthlyError) {
          console.error("Error fetching monthly tracking records:", monthlyError);
          showError("Failed to load monthly tracking data.");
        } else {
          const calculatedMonthlyCounts: { [hId: string]: { [tValue: string]: number } } = {};
          monthlyRecords.forEach(record => {
            if (!calculatedMonthlyCounts[record.habit_id]) {
              calculatedMonthlyCounts[record.habit_id] = {};
            }
            record.tracked_values.forEach(value => {
              calculatedMonthlyCounts[record.habit_id][value] = (calculatedMonthlyCounts[record.habit_id][value] || 0) + 1;
            });
          });
          setMonthlyTrackingCounts(calculatedMonthlyCounts);
        }

      } catch (err) {
        console.error("Unexpected error in EditDailyEntryModal fetchData:", err);
        showError("An unexpected error occurred while loading data.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [initialEntry, editedDate]); // Re-fetch when initialEntry or editedDate changes

  const handleUpdateTracking = async (
    habitId: string,
    date: string,
    trackedValuesForDay: string[],
    newYearlyProgress: number,
    isOutOfControlMiss: boolean,
    oldIsOutOfControlMiss: boolean,
  ) => {
    // This function is called by DailyHabitTrackerCard and handles its own Supabase updates
    // for daily_habit_tracking, yearly_habit_progress, and yearly_out_of_control_miss_counts.
    // We just need to update the local state here to reflect changes.

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

  const handleSave = async (overwrite: boolean = false) => {
    if (!initialEntry) return;

    if (!editedDate || !journalText.trim()) {
      showError("Please select a date and write your journal entry.");
      return;
    }

    setIsLoading(true);
    const updatedEntry: DailyEntry = {
      ...initialEntry,
      date: editedDate,
      text: journalText.trim(),
      mood: moodEmoji,
      timestamp: new Date().toISOString(),
    };

    // Check if date has changed and if an entry already exists for the new date
    if (editedDate !== initialEntry.date && !overwrite) {
      const { data: existingEntry, error: fetchError } = await supabase
        .from('daily_entries')
        .select('id')
        .eq('date', editedDate)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means "no rows found"
        console.error("Error checking for existing entry:", fetchError);
        showError("Failed to check for existing entry.");
        setIsLoading(false);
        return;
      }

      if (existingEntry) {
        setPendingSaveData({ updatedEntry, oldDate: initialEntry.date });
        setShowOverwriteConfirmModal(true);
        setIsLoading(false);
        return;
      }
    }

    try {
      await onSave(updatedEntry, initialEntry.date); // Pass old date to parent for full reload
      showSuccess("Daily entry saved!");
      onClose();
    } catch (error) {
      console.error("Error saving daily entry:", error);
      showError("Failed to save daily entry.");
    } finally {
      setIsLoading(false);
      setShowOverwriteConfirmModal(false);
      setPendingSaveData(null);
    }
  };

  const handleConfirmOverwrite = async () => {
    if (pendingSaveData) {
      setIsLoading(true);
      try {
        // Delete the existing entry for the new date first
        const { error: deleteExistingError } = await supabase
          .from('daily_entries')
          .delete()
          .eq('date', pendingSaveData.updatedEntry.date);

        if (deleteExistingError) {
          console.error("Error deleting existing entry for overwrite:", deleteExistingError);
          showError("Failed to overwrite existing entry.");
          setIsLoading(false);
          return;
        }

        // Now proceed with the save operation, which will update the original entry's date
        await onSave(pendingSaveData.updatedEntry, pendingSaveData.oldDate);
        showSuccess("Daily entry overwritten and saved!");
        onClose();
      } catch (error) {
        console.error("Error during overwrite save:", error);
        showError("Failed to save daily entry after overwrite.");
      } finally {
        setIsLoading(false);
        setShowOverwriteConfirmModal(false);
        setPendingSaveData(null);
      }
    }
  };

  if (!initialEntry) return null;

  const currentYear = new Date(editedDate).getFullYear().toString();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Daily Entry for {format(new Date(initialEntry.date), 'do MMMM yyyy')}</DialogTitle>
          <DialogDescription>
            Make changes to your journal entry and habit tracking for this day.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Date Picker */}
          <div className="flex flex-col items-center justify-center mb-4 w-full">
            <label htmlFor="entry-date-edit" className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <input
              type="date"
              id="entry-date-edit"
              className="mt-1 p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={editedDate}
              onChange={(e) => setEditedDate(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="flex flex-col items-center justify-center mb-4 w-full">
            <label htmlFor="journal-entry-edit" className="block text-sm font-medium text-gray-700 mb-2">Journal Entry</label>
            <textarea
              id="journal-entry-edit"
              rows={8}
              className="mt-1 p-4 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full resize-y"
              placeholder="Write your thoughts here..."
              value={journalText}
              onChange={(e) => setJournalText(e.target.value)}
              disabled={isLoading}
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
                  const initialTrackedValue = editedDate && dailyTracking[editedDate]?.[habit.id]?.trackedValues?.length > 0
                    ? dailyTracking[editedDate][habit.id].trackedValues[0]
                    : null;
                  const initialIsOutOfControlMiss = editedDate && dailyTracking[editedDate]?.[habit.id]?.isOutOfControlMiss || false;

                  return (
                    <DailyHabitTrackerCard
                      key={habit.id}
                      habit={habit}
                      entryDate={editedDate} // Pass editedDate
                      onUpdateTracking={handleUpdateTracking}
                      currentYearlyProgress={currentYearlyProgress}
                      initialTrackedValue={initialTrackedValue}
                      initialIsOutOfControlMiss={initialIsOutOfControlMiss}
                      yearlyOutOfControlMissCounts={yearlyOutOfControlMissCounts}
                      weeklyTrackingCounts={weeklyTrackingCounts[habit.id] || {}} // Pass habit-specific weekly counts
                      monthlyTrackingCounts={monthlyTrackingCounts[habit.id] || {}} // Pass habit-specific monthly counts
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button onClick={() => handleSave()} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <OverwriteConfirmationModal
        isOpen={showOverwriteConfirmModal}
        onClose={() => setShowOverwriteConfirmModal(false)}
        onConfirm={handleConfirmOverwrite}
        itemToOverwriteName={pendingSaveData ? `the entry for ${format(new Date(pendingSaveData.updatedEntry.date), 'do MMMM yyyy')}` : "this entry"}
      />
    </Dialog>
  );
};

export default EditDailyEntryModal;