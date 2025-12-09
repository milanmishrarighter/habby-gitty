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
import { supabase } from "@/lib/supabase";
import { mapSupabaseHabitToHabit } from "@/utils/habitUtils";
import { mapSupabaseEntryToDailyEntry } from "@/utils/dailyEntryUtils";

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

import TrackedForDate from "@/components/TrackedForDate";

interface HabitFilterState {
  [habitId: string]: {
    name: string;
    color: string;
    selectedTrackingValues: string[];
    includeOutOfControlMiss: boolean;
  };
}

const RecordedEntries: React.FC = () => {
  const [dailyEntries, setDailyEntries] = React.useState<DailyEntry[]>([]); // All entries fetched
  const [displayEntries, setDisplayEntries] = React.useState<DailyEntry[]>([]); // Entries currently displayed after filtering
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [entryToEdit, setEntryToEdit] = React.useState<DailyEntry | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [entryToDelete, setEntryToDelete] = React.useState<{ id: string; date: string } | null>(null);
  const [allHabits, setAllHabits] = React.useState<Habit[]>([]); // All habits for name/color mapping

  // Filter states
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);
  const [selectedHabitFilters, setSelectedHabitFilters] = React.useState<HabitFilterState>({});
  const [isLoadingFilters, setIsLoadingFilters] = React.useState(false);

  // Function to load entries and habits based on filters
  const loadAllData = React.useCallback(async (filters?: { dateRange?: DateRange, selectedHabitFilters?: HabitFilterState }) => {
    setIsLoadingFilters(true);

    // Fetch all habits from Supabase
    const { data: habitsData, error: habitsError } = await supabase
      .from('habits')
      .select('*')
      .order('created_at', { ascending: true });

    if (habitsError) {
      console.error("Error fetching habits for RecordedEntries:", habitsError);
      showError("Failed to load habits.");
      setAllHabits([]);
    } else {
      setAllHabits((habitsData || []).map(mapSupabaseHabitToHabit));
    }

    // Build entries query (filter by date range if provided)
    let entryQuery = supabase.from('daily_entries').select('*');
    if (filters?.dateRange?.from) {
      entryQuery = entryQuery.gte('date', format(filters.dateRange.from, 'yyyy-MM-dd'));
    }
    if (filters?.dateRange?.to) {
      entryQuery = entryQuery.lte('date', format(filters.dateRange.to, 'yyyy-MM-dd'));
    }

    const { data: entriesData, error: entriesError } = await entryQuery.order('date', { ascending: false });

    if (entriesError) {
      console.error("Error fetching daily entries:", entriesError);
      showError("Failed to load daily entries.");
      setDisplayEntries([]);
      setIsLoadingFilters(false);
      return;
    }

    const mappedEntries = (entriesData || []).map(mapSupabaseEntryToDailyEntry);
    setDailyEntries(mappedEntries); // keep all fetched entries
    setDisplayEntries(mappedEntries); // display them (habit filters will be applied via the per-card fetch component)
    setIsLoadingFilters(false);
  }, []);

  // Initial load
  React.useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const applyFilters = () => {
    loadAllData({ dateRange, selectedHabitFilters });
  };

  const clearFilters = () => {
    setDateRange(undefined);
    setSelectedHabitFilters({});
    loadAllData();
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

    // Decrement yearly-notes if needed and delete entry and tracking rows
    const { error: entryDeleteError } = await supabase
      .from('daily_entries')
      .delete()
      .eq('id', idToDelete);

    if (entryDeleteError) {
      console.error("Error deleting daily entry:", entryDeleteError);
      showError("Failed to delete daily entry.");
      return;
    }

    const { error: trackingDeleteError } = await supabase
      .from('daily_habit_tracking')
      .delete()
      .eq('date', dateToDelete);

    if (trackingDeleteError) {
      console.error("Error deleting associated daily tracking:", trackingDeleteError);
      showError("Failed to delete associated habit tracking.");
    }

    showSuccess("Entry and associated habit tracking deleted successfully!");
    setEntryToDelete(null);
    setIsDeleteModalOpen(false);
    applyFilters(); // reload with current filters
  };

  const handleEditEntry = (entry: DailyEntry) => {
    setEntryToEdit(entry);
    setIsEditModalOpen(true);
  };

  const handleSaveEditedEntry = async (
    updatedEntry: DailyEntry,
    _oldDate: string,
    _updatedHabitTracking: { [habitId: string]: { trackedValues: string[], isOutOfControlMiss: boolean } }
  ) => {
    const { id, date: newDate, text, mood, newLearningText, timestamp } = updatedEntry;

    const { error: entryUpdateError } = await supabase
      .from('daily_entries')
      .update({ date: newDate, text, mood, new_learning_text: newLearningText?.trim() === '' ? null : newLearningText?.trim(), timestamp })
      .eq('id', id);

    if (entryUpdateError) {
      console.error("Error updating daily entry:", entryUpdateError);
      showError("Failed to update daily entry.");
    } else {
      showSuccess("Entry updated successfully!");
      applyFilters();
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
                  {selectedHabitFilters[habit.id] && (
                    <div className="ml-6 border-l pl-2 py-1">
                      <DropdownMenuLabel className="text-xs text-gray-500">Values for {habit.name}</DropdownMenuLabel>
                      {habit.trackingValues.length > 0 ? (
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
                      {habit.allowedOutOfControlMisses > 0 && (
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
            const formattedDate = format(new Date(entry.date), 'do MMMM yyyy');
            return (
              <Card key={entry.id} className="flex flex-col justify-between">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{formattedDate}</span>
                    <span className="text-3xl">{entry.mood}</span>
                  </CardTitle>

                  {/* Per-card tracked habits fetched directly */}
                  <TrackedForDate date={entry.date} allHabits={allHabits} />
                </CardHeader>

                <CardContent className="flex-grow">
                  <p className="text-gray-700 text-left">{entry.text}</p>
                  {entry.newLearningText && (
                    <div className="mt-3 pt-3 border-t border-gray-100 text-left">
                      <h4 className="font-semibold text-gray-800 text-sm mb-1">Something new I learned that day:</h4>
                      <p className="text-sm text-gray-700 italic">{entry.newLearningText}</p>
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