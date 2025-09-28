"use client";

import React from "react";
import EditDailyEntryModal from "@/components/EditDailyEntryModal";
import DeleteConfirmationModal from "@/components/DeleteConfirmationModal";
import { showSuccess, showError } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from 'date-fns';
import { Habit } from "@/types/habit";
import { DailyEntry } from "@/types/dailyEntry";
import { DailyTrackingRecord, YearlyProgressRecord } from "@/types/tracking"; // Import new types
import { supabase } from "@/lib/supabase";
import { mapSupabaseHabitToHabit } from "@/utils/habitUtils"; // Import the new utility

const RecordedEntries: React.FC = () => {
  const [dailyEntries, setDailyEntries] = React.useState<DailyEntry[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [entryToEdit, setEntryToEdit] = React.useState<DailyEntry | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [entryToDelete, setEntryToDelete] = React.useState<{ id: string; date: string } | null>(null);
  const [habits, setHabits] = React.useState<Habit[]>([]);
  const [dailyTracking, setDailyTracking] = React.useState<{ [date: string]: { [habitId: string]: { trackedValues: string[], isOutOfControlMiss: boolean } } }>({});

  // Function to load entries, habits, and daily tracking
  const loadAllData = React.useCallback(async () => {
    // Fetch daily entries from Supabase
    const { data: entriesData, error: entriesError } = await supabase
      .from('daily_entries')
      .select('*')
      .order('date', { ascending: false });

    if (entriesError) {
      console.error("Error fetching daily entries:", entriesError);
      showError("Failed to load daily entries.");
      setDailyEntries([]);
    } else {
      setDailyEntries(entriesData as DailyEntry[]);
    }

    // Fetch habits from Supabase
    const { data: habitsData, error: habitsError } = await supabase
      .from('habits')
      .select('*');

    if (habitsError) {
      console.error("Error fetching habits for RecordedEntries:", habitsError);
      showError("Failed to load habits.");
    } else {
      setHabits((habitsData || []).map(mapSupabaseHabitToHabit)); // Apply mapping
    }

    // Fetch all daily habit tracking records
    const { data: trackingData, error: trackingError } = await supabase
      .from('daily_habit_tracking')
      .select('*');

    if (trackingError) {
      console.error("Error fetching daily tracking:", trackingError);
      setDailyTracking({});
    } else {
      const newDailyTracking: { [date: string]: { [habitId: string]: { trackedValues: string[], isOutOfControlMiss: boolean } } } = {};
      trackingData.forEach(record => {
        if (!newDailyTracking[record.date]) {
          newDailyTracking[record.date] = {};
        }
        newDailyTracking[record.date][record.habit_id] = {
          trackedValues: record.tracked_values,
          isOutOfControlMiss: record.is_out_of_control_miss,
        };
      });
      setDailyTracking(newDailyTracking);
    }
  }, []);

  // Load data on component mount
  React.useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleDeleteClick = (id: string, date: string) => {
    setEntryToDelete({ id, date });
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!entryToDelete) return;

    const { id: idToDelete, date: dateToDelete } = entryToDelete;
    const currentYear = new Date(dateToDelete).getFullYear().toString();

    // 1. Fetch daily habit tracking records for the date to identify out-of-control misses and contributing values
    const { data: trackingRecordsForDate, error: fetchTrackingError } = await supabase
      .from('daily_habit_tracking')
      .select('*')
      .eq('date', dateToDelete);

    if (fetchTrackingError) {
      console.error("Error fetching daily tracking for deletion:", fetchTrackingError);
      showError("Failed to retrieve habit tracking for deletion.");
      // Continue with other deletions even if this fails
    } else {
      for (const record of trackingRecordsForDate || []) {
        // Decrement yearly out-of-control miss counts if applicable
        if (record.is_out_of_control_miss) {
          const { data: currentMissCountData, error: fetchMissCountError } = await supabase
            .from('yearly_out_of_control_miss_counts')
            .select('used_count')
            .eq('habit_id', record.habit_id)
            .eq('year', currentYear)
            .single();

          if (fetchMissCountError && fetchMissCountError.code !== 'PGRST116') {
            console.error("Error fetching yearly miss count for decrement:", fetchMissCountError);
            showError("Failed to update out-of-control miss count.");
          } else if (currentMissCountData) {
            const newUsedCount = Math.max(0, currentMissCountData.used_count - 1);
            const { error: updateMissCountError } = await supabase
              .from('yearly_out_of_control_miss_counts')
              .update({ used_count: newUsedCount })
              .eq('habit_id', record.habit_id)
              .eq('year', currentYear);

            if (updateMissCountError) {
              console.error("Error decrementing yearly miss count:", updateMissCountError);
              showError("Failed to decrement out-of-control miss count.");
            }
          }
        }

        // Decrement yearly habit progress if tracked values contributed to a goal
        const habit = habits.find(h => h.id === record.habit_id);
        if (habit && habit.yearlyGoal && habit.yearlyGoal.contributingValues && record.tracked_values.length > 0) {
          const trackedValue = record.tracked_values[0]; // Assuming only one tracked value per day per habit
          if (habit.yearlyGoal.contributingValues.includes(trackedValue)) {
            const { data: currentProgressData, error: fetchProgressError } = await supabase
              .from('yearly_habit_progress')
              .select('progress_count')
              .eq('habit_id', record.habit_id)
              .eq('year', currentYear)
              .single();

            if (fetchProgressError && fetchProgressError.code !== 'PGRST116') {
              console.error("Error fetching yearly progress for decrement:", fetchProgressError);
              showError("Failed to update yearly habit progress.");
            } else if (currentProgressData) {
              const newProgressCount = Math.max(0, currentProgressData.progress_count - 1);
              const { error: updateProgressError } = await supabase
                .from('yearly_habit_progress')
                .update({ progress_count: newProgressCount })
                .eq('habit_id', record.habit_id)
                .eq('year', currentYear);

              if (updateProgressError) {
                console.error("Error decrementing yearly progress:", updateProgressError);
                showError("Failed to decrement yearly habit progress.");
              }
            }
          }
        }
      }
    }

    // Delete daily entry from Supabase
    const { error: entryDeleteError } = await supabase
      .from('daily_entries')
      .delete()
      .eq('id', idToDelete);

    if (entryDeleteError) {
      console.error("Error deleting daily entry:", entryDeleteError);
      showError("Failed to delete daily entry.");
      return;
    }

    // Delete associated daily habit tracking from Supabase
    const { error: trackingDeleteError } = await supabase
      .from('daily_habit_tracking')
      .delete()
      .eq('date', dateToDelete);

    if (trackingDeleteError) {
      console.error("Error deleting associated daily tracking:", trackingDeleteError);
      showError("Failed to delete associated habit tracking.");
      // Continue with other deletions even if this fails
    }

    // Remove entry from local state
    setDailyEntries(prev => prev.filter(entry => entry.id !== idToDelete));

    // Remove daily tracking for this date from local state
    setDailyTracking(prev => {
      const updatedDailyTracking = { ...prev };
      delete updatedDailyTracking[dateToDelete];
      return updatedDailyTracking;
    });

    showSuccess("Entry and associated habit tracking deleted successfully!");
    setEntryToDelete(null);
    setIsDeleteModalOpen(false);
  };

  const handleEditEntry = (entry: DailyEntry) => {
    setEntryToEdit(entry);
    setIsEditModalOpen(true);
  };

  const handleSaveEditedEntry = async (updatedEntry: DailyEntry) => {
    const { id, date, text, mood, timestamp } = updatedEntry;
    const { error } = await supabase
      .from('daily_entries')
      .update({ date, text, mood, timestamp })
      .eq('id', id);

    if (error) {
      console.error("Error updating daily entry:", error);
      showError("Failed to update daily entry.");
    } else {
      setDailyEntries(prev => prev.map(entry =>
        entry.id === updatedEntry.id ? updatedEntry : entry
      ));
      showSuccess("Entry updated successfully!");
    }
  };

  return (
    <div id="recorded" className="tab-content text-center">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Recorded Entries</h2>
      <p className="text-gray-600 mb-6">A history of all your past journal entries and habit tracking records.</p>

      {dailyEntries.length === 0 ? (
        <div className="dotted-border-container">
          <p className="text-lg">No entries recorded yet. Start a new entry in the "Daily Entries" tab!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dailyEntries.map((entry) => {
            const habitsTrackedForDay = dailyTracking[entry.date];
            const formattedDate = format(new Date(entry.date), 'do MMMM yyyy');
            return (
              <Card key={entry.id} className="flex flex-col justify-between">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{formattedDate}</span>
                    <span className="text-3xl">{entry.mood}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-gray-700 text-left line-clamp-4">{entry.text}</p>
                  {habitsTrackedForDay && Object.keys(habitsTrackedForDay).length > 0 && (
                    <div className="mt-4 pt-2 border-t border-gray-100 text-left">
                      <h4 className="font-semibold text-gray-800 text-sm mb-1">Habits Tracked:</h4>
                      <ul className="list-none space-y-1">
                        {Object.entries(habitsTrackedForDay).map(([habitId, trackingInfo]) => {
                          const habit = habits.find(h => h.id === habitId);
                          if (habit && trackingInfo.trackedValues.length > 0) {
                            return (
                              <li key={habitId} className="flex items-center gap-2 text-sm text-gray-700">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: habit.color }}></div>
                                <span className="font-medium">{habit.name}:</span>
                                <span>{trackingInfo.trackedValues[0]}</span>
                              </li>
                            );
                          } else if (habit && trackingInfo.isOutOfControlMiss) {
                            return (
                              <li key={habitId} className="flex items-center gap-2 text-sm text-gray-700 italic">
                                <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                                <span className="font-medium">{habit.name}:</span>
                                <span>Out-of-Control Miss</span>
                              </li>
                            );
                          }
                          return null;
                        })}
                      </ul>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-2 text-right">
                    Last updated: {new Date(entry.timestamp).toLocaleString()}
                  </p>
                </CardContent>
                <div className="flex justify-end gap-2 p-4 border-t">
                  <Button variant="outline" size="sm" onClick={() => handleEditEntry(entry)}>Edit</Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(entry.id, entry.date)}>Delete</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <EditDailyEntryModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        initialEntry={entryToEdit}
        onSave={handleSaveEditedEntry}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        itemToDeleteName={entryToDelete ? `the entry for ${entryToDelete.date}` : "this entry"}
      />
    </div>
  );
};

export default RecordedEntries;