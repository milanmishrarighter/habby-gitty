"use client";

import React from "react";
import EditDailyEntryModal from "@/components/EditDailyEntryModal";
import DeleteConfirmationModal from "@/components/DeleteConfirmationModal";
import { showSuccess, showError } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DailyEntry {
  date: string;
  text: string;
  mood: string;
  timestamp: string;
}

interface Habit {
  id: string;
  name: string;
  color: string;
  trackingValues: string[];
  frequencyConditions: { trackingValue: string; frequency: string; count: number }[];
  fineAmount: number;
  yearlyGoal: {
    count: number;
    contributingValues: string[];
  };
  createdAt: string;
}

interface DailyTrackingRecord {
  [date: string]: {
    [habitId: string]: string[];
  };
}

const RecordedEntries: React.FC = () => {
  const [dailyEntries, setDailyEntries] = React.useState<DailyEntry[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [entryToEdit, setEntryToEdit] = React.useState<DailyEntry | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [dateToDelete, setDateToDelete] = React.useState<string | null>(null);
  const [habits, setHabits] = React.useState<Habit[]>([]);
  const [dailyTracking, setDailyTracking] = React.useState<DailyTrackingRecord>({});

  // Function to load entries, habits, and daily tracking from localStorage
  const loadAllData = () => {
    const storedEntries = localStorage.getItem("dailyJournalEntries");
    if (storedEntries) {
      const parsedEntries: DailyEntry[] = JSON.parse(storedEntries);
      parsedEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setDailyEntries(parsedEntries);
    } else {
      setDailyEntries([]);
    }

    const storedHabits = localStorage.getItem('dailyJournalHabits');
    if (storedHabits) {
      setHabits(JSON.parse(storedHabits));
    } else {
      setHabits([]);
    }

    const storedDailyTracking = localStorage.getItem('dailyHabitTracking');
    if (storedDailyTracking) {
      setDailyTracking(JSON.parse(storedDailyTracking));
    } else {
      setDailyTracking({});
    }
  };

  // Load data on component mount
  React.useEffect(() => {
    loadAllData();
  }, []);

  const handleDeleteClick = (date: string) => {
    setDateToDelete(date);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (dateToDelete) {
      // Remove entry
      const updatedEntries = dailyEntries.filter(entry => entry.date !== dateToDelete);
      localStorage.setItem("dailyJournalEntries", JSON.stringify(updatedEntries));
      setDailyEntries(updatedEntries);

      // Remove daily tracking for this date
      const updatedDailyTracking = { ...dailyTracking };
      delete updatedDailyTracking[dateToDelete];
      localStorage.setItem('dailyHabitTracking', JSON.stringify(updatedDailyTracking));
      setDailyTracking(updatedDailyTracking);

      // Note: Yearly progress and fines are not automatically reverted here,
      // as they are aggregate calculations. If a user deletes an entry,
      // they might need to manually adjust yearly goals or fine statuses if
      // that entry significantly impacted them.

      showSuccess("Entry and associated habit tracking deleted successfully!");
      setDateToDelete(null);
      setIsDeleteModalOpen(false);
    }
  };

  const handleEditEntry = (entry: DailyEntry) => {
    setEntryToEdit(entry);
    setIsEditModalOpen(true);
  };

  const handleSaveEditedEntry = (updatedEntry: DailyEntry) => {
    const updatedEntries = dailyEntries.map(entry =>
      entry.date === updatedEntry.date ? updatedEntry : entry
    );
    localStorage.setItem("dailyJournalEntries", JSON.stringify(updatedEntries));
    setDailyEntries(updatedEntries);
    // No need for success toast here, as it's handled in the modal
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
            return (
              <Card key={entry.date} className="flex flex-col justify-between">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{entry.date}</span>
                    <span className="text-3xl">{entry.mood}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-gray-700 text-left line-clamp-4">{entry.text}</p>
                  {habitsTrackedForDay && Object.keys(habitsTrackedForDay).length > 0 && (
                    <div className="mt-4 pt-2 border-t border-gray-100 text-left">
                      <h4 className="font-semibold text-gray-800 text-sm mb-1">Habits Tracked:</h4>
                      <ul className="list-disc list-inside text-sm text-gray-600">
                        {Object.entries(habitsTrackedForDay).map(([habitId, trackedValues]) => {
                          const habit = habits.find(h => h.id === habitId);
                          if (habit && trackedValues.length > 0) {
                            return (
                              <li key={habitId} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: habit.color }}></div>
                                <span className="font-medium" style={{ color: habit.color }}>{habit.name}:</span> {trackedValues.join(', ')}
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
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(entry.date)}>Delete</Button>
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
        itemToDeleteName={dateToDelete ? `the entry for ${dateToDelete}` : "this entry"}
      />
    </div>
  );
};

export default RecordedEntries;