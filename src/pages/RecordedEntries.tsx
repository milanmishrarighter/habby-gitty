"use client";

import React from "react";
import EditDailyEntryModal from "@/components/EditDailyEntryModal";
import DeleteConfirmationModal from "@/components/DeleteConfirmationModal";
import { showSuccess, showError } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, addDays } from 'date-fns';
import { Habit } from "@/types/habit";
import { DailyEntry } from "@/types/dailyEntry";
import { DailyTrackingRecord, YearlyProgressRecord } from "@/types/tracking";
import { supabase } from "@/lib/supabase";
import { mapSupabaseHabitToHabit } from "@/utils/habitUtils";

// Shadcn UI components for filters
import { CalendarIcon, XCircle } from "lucide-react";
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

const RecordedEntries: React.FC = () => {
  const [dailyEntries, setDailyEntries] = React.useState<DailyEntry[]>([]); // All entries fetched
  const [displayEntries, setDisplayEntries] = React.useState<DailyEntry[]>([]); // Entries currently displayed after filtering
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [entryToEdit, setEntryToEdit] = React.useState<DailyEntry | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [entryToDelete, setEntryToDelete] = React.useState<{ id: string; date: string } | null>(null);
  const [habits, setHabits] = React.useState<Habit[]>([]);
  const [dailyTracking, setDailyTracking] = React.useState<{ [date: string]: { [habitId: string]: { trackedValues: string[], isOutOfControlMiss: boolean } } }>({});

  // Filter states
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);
  const [selectedHabitIds, setSelectedHabitIds] = React.useState<string[]>([]);
  const [isLoadingFilters, setIsLoadingFilters] = React.useState(false);

  // Function to load entries, habits, and daily tracking based on filters
  const loadAllData = React.useCallback(async (filters?: { dateRange?: DateRange, habitIds?: string[] }) => {
    setIsLoadingFilters(true);
    // Fetch habits from Supabase (always needed for display and deletion logic)
    const { data: habitsData, error: habitsError } = await supabase
      .from('habits')
      .select('*');

    if (habitsError) {
      console.error("Error fetching habits for RecordedEntries:", habitsError);
      showError("Failed to load habits.");
      setHabits([]);
    } else {
      setHabits((habitsData || []).map(mapSupabaseHabitToHabit));
    }

    let entryDatesToFetch: string[] | undefined = undefined;

    // If habit filters are applied, first find relevant dates from daily_habit_tracking
    if (filters?.habitIds && filters.habitIds.length > 0) {
      let trackingDatesQuery = supabase
        .from('daily_habit_tracking')
        .select('date')
        .in('habit_id', filters.habitIds);

      if (filters.dateRange?.from) {
        trackingDatesQuery = trackingDatesQuery.gte('date', format(filters.dateRange.from, 'yyyy-MM-dd'));
      }
      if (filters.dateRange?.to) {
        trackingDatesQuery = trackingDatesQuery.lte('date', format(filters.dateRange.to, 'yyyy-MM-dd'));
      }

      const { data: filteredTrackingDates, error: filteredTrackingError } = await trackingDatesQuery;

      if (filteredTrackingError) {
        console.error("Error fetching filtered tracking dates:", filteredTrackingError);
        showError("Failed to filter entries by habits.");
        setDisplayEntries([]);
        setDailyTracking({});
        setIsLoadingFilters(false);
        return;
      }
      entryDatesToFetch = Array.from(new Set(filteredTrackingDates.map(t => t.date)));
      if (entryDatesToFetch.length === 0) {
        // No entries match the habit filter for the given date range
        setDisplayEntries([]);
        setDailyTracking({});
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
      setDailyEntries(entriesData as DailyEntry[]); // Keep all fetched entries in case filters are cleared
      setDisplayEntries(entriesData as DailyEntry[]); // Display the filtered ones
    }

    // Fetch daily habit tracking records for the *displayed* entries
    let allTrackingQuery = supabase.from('daily_habit_tracking').select('*');
    if (entriesData && entriesData.length > 0) {
      const datesOfDisplayedEntries = entriesData.map(entry => entry.date);
      allTrackingQuery = allTrackingQuery.in('date', datesOfDisplayedEntries);
      if (filters?.habitIds && filters.habitIds.length > 0) {
        allTrackingQuery = allTrackingQuery.in('habit_id', filters.habitIds);
      }
    } else {
      // If no entries are displayed, no tracking data is needed
      setDailyTracking({});
      setIsLoadingFilters(false);
      return;
    }

    const { data: trackingData, error: trackingError } = await allTrackingQuery;

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
    setIsLoadingFilters(false);
  }, []);

  // Load data on component mount (initial load with no filters)
  React.useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const applyFilters = () => {
    loadAllData({ dateRange, habitIds: selectedHabitIds });
  };

  const clearFilters = () => {
    setDateRange(undefined);
    setSelectedHabitIds([]);
    loadAllData(); // Load all data without filters
  };

  const handleHabitSelect = (habitId: string, checked: boolean) => {
    setSelectedHabitIds((prev) => {
      if (checked) {
        if (prev.length < 3) {
          return [...prev, habitId];
        } else {
          showError("You can select a maximum of 3 habits.");
          return prev; // Don't add if already 3 selected
        }
      } else {
        return prev.filter((id) => id !== habitId);
      }
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
      // Reload all data to reflect changes and re-apply current filters
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

        {/* Habit Multi-Select */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full sm:w-[280px] justify-start text-left font-normal">
              {selectedHabitIds.length > 0
                ? `${selectedHabitIds.length} Habit${selectedHabitIds.length > 1 ? 's' : ''} Selected`
                : "Select Habits (Max 3)"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[280px]">
            <DropdownMenuLabel>Select Habits</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {habits.length === 0 ? (
              <DropdownMenuLabel className="text-gray-500 italic">No habits available</DropdownMenuLabel>
            ) : (
              habits.map((habit) => (
                <DropdownMenuCheckboxItem
                  key={habit.id}
                  checked={selectedHabitIds.includes(habit.id)}
                  onCheckedChange={(checked) => handleHabitSelect(habit.id, checked)}
                  disabled={!selectedHabitIds.includes(habit.id) && selectedHabitIds.length >= 3}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: habit.color }}></div>
                    {habit.name}
                  </div>
                </DropdownMenuCheckboxItem>
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