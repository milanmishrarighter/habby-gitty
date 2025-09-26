"use client";

import React from "react";
import EditDailyEntryModal from "@/components/EditDailyEntryModal";
import { showSuccess, showError } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DailyEntry {
  date: string;
  text: string;
  mood: string;
  timestamp: string;
}

const RecordedEntries: React.FC = () => {
  const [dailyEntries, setDailyEntries] = React.useState<DailyEntry[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [entryToEdit, setEntryToEdit] = React.useState<DailyEntry | null>(null);

  // Function to load entries from localStorage
  const loadEntries = () => {
    const storedEntries = localStorage.getItem("dailyJournalEntries");
    if (storedEntries) {
      // Sort entries by date in descending order (most recent first)
      const parsedEntries: DailyEntry[] = JSON.parse(storedEntries);
      parsedEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setDailyEntries(parsedEntries);
    } else {
      setDailyEntries([]);
    }
  };

  // Load entries on component mount
  React.useEffect(() => {
    loadEntries();
  }, []);

  const handleDeleteEntry = (dateToDelete: string) => {
    if (window.confirm("Are you sure you want to delete this entry?")) {
      const updatedEntries = dailyEntries.filter(entry => entry.date !== dateToDelete);
      localStorage.setItem("dailyJournalEntries", JSON.stringify(updatedEntries));
      setDailyEntries(updatedEntries);
      showSuccess("Entry deleted successfully!");

      // Optionally, also clear habit tracking for this date if desired
      // For now, we'll leave habit tracking as is, as it might be useful to keep history
      // If you want to delete habit tracking for this date:
      // const storedDailyTracking = localStorage.getItem('dailyHabitTracking');
      // if (storedDailyTracking) {
      //   const dailyTracking = JSON.parse(storedDailyTracking);
      //   delete dailyTracking[dateToDelete];
      //   localStorage.setItem('dailyHabitTracking', JSON.stringify(dailyTracking));
      // }
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
    setDailyEntries(updatedEntries); // Update state to re-render
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
          {dailyEntries.map((entry) => (
            <Card key={entry.date} className="flex flex-col justify-between">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{entry.date}</span>
                  <span className="text-3xl">{entry.mood}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-gray-700 text-left line-clamp-4">{entry.text}</p>
                <p className="text-xs text-gray-500 mt-2 text-right">
                  Last updated: {new Date(entry.timestamp).toLocaleString()}
                </p>
              </CardContent>
              <div className="flex justify-end gap-2 p-4 border-t">
                <Button variant="outline" size="sm" onClick={() => handleEditEntry(entry)}>Edit</Button>
                <Button variant="destructive" size="sm" onClick={() => handleDeleteEntry(entry.date)}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <EditDailyEntryModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        initialEntry={entryToEdit}
        onSave={handleSaveEditedEntry}
      />
    </div>
  );
};

export default RecordedEntries;