"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import EmojiPicker from "@/components/EmojiPicker";
import { showSuccess, showError } from "@/utils/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

interface DailyEntry {
  id: string;
  date: string;
  text: string;
  mood: string;
  timestamp: string;
}

const DailyEntries: React.FC = () => {
  const [entryDate, setEntryDate] = React.useState("");
  const [journalText, setJournalText] = React.useState("");
  const [moodEmoji, setMoodEmoji] = React.useState("😊");
  const [dailyEntries, setDailyEntries] = React.useState<DailyEntry[]>([]);

  // Load entries from localStorage on initial mount
  React.useEffect(() => {
    const storedEntries = localStorage.getItem("dailyJournalEntries");
    if (storedEntries) {
      setDailyEntries(JSON.parse(storedEntries));
    }
  }, []);

  // Save entries to localStorage whenever the dailyEntries state changes
  React.useEffect(() => {
    localStorage.setItem("dailyJournalEntries", JSON.stringify(dailyEntries));
  }, [dailyEntries]);

  const saveEntry = () => {
    if (!entryDate || !journalText.trim()) {
      showError("Please select a date and write your journal entry.");
      return;
    }

    const newEntry: DailyEntry = {
      id: Date.now().toString(), // Simple unique ID
      date: entryDate,
      text: journalText.trim(),
      mood: moodEmoji,
      timestamp: new Date().toISOString(),
    };

    setDailyEntries((prev) => [...prev, newEntry]);
    showSuccess("Daily entry saved!");

    // Reset the form after saving
    setEntryDate("");
    setJournalText("");
    setMoodEmoji("😊");
  };

  return (
    <div className="p-4 space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">Daily Entries</h2>
        <p className="text-gray-600 mb-6">
          Capture your thoughts and mood for the day.
        </p>

        <div className="flex flex-col items-center justify-center mb-6">
          <label htmlFor="entry-date" className="block text-sm font-medium text-gray-700 mb-2">
            Date
          </label>
          <Input
            type="date"
            id="entry-date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className="mt-1 p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full max-w-xs"
          />
        </div>

        {/* Journal Entry Text Box */}
        <div className="flex flex-col items-center justify-center mb-6 w-full">
          <label htmlFor="journal-entry" className="block text-sm font-medium text-gray-700 mb-2">
            Journal Entry
          </label>
          <Textarea
            id="journal-entry"
            rows={8}
            value={journalText}
            onChange={(e) => setJournalText(e.target.value)}
            placeholder="Write your thoughts here..."
            className="mt-1 p-4 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full max-w-2xl resize-y"
          />
        </div>

        {/* Mood Emoji Picker */}
        <div className="flex flex-col items-center justify-center mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mood of the Day
          </label>
          <EmojiPicker selectedEmoji={moodEmoji} onSelectEmoji={setMoodEmoji} />
        </div>

        {/* Save Entry Button */}
        <div className="flex justify-center mt-8">
          <Button
            onClick={saveEntry}
            className="px-6 py-3 bg-blue-600 text-white font-bold text-lg rounded-full shadow-lg hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50"
          >
            Save Entry
          </Button>
        </div>
      </div>

      {/* Display Recent Entries (Optional, can be moved to RecordedEntries) */}
      <div className="mt-12 pt-8 border-t border-gray-200">
        <h3 className="text-2xl font-bold text-gray-800 mb-6">Recent Entries</h3>
        {dailyEntries.length === 0 ? (
          <div className="p-6 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 italic">
            <p>No entries recorded yet. Start journaling!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dailyEntries
              .slice(-3) // Show last 3 entries
              .reverse()
              .map((entry) => (
                <Card key={entry.id} className="shadow-lg hover:shadow-xl transition-shadow duration-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl font-semibold flex items-center justify-between">
                      <span>{format(new Date(entry.date), "PPP")}</span>
                      <span className="text-3xl">{entry.mood}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 text-sm line-clamp-3">{entry.text}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Recorded: {format(new Date(entry.timestamp), "p")}
                    </p>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyEntries;