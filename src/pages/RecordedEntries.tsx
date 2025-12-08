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
import { DailyTrackingRecord, YearlyProgressRecord, YearlyOutOfControlMissCount } from "@/types/tracking";
import { supabase } from "@/lib/supabase";
import { mapSupabaseHabitToHabit } from "@/utils/habitUtils";
import HabitTrackingDisplay from "@/components/HabitTrackingDisplay";
import { mapSupabaseEntryToDailyEntry } from "@/utils/dailyEntryUtils"; // Import the utility

// Shadcn UI components for filters
import { CalendarIcon, XCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateRange } from "react-day-picker";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HabitFilterState {
  [habitId: string]: {
    name: string;
    color: string;
    selectedTrackingValues: string[]; // For 'tracking' type
    includeOutOfControlMiss: boolean; // For 'tracking' type
    // No specific filter for text_field habits, they are included if the habit is selected
  };
}

// Updated DailyTracking state structure to accommodate both types of habits
interface DailyTrackingState {
  [date: string]: {
    [habitId: string]: {
      trackedValues?: string[]; // For 'tracking' type habits
      textValue?: string; // For 'text_field' type habits
      isOutOfControlMiss: boolean;
    };
  };
}

const RecordedEntries: React.FC = () => {
  const [dailyEntries, setDailyEntries] = React.useState<DailyEntry[]>([]); // All entries fetched
  const [displayEntries, setDisplayEntries] = React.useState<DailyEntry[]>([]); // Entries currently displayed after filtering
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [entryToEdit, setEntryToEdit] = React.useState<DailyEntry | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [entryToDelete, setEntryToDelete] = React.useState<{ id: string; date: string } | null>(null);
  const [allHabits, setAllHabits] = React.useState<Habit[]>([]); // Renamed to avoid conflict with filter state
  const [dailyTracking, setDailyTracking] = React.useState<DailyTrackingState>({}); // Updated state type

  // Filter states
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);
  const [selectedHabitFilters, setSelectedHabitFilters] = React.useState<HabitFilterState>({});
  const [isLoadingFilters, setIsLoadingFilters] = React.useState(false);

  // Function to load entries, habits, and daily tracking based on filters
  const loadAllData = React.useCallback(async (filters?: { dateRange?: DateRange, selectedHabitFilters?: HabitFilterState }) => {
    setIsLoadingFilters(true);
    // Fetch all habits from Supabase (always needed for display and deletion logic)
    const { data: habitsData, error: habitsError } = await supabase
      .from('habits')
      .select('*')
      .order('created_at', { ascending: true }); // Order habits by created_at

    if (habitsError) {
      console.error("Error fetching habits for RecordedEntries:", habitsError);
      showError("Failed to load habits.");
      setAllHabits([]);
    } else {
      setAllHabits((habitsData || []).map(mapSupabaseHabitToHabit));
    }

    let entryDatesToFetch: string[] | undefined = undefined;
    const filterHabitIds = Object.keys(filters?.selectedHabitFilters || {});

    if (filterHabitIds.length > 0) {
      let trackingDatesQuery = supabase
        .from('daily_habit_tracking')
        .select('date, habit_id, tracked_values, text_value, is_out_of_control_miss'); // Select all tracking fields

      const globalOrConditions: string[] = [];

      for (const habitId of filterHabitIds) {
        const habitFilter = filters.selectedHabitFilters[habitId];
        const habit = habitsData?.find(h => h.id === habitId); // Find the habit to check its type

        if (!habit) continue;

        if (habit.type === 'tracking') {
          const habitSpecificValueConditions: string[] = [];
          if (habitFilter.selectedTrackingValues.length > 0) {
            habitSpecificValueConditions.push(`tracked_values.cs.{${habitFilter.selectedTrackingValues.map(v => `"${v}"`).join(',')}}`);
          }
          if (habitFilter.includeOutOfControlMiss) {
            habitSpecificValueConditions.push(`is_out_of_control_miss.eq.true`);
          }
          if (habitSpecificValueConditions.length > 0) {
            globalOrConditions.push(`and(habit_id.eq.${habitId},or(${habitSpecificValueConditions.join(',')}))`);
          } else {
            globalOrConditions.push(`habit_id.eq.${habitId}`); // If habit is selected but no specific values/misses, just filter by habit_id
          }
        } else if (habit.type === 'text_field') {
          // For text_field habits, if selected, we just need to ensure there's a record for it
          globalOrConditions.push(`habit_id.eq.${habitId}`);
        }
      }

      if (globalOrConditions.length > 0) {
        trackingDatesQuery = trackingDatesQuery.or(globalOrConditions.join(','));
      }

      if (filters?.dateRange?.from) {
        trackingDatesQuery = trackingDatesQuery.gte('date', format(filters.dateRange.from, 'yyyy-MM-dd'));
      }
      if (filters?.dateRange?.to) {
        trackingDatesQuery = trackingDatesQuery.lte('date', format(filters.dateRange.to, 'yyyy-MM-dd'));
      }

      const { data: filteredTrackingRecords, error: filteredTrackingError } = await trackingDatesQuery;

      if (filteredTrackingError) {
        console.error("Error fetching filtered tracking records:", filteredTrackingError);
        showError("Failed to filter entries by habits and values.");
        setDisplayEntries([]);
        setDailyTracking({});
        setIsLoadingFilters(false);
        return;
      }

      // Process filtered tracking records to build dailyTracking and entryDatesToFetch
      const newDailyTracking: DailyTrackingState = {};
      const datesSet = new Set<string>();

      filteredTrackingRecords.forEach(record => {
        datesSet.add(record.date);
        if (!newDailyTracking[record.date]) {
          newDailyTracking[record.date] = {};
        }
        newDailyTracking[record.date][record.habit_id] = {
          trackedValues: record.tracked_values || [],
          textValue: record.text_value || undefined,
          isOutOfControlMiss: record.is_out_of_control_miss,
        };
      });
      setDailyTracking(newDailyTracking);
      entryDatesToFetch = Array.from(datesSet);

      if (entryDatesToFetch.length === 0) {
        setDisplayEntries([]);
        setIsLoadingFilters(false);
        return;
      }
    }

    let entryQuery = supabase.from('daily_entries').select('*');
    if (entryDatesToFetch) {
      entryQuery = entryQuery.in('date', entryDatesToFetch);
    } else { // Only apply date range if no habit filter or no dates found by habit filter
      if (filters?.dateRange?.from) {
        entryQuery = entryQuery.gte('date', format(filters.dateRange.from, 'yyyy-MM-dd'));
      }
      if (filters?.dateRange?.to) {
        entryQuery = entryQuery.lte('date', format(filters.dateRange.to, 'yyyy-MM-dd'));
      }
    }

    const { data: entriesData, error: entriesError } = await entryQuery.order('date', { ascending: false });

    if (entriesError) {
      console.error("Error fetching daily entries:", entriesError);
      showError("Failed to load daily entries.");
      setDisplayEntries([]);
    } else {
      const mappedEntries = (entriesData || []).map(mapSupabaseEntryToDailyEntry);
      setDailyEntries(mappedEntries); // Keep all fetched entries in case filters are cleared
      setDisplayEntries(mappedEntries); // Display the filtered ones
    }

    // If no habit filters were applied, we still need to fetch all tracking data for the displayed entries
    if (filterHabitIds.length === 0 && entriesData && entriesData.length > 0) {
      // Using a date range avoids extremely long IN() queries that can fail when many dates are present
      const maxDate = entriesData[0].date; // entriesData is ordered descending by date
      const minDate = entriesData[entriesData.length - 1].date;
      const { data: allTrackingData, error: allTrackingError } = await supabase
        .from('daily_habit_tracking')
        .select('*')
        .gte('date', minDate)
        .lte('date', maxDate);

      if (allTrackingError) {
        console.error("Error fetching all daily tracking:", allTrackingError);
        setDailyTracking({});
      } else {
        const newDailyTracking: DailyTrackingState = {};
        allTrackingData.forEach(record => {
          if (!newDailyTracking[record.date]) {
            newDailyTracking[record.date] = {};
          }
          newDailyTracking[record.date][record.habit_id] = {
            trackedValues: record.tracked_values || [],
            textValue: record.text_value || undefined,
            isOutOfControlMiss: record.is_out_of_control_miss,
          };
        });
        setDailyTracking(newDailyTracking);
      }
    }
    setIsLoadingFilters(false);
  }, []);

  // Load data on component mount (initial load with no filters)
  React.useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const applyFilters = () => {
    loadAllData({ dateRange, selectedHabitFilters });
  };

  const clearFilters = () => {
    setDateRange(undefined);
    setSelectedHabitFilters({});
    loadAllData(); // Load all data without filters
  };

  const handleHabitToggle = (habitId: string, habitName: string, habitColor: string, checked: boolean) => {
    setSelectedHabitFilters((prev) => {
      const newFilters = { ...prev };
      if (checked) {
        if (Object.keys(newFilters).length >= 3) {
          showError("You can select a maximum of 3 habits.");
          return prev;
        }
        newFilters[habitId] = {
          name: habitName,
          color: habitColor,
          selectedTrackingValues: [],
          includeOutOfControlMiss: false,
        };
      } else {
        delete newFilters[habitId];
      }
      return newFilters;
    });
  };

  const handleTrackingValueSelect = (habitId: string, value: string, checked: boolean) => {
    setSelectedHabitFilters((prev) => {
      const newFilters = { ...prev };
      if (newFilters[habitId]) {
        if (checked) {
          newFilters[habitId].selectedTrackingValues = [...newFilters[habitId].selectedTrackingValues, value];
        } else {
          newFilters[habitId].selectedTrackingValues = newFilters[habitId].selectedTrackingValues.filter(
            (v) => v !== value
          );
        }
      }
      return newFilters;
    });
  };

  const handleOutOfControlMissSelect = (habitId: string, checked: boolean) => {
    setSelectedHabitFilters((prev) => {
      const newFilters = { ...prev };
      if (newFilters[habitId]) {
        newFilters[habitId].includeOutOfControlMiss = checked;
      }
      return newFilters;
    });
  };

  const handleDeleteClick = (id: string, date: string) => {
    setEntryToDelete({ id, date });
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!entryToDelete) return;

    const { id: idToDelete, date: dateToDelete } = entryToDelete;
    const currentYear = new Date(dateToDelete).getFullYear().toString();
    const { data: { user } } = await supabase.auth.getUser();

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
        const habit = allHabits.find(h => h.id === record.habit_id);
        if (!habit) continue;

        if (habit.type === 'tracking') {
          // Decrement yearly out-of-control miss counts if applicable
          if (record.is_out_of_control_miss) {
            const { data: currentMissCountData, error: fetchMissCountError } = await supabase
              .from('yearly_out_of_control_miss_counts')
              .select('id, used_count')
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
                .eq('id', currentMissCountData.id);

              if (updateMissCountError) {
                console.error("Error decrementing yearly miss count:", updateMissCountError);
                showError("Failed to decrement yearly habit miss count.");
              }
            }
          }

          // Decrement yearly habit progress if tracked values contributed to a goal
          if (habit.yearlyGoal && habit.yearlyGoal.contributingValues && record.tracked_values && record.tracked_values.length > 0) {
            const trackedValue = record.tracked_values[0];
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
    }

    // 2. Decrement yearly nothings count if the entry had "nothing" for new_learning_text
    const { data: entryToDeleteData, error: fetchEntryError } = await supabase
      .from('daily_entries')
      .select('new_learning_text')
      .eq('id', idToDelete)
      .single();

    if (!fetchEntryError && entryToDeleteData?.new_learning_text?.toLowerCase() === 'nothing' && user) {
      const { data: currentNothingsCountData, error: fetchNothingsCountError } = await supabase
        .from('yearly_nothings_counts')
        .select('id, count')
        .eq('user_id', user.id)
        .eq('year', currentYear)
        .single();

      if (!fetchNothingsCountError && currentNothingsCountData) {
        const newCount = Math.max(0, currentNothingsCountData.count - 1);
        const { error: updateNothingsCountError } = await supabase
          .from('yearly_nothings_counts')
          .update({ count: newCount })
          .eq('id', currentNothingsCountData.id);
        if (updateNothingsCountError) {
          console.error("Error decrementing yearly nothings count:", updateNothingsCountError);
          showError("Failed to update 'nothing' count.");
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

    // Reload all data to reflect changes and re-apply current filters
    showSuccess("Entry and associated habit tracking deleted successfully!");
    setEntryToDelete(null);
    setIsDeleteModalOpen(false);
    applyFilters(); // Re-apply current filters after deletion
  };

  const handleEditEntry = (entry: DailyEntry) => {
    setEntryToEdit(entry);
    setIsEditModalOpen(true);
  };

  const handleSaveEditedEntry = async (
    updatedEntry: DailyEntry,
    oldDate: string,
    updatedHabitTracking: { [habitId: string]: { trackedValues?: string[], textValue?: string, isOutOfControlMiss: boolean } } // Updated type
  ) => {
    const { id, date: newDate, text, mood, newLearningText, timestamp } = updatedEntry;
    const oldYear = new Date(oldDate).getFullYear().toString();
    const newYear = new Date(newDate).getFullYear().toString();
    const { data: { user } } = await supabase.auth.getUser();

    // If the date has changed, we need to move the tracking records
    if (newDate !== oldDate) {
      // --- Step 1: Decrement yearly counts for the OLD date's context ---
      for (const habitId in updatedHabitTracking) {
        const trackingInfo = updatedHabitTracking[habitId];
        const habit = allHabits.find(h => h.id === habitId);

        if (!habit) continue;

        if (habit.type === 'tracking') {
          // Decrement yearly out-of-control miss counts for old year
          if (trackingInfo.isOutOfControlMiss) {
            const { data: currentMissCountData, error: fetchMissCountError } = await supabase
              .from('yearly_out_of_control_miss_counts')
              .select('id, used_count')
              .eq('habit_id', habitId)
              .eq('year', oldYear)
              .single();

            if (!fetchMissCountError && currentMissCountData) {
              const newUsedCount = Math.max(0, currentMissCountData.used_count - 1);
              await supabase
                .from('yearly_out_of_control_miss_counts')
                .update({ used_count: newUsedCount })
                .eq('id', currentMissCountData.id);
            }
          }

          // Decrement yearly habit progress for old year
          if (trackingInfo.trackedValues && trackingInfo.trackedValues.length > 0 && habit.yearlyGoal?.contributingValues?.includes(trackingInfo.trackedValues[0])) {
            const { data: currentProgressData, error: fetchProgressError } = await supabase
              .from('yearly_habit_progress')
              .select('id, progress_count')
              .eq('habit_id', habitId)
              .eq('year', oldYear)
              .single();

            if (!fetchProgressError && currentProgressData) {
              const newProgressCount = Math.max(0, currentProgressData.progress_count - 1);
              await supabase
                .from('yearly_habit_progress')
                .update({ progress_count: newProgressCount })
                .eq('id', currentProgressData.id);
            }
          }
        }
      }

      // Decrement yearly nothings count for old year if old entry had "nothing"
      const { data: oldEntryData, error: fetchOldEntryError } = await supabase
        .from('daily_entries')
        .select('new_learning_text')
        .eq('id', id) // Use the original entry ID
        .single();

      if (!fetchOldEntryError && oldEntryData?.new_learning_text?.toLowerCase() === 'nothing' && user) {
        const { data: currentNothingsCountData, error: fetchNothingsCountError } = await supabase
          .from('yearly_nothings_counts')
          .select('id, count')
          .eq('user_id', user.id)
          .eq('year', oldYear)
          .single();

        if (!fetchNothingsCountError && currentNothingsCountData) {
          const newCount = Math.max(0, currentNothingsCountData.count - 1);
          await supabase
            .from('yearly_nothings_counts')
            .update({ count: newCount })
            .eq('id', currentNothingsCountData.id);
        }
      }

      // --- Step 2: Delete all daily_habit_tracking records associated with the OLD date ---
      const { error: deleteOldTrackingError } = await supabase
        .from('daily_habit_tracking')
        .delete()
        .eq('date', oldDate);

      if (deleteOldTrackingError) {
        console.error("Error deleting old daily tracking records:", deleteOldTrackingError);
        showError("Failed to clean up old habit tracking data.");
      }

      // --- Step 3: Insert new daily_habit_tracking records for the NEW date ---
      const newTrackingRecords = Object.entries(updatedHabitTracking).map(([habitId, trackingInfo]) => {
        const habit = allHabits.find(h => h.id === habitId);
        if (!habit) return null;

        if (habit.type === 'tracking') {
          return {
            date: newDate,
            habit_id: habitId,
            tracked_values: trackingInfo.trackedValues || [],
            text_value: null,
            is_out_of_control_miss: trackingInfo.isOutOfControlMiss,
          };
        } else if (habit.type === 'text_field') {
          return {
            date: newDate,
            habit_id: habitId,
            tracked_values: null,
            text_value: trackingInfo.textValue || null,
            is_out_of_control_miss: false, // Text field habits cannot be out-of-control misses
          };
        }
        return null;
      }).filter(Boolean);

      if (newTrackingRecords.length > 0) {
        const { error: insertNewTrackingError } = await supabase
          .from('daily_habit_tracking')
          .insert(newTrackingRecords);

        if (insertNewTrackingError) {
          console.error("Error inserting new daily tracking records:", insertNewTrackingError);
          showError("Failed to insert new habit tracking data.");
        }
      }

      // --- Step 4: Increment yearly counts for the NEW date's context ---
      for (const habitId in updatedHabitTracking) {
        const trackingInfo = updatedHabitTracking[habitId];
        const habit = allHabits.find(h => h.id === habitId);

        if (!habit) continue;

        if (habit.type === 'tracking') {
          // Increment yearly out-of-control miss counts for new year
          if (trackingInfo.isOutOfControlMiss) {
            const { data: currentMissCountData, error: fetchMissCountError } = await supabase
              .from('yearly_out_of_control_miss_counts')
              .select('id, used_count')
              .eq('habit_id', habitId)
              .eq('year', newYear)
              .single();

            if (!fetchMissCountError && currentMissCountData) {
              const newUsedCount = currentMissCountData.used_count + 1;
              await supabase
                .from('yearly_out_of_control_miss_counts')
                .update({ used_count: newUsedCount })
                .eq('id', currentMissCountData.id);
            } else if (fetchMissCountError?.code === 'PGRST116') { // No record exists, insert new
              await supabase
                .from('yearly_out_of_control_miss_counts')
                .insert({ habit_id: habitId, year: newYear, used_count: 1 });
            }
          }

          // Increment yearly habit progress for new year
          if (trackingInfo.trackedValues && trackingInfo.trackedValues.length > 0 && habit.yearlyGoal?.contributingValues?.includes(trackingInfo.trackedValues[0])) {
            const { data: currentProgressData, error: fetchProgressError } = await supabase
              .from('yearly_habit_progress')
              .select('id, progress_count')
              .eq('habit_id', habitId)
              .eq('year', newYear)
              .single();

            if (!fetchProgressError && currentProgressData) {
              const newProgressCount = currentProgressData.progress_count + 1;
              await supabase
                .from('yearly_habit_progress')
                .update({ progress_count: newProgressCount })
                .eq('id', currentProgressData.id);
            } else if (fetchProgressError?.code === 'PGRST116') { // No record exists, insert new
              await supabase
                .from('yearly_habit_progress')
                .insert({ habit_id: habitId, year: newYear, progress_count: 1 });
            }
          }
        }
      }

      // Increment yearly nothings count for new year if new entry has "nothing"
      if (newLearningText?.toLowerCase() === 'nothing' && user) {
        const { data: currentNothingsCountData, error: fetchNothingsCountError } = await supabase
          .from('yearly_nothings_counts')
          .select('id, count')
          .eq('user_id', user.id)
          .eq('year', newYear)
          .single();

        if (!fetchNothingsCountError && currentNothingsCountData) {
          const newCount = currentNothingsCountData.count + 1;
          await supabase
            .from('yearly_nothings_counts')
            .update({ count: newCount })
            .eq('id', currentNothingsCountData.id);
        } else if (fetchNothingsCountError?.code === 'PGRST116') {
          await supabase
            .from('yearly_nothings_counts')
            .insert({ user_id: user.id, year: newYear, count: 1 });
        }
      }
    } else {
      // If date has NOT changed, but new_learning_text changed from/to "nothing"
      const { data: oldEntryData, error: fetchOldEntryError } = await supabase
        .from('daily_entries')
        .select('new_learning_text')
        .eq('id', id)
        .single();

      const oldNewLearningIsNothing = oldEntryData?.new_learning_text?.toLowerCase() === 'nothing';
      const newNewLearningIsNothing = newLearningText?.toLowerCase() === 'nothing';

      if (oldNewLearningIsNothing !== newNewLearningIsNothing && user) {
        const { data: currentNothingsCountData, error: fetchNothingsCountError } = await supabase
          .from('yearly_nothings_counts')
          .select('id, count')
          .eq('user_id', user.id)
          .eq('year', newYear)
          .single();

        if (!fetchNothingsCountError && currentNothingsCountData) {
          let newCount = currentNothingsCountData.count;
          if (newNewLearningIsNothing && !oldNewLearningIsNothing) { // Changed to nothing
            newCount += 1;
          } else if (!newNewLearningIsNothing && oldNewLearningIsNothing) { // Changed from nothing
            newCount = Math.max(0, newCount - 1);
          }
          await supabase
            .from('yearly_nothings_counts')
            .update({ count: newCount })
            .eq('id', currentNothingsCountData.id);
        } else if (newNewLearningIsNothing && fetchNothingsCountError?.code === 'PGRST116' && user) {
          // No record exists, but new entry is "nothing", so insert
          await supabase
            .from('yearly_nothings_counts')
            .insert({ user_id: user.id, year: newYear, count: 1 });
        }
      }

      // Also update daily_habit_tracking records for the same date if values changed
      for (const habitId in updatedHabitTracking) {
        const trackingInfo = updatedHabitTracking[habitId];
        const habit = allHabits.find(h => h.id === habitId);
        if (!habit) continue;

        if (habit.type === 'tracking') {
          const { error: updateTrackingError } = await supabase
            .from('daily_habit_tracking')
            .upsert({
              date: newDate,
              habit_id: habitId,
              tracked_values: trackingInfo.trackedValues || [],
              text_value: null,
              is_out_of_control_miss: trackingInfo.isOutOfControlMiss,
            }, { onConflict: 'date,habit_id' });
          if (updateTrackingError) console.error("Error updating tracking for same date:", updateTrackingError);
        } else if (habit.type === 'text_field') {
          const { error: updateTrackingError } = await supabase
            .from('daily_habit_tracking')
            .upsert({
              date: newDate,
              habit_id: habitId,
              tracked_values: null,
              text_value: trackingInfo.textValue || null,
              is_out_of_control_miss: false,
            }, { onConflict: 'date,habit_id' });
          if (updateTrackingError) console.error("Error updating text tracking for same date:", updateTrackingError);
        }
      }
    }

    // Update the daily_entry record
    const { error: entryUpdateError } = await supabase
      .from('daily_entries')
      .update({ date: newDate, text, mood, new_learning_text: newLearningText.trim() === '' ? null : newLearningText.trim(), timestamp })
      .eq('id', id);

    if (entryUpdateError) {
      console.error("Error updating daily entry:", entryUpdateError);
      showError("Failed to update daily entry.");
    } else {
      showSuccess("Entry updated successfully!");
      applyFilters(); // Re-apply current filters after save
    }
  };

  return (
    <div id="recorded" className="tab-content text-center">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Recorded Entries</h2>
      <p className="text-gray-600 mb-6">A history of all your past journal entries and habit tracking records.</p>

      {/* Filter Section */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8 p-4 bg-gray-50 rounded-lg shadow-sm">
        {/* Date Range Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date-range-picker"
              variant={"outline"}
              className={cn(
                "w-full sm:w-[280px] justify-start text-left font-normal",
                !dateRange && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "LLL dd, y")} -{" "}
                    {format(dateRange.to, "LLL dd, y")}
                  </>
                ) : (
                  format(dateRange.from, "LLL dd, y")
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        {/* Habit Multi-Select with Tracking Values */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full sm:w-[280px] justify-start text-left font-normal">
              {Object.keys(selectedHabitFilters).length > 0
                ? `${Object.keys(selectedHabitFilters).length} Habit${Object.keys(selectedHabitFilters).length > 1 ? 's' : ''} Selected`
                : "Select Habits & Values (Max 3 Habits)"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[300px] max-h-[400px] overflow-y-auto">
            <DropdownMenuLabel>Filter by Habits & Values</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {allHabits.length === 0 ? (
              <DropdownMenuLabel className="text-gray-500 italic">No habits available</DropdownMenuLabel>
            ) : (
              allHabits.map((habit) => (
                <React.Fragment key={habit.id}>
                  <DropdownMenuCheckboxItem
                    checked={!!selectedHabitFilters[habit.id]}
                    onCheckedChange={(checked) => handleHabitToggle(habit.id, habit.name, habit.color, checked)}
                    disabled={!selectedHabitFilters[habit.id] && Object.keys(selectedHabitFilters).length >= 3}
                    onSelect={(e) => e.preventDefault()}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: habit.color }}></div>
                      {habit.name}
                      {selectedHabitFilters[habit.id] && <Check className="ml-auto h-4 w-4" />}
                    </div>
                  </DropdownMenuCheckboxItem>
                  {selectedHabitFilters[habit.id] && habit.type === 'tracking' && (
                    <div className="ml-6 border-l pl-2 py-1">
                      <DropdownMenuLabel className="text-xs text-gray-500">Values for {habit.name}</DropdownMenuLabel>
                      {habit.trackingValues && habit.trackingValues.length > 0 ? (
                        habit.trackingValues.map((value) => (
                          <DropdownMenuCheckboxItem
                            key={value}
                            checked={selectedHabitFilters[habit.id]?.selectedTrackingValues.includes(value)}
                            onCheckedChange={(checked) => handleTrackingValueSelect(habit.id, value, checked)}
                            onSelect={(e) => e.preventDefault()}
                          >
                            {value}
                          </DropdownMenuCheckboxItem>
                        ))
                      ) : (
                        <DropdownMenuLabel className="text-xs text-gray-400 italic">No tracking values</DropdownMenuLabel>
                      )}
                      {habit.allowedOutOfControlMisses && habit.allowedOutOfControlMisses > 0 && (
                        <DropdownMenuCheckboxItem
                          checked={selectedHabitFilters[habit.id]?.includeOutOfControlMiss}
                          onCheckedChange={(checked) => handleOutOfControlMissSelect(habit.id, checked)}
                          onSelect={(e) => e.preventDefault()}
                        >
                          Out-of-Control Miss
                        </DropdownMenuCheckboxItem>
                      )}
                    </div>
                  )}
                  {selectedHabitFilters[habit.id] && habit.type === 'text_field' && (
                    <div className="ml-6 border-l pl-2 py-1">
                      <DropdownMenuLabel className="text-xs text-gray-400 italic">
                        (Free text field - always included if habit selected)
                      </DropdownMenuLabel>
                    </div>
                  )}
                  <DropdownMenuSeparator />
                </React.Fragment>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Filter Buttons */}
        <div className="flex gap-2 w-full sm:w-auto">
          <Button onClick={applyFilters} disabled={isLoadingFilters}>
            {isLoadingFilters ? "Applying..." : "Apply Filters"}
          </Button>
          <Button variant="outline" onClick={clearFilters} disabled={isLoadingFilters}>
            <XCircle className="mr-2 h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      {isLoadingFilters ? (
        <div className="text-center py-8">
          <p className="text-lg text-gray-600">Loading entries...</p>
        </div>
      ) : displayEntries.length === 0 ? (
        <div className="dotted-border-container">
          <p className="text-lg">No entries found matching your filters.</p>
          <Button variant="link" onClick={clearFilters} className="mt-2">Clear filters to see all entries</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayEntries.map((entry) => {
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
                  <p className="text-gray-700 text-left">{entry.text}</p>
                  {entry.newLearningText && (
                    <div className="mt-3 pt-3 border-t border-gray-100 text-left">
                      <h4 className="font-semibold text-gray-800 text-sm mb-1">Something new I learned that day:</h4>
                      <p className="text-sm text-gray-700 italic">{entry.newLearningText}</p>
                    </div>
                  )}
                  
                  <HabitTrackingDisplay 
                    habitsTrackedForDay={habitsTrackedForDay} 
                    allHabits={allHabits} 
                  />

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