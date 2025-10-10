"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import EmojiPicker from "@/components/EmojiPicker";
import DailyHabitTrackerCard from "@/components/DailyHabitTrackerCard";
import OverwriteConfirmationModal from "@/components/OverwriteConfirmationModal";
import { showSuccess, showError } from "@/utils/toast";
import { Habit } from "@/types/habit";
import { DailyEntry } from "@/types/dailyEntry";
import { DailyTrackingRecord, YearlyProgressRecord, YearlyOutOfControlMissCount } from "@/types/tracking";
import { supabase } from "@/lib/supabase";
import { mapSupabaseHabitToHabit } from "@/utils/habitUtils";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

interface EditDailyEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEntry: DailyEntry | null;
  // Modified onSave signature to pass back the updated habit tracking state
  onSave: (
    updatedEntry: DailyEntry,
    oldDate: string,
    updatedHabitTracking: { [habitId: string]: { trackedValues: string[], isOutOfControlMiss: boolean } }
  ) => Promise<void>;
}

const EditDailyEntryModal: React.FC<EditDailyEntryModalProps> = ({ isOpen, onClose, initialEntry, onSave }) => {
  const [editedDate, setEditedDate] = React.useState(initialEntry?.date || "");
  const [journalText, setJournalText] = React.useState(initialEntry?.text || "");
  const [moodEmoji, setMoodEmoji] = React.useState(initialEntry?.mood || "😊");
  const [habits, setHabits] = React.useState<Habit[]>([]);
  // This state will hold the tracking values for the entry being edited, regardless of editedDate
  const [modalHabitTracking, setModalHabitTracking] = React.useState<{ [habitId: string]: { trackedValues: string[], isOutOfControlMiss: boolean } }>({});
  const [yearlyProgress, setYearlyProgress] = React.useState<{ [year: string]: { [habitId: string]: number } }>({});
  const [yearlyOutOfControlMissCounts, setYearlyOutOfControlMissCounts] = React.useState<{ [habitId: string]: YearlyOutOfControlMissCount }>({});
  const [weeklyTrackingCounts, setWeeklyTrackingCounts] = React.useState<{ [habitId: string]: { [trackingValue: string]: number } }>({});
  const [monthlyTrackingCounts, setMonthlyTrackingCounts] = React.useState<{ [habitId: string]: { [trackingValue: string]: number } }>({});
  const [isLoading, setIsLoading] = React.useState(false);

  const [showOverwriteConfirmModal, setShowOverwriteConfirmModal] = React.useState(false);
  const [pendingSaveData, setPendingSaveData] = React.useState<{
    updatedEntry: DailyEntry;
    oldDate: string;
    updatedHabitTracking: { [habitId: string]: { trackedValues: string[], isOutOfControlMiss: boolean } };
  } | null>(null);

  // Reset states when modal opens or initialEntry changes
  React.useEffect(() => {
    if (initialEntry) {
      setEditedDate(initialEntry.date);
      setJournalText(initialEntry.text);
      setMoodEmoji(initialEntry.mood);
      setModalHabitTracking({}); // Clear tracking to refetch for initialEntry.date
      setYearlyProgress({});
      setYearlyOutOfControlMissCounts({});
      setWeeklyTrackingCounts({});
      setMonthlyTrackingCounts({});
      setHabits([]); // Clear habits to refetch
      setPendingSaveData(null);
      setShowOverwriteConfirmModal(false);
    }
  }, [initialEntry]);

  // Load data when modal opens (initialEntry changes)
  React.useEffect(() => {
    const fetchData = async () => {
      if (!initialEntry) return; // Only fetch if an entry is provided

      setIsLoading(true);
      try {
        const initialDate = new Date(initialEntry.date);
        const initialYear = initialDate.getFullYear().toString();

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

        // Fetch daily habit tracking for the INITIAL entry date
        const { data: trackingData, error: trackingError } = await supabase
          .from('daily_habit_tracking')
          .select('*')
          .eq('date', initialEntry.date);

        if (trackingError) {
          console.error("Error fetching daily tracking for initial entry:", trackingError);
          showError("Failed to load initial daily habit tracking.");
          setModalHabitTracking({});
        } else {
          const initialTracking: { [habitId: string]: { trackedValues: string[], isOutOfControlMiss: boolean } } = {};
          trackingData.forEach(record => {
            initialTracking[record.habit_id] = {
              trackedValues: record.tracked_values,
              isOutOfControlMiss: record.is_out_of_control_miss,
            };
          });
          setModalHabitTracking(initialTracking);
        }

        // Fetch yearly progress for the initial entry's year
        const { data: yearlyProgressData, error: yearlyProgressError } = await supabase
          .from('yearly_habit_progress')
          .select('*')
          .eq('year', initialYear);

        if (yearlyProgressError) {
          console.error("Error fetching yearly progress:", yearlyProgressError);
          showError("Failed to load yearly habit progress.");
          setYearlyProgress({});
        } else {
          const newYearlyProgress: { [year: string]: { [habitId: string]: number } } = { [initialYear]: {} };
          yearlyProgressData.forEach(record => {
            newYearlyProgress[initialYear][record.habit_id] = record.progress_count;
          });
          setYearlyProgress(newYearlyProgress);
        }

        // Fetch yearly out-of-control miss counts for the initial entry's year
        const { data: missCountsData, error: missCountsError } = await supabase
          .from('yearly_out_of_control_miss_counts')
          .select('*')
          .eq('year', initialYear);

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

        // --- Calculate Weekly and Monthly Tracking Counts for the INITIAL entry date's period ---
        const startOfInitialWeek = format(startOfWeek(initialDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'); // Monday start
        const endOfInitialWeek = format(endOfWeek(initialDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        const startOfInitialMonth = format(startOfMonth(initialDate), 'yyyy-MM-dd');
        const endOfInitialMonth = format(endOfMonth(initialDate), 'yyyy-MM-dd');

        // Fetch all tracking records for the initial week
        const { data: weeklyRecords, error: weeklyError } = await supabase
          .from('daily_habit_tracking')
          .select('*')
          .gte('date', startOfInitialWeek)
          .lte('date', endOfInitialWeek);

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

        // Fetch all tracking records for the initial month
        const { data: monthlyRecords, error: monthlyError } = await supabase
          .from('daily_habit_tracking')
          .select('*')
          .gte('date', startOfInitialMonth)
          .lte('date', endOfInitialMonth);

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
  }, [initialEntry]); // Only re-fetch when initialEntry changes (modal opens/closes)

  // Local handler for DailyHabitTrackerCard to update modal's internal tracking state
  const handleUpdateTrackingLocally = async (
    habitId: string,
    date: string, // This will be the editedDate from the card, but we use modalHabitTracking
    trackedValuesForDay: string[],
    newYearlyProgress: number,
    isOutOfControlMiss: boolean,
    oldIsOutOfControlMiss: boolean,
  ) => {
    // Update the local modalHabitTracking state
    setModalHabitTracking(prev => ({
      ...prev,
      [habitId]: {
        trackedValues: trackedValuesForDay,
        isOutOfControlMiss: isOutOfControlMiss,
      },
    }));

    // Update local yearly progress state for display consistency
    const currentYear = new Date(initialEntry!.date).getFullYear().toString(); // Use initial entry's year for local display
    setYearlyProgress(prev => ({
      ...prev,
      [currentYear]: {
        ...(prev[currentYear] || {}),
        [habitId]: newYearlyProgress,
      },
    }));

    // Update local yearly out-of-control miss counts state for display consistency
    let updatedUsedCount = yearlyOutOfControlMissCounts[habitId]?.used_count || 0;
    if (isOutOfControlMiss && !oldIsOutOfControlMiss) {
      updatedUsedCount += 1;
    } else if (!isOutOfControlMiss && oldIsOutOfControlMiss) {
      updatedUsedCount = Math.max(0, updatedUsedCount - 1);
    }
    setYearlyOutOfControlMissCounts(prev => ({
      ...prev,
      [habitId]: {
        ...(prev[habitId] || {}),
        habit_id: habitId,
        year: currentYear,
        used_count: updatedUsedCount,
      } as YearlyOutOfControlMissCount, // Cast to ensure type safety
    }));

    // IMPORTANT: This local handler DOES NOT interact with Supabase directly.
    // Supabase updates will happen in the parent component's onSave.
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
        setPendingSaveData({ updatedEntry, oldDate: initialEntry.date, updatedHabitTracking: modalHabitTracking });
        setShowOverwriteConfirmModal(true);
        setIsLoading(false);
        return;
      }
    }

    try {
      // Pass the updated entry, the original date, and the modal's current habit tracking state to the parent
      await onSave(updatedEntry, initialEntry.date, modalHabitTracking);
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
        await onSave(pendingSaveData.updatedEntry, pendingSaveData.oldDate, pendingSaveData.updatedHabitTracking);
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

  const currentYearForDisplay = new Date(initialEntry.date).getFullYear().toString(); // Use initial entry's year for display

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
                  const habitTrackingForModal = modalHabitTracking[habit.id];
                  const initialTrackedValue = habitTrackingForModal?.trackedValues?.length > 0
                    ? habitTrackingForModal.trackedValues[0]
                    : null;
                  const initialIsOutOfControlMiss = habitTrackingForModal?.isOutOfControlMiss || false;

                  return (
                    <DailyHabitTrackerCard
                      key={`${habit.id}-${initialEntry.date}`} // Key based on initial entry date to prevent re-render on editedDate change
                      habit={habit}
                      entryDate={editedDate} // Pass editedDate as the target date for saving
                      onUpdateTracking={handleUpdateTrackingLocally} // Use local handler
                      currentYearlyProgress={yearlyProgress[currentYearForDisplay]?.[habit.id] || 0}
                      initialTrackedValue={initialTrackedValue}
                      initialIsOutOfControlMiss={initialIsOutOfControlMiss}
                      yearlyOutOfControlMissCounts={yearlyOutOfControlMissCounts}
                      weeklyTrackingCounts={weeklyTrackingCounts[habit.id] || {}}
                      monthlyTrackingCounts={monthlyTrackingCounts[habit.id] || {}}
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