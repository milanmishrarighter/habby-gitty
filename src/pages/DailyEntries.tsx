"use client";

import React from "react";
import EmojiPicker from "@/components/EmojiPicker";
import { showSuccess, showError } from "@/utils/toast";

interface DailyEntry {
  date: string;
  text: string;
  mood: string;
  timestamp: string;
}

const DailyEntries: React.FC = () => {
  const [entryDate, setEntryDate] = React.useState("");
  const [journalText, setJournalText] = React.useState("");
  const [moodEmoji, setMoodEmoji] = React.useState("😊");

  const saveEntry = () => {
    if (!entryDate || !journalText.trim()) {
      showError("Please select a date and write your journal entry.");
      return;
    }

    const newEntry: DailyEntry = {
      date: entryDate,
      text: journalText.trim(),
      mood: moodEmoji,
      timestamp: new Date().toISOString(),
    };

    // Retrieve existing entries, add new one, and save back to localStorage
    const storedEntries = localStorage.getItem("dailyJournalEntries");
    const dailyEntries = storedEntries ? JSON.parse(storedEntries) : [];
    dailyEntries.push(newEntry);
    localStorage.setItem("dailyJournalEntries", JSON.stringify(dailyEntries));

    showSuccess("Daily entry saved!");

    // Reset the form after saving
    setEntryDate("");
    setJournalText("");
    setMoodEmoji("😊");
  };

  return (
    <div id="daily" className="tab-content text-center">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Daily Entries</h2>
      <p className="text-gray-600 mb-6">
        Select a date to begin your entry.
      </p>
      <div className="flex flex-col items-center justify-center mb-6">
        <label htmlFor="entry-date" className="block text-sm font-medium text-gray-700 mb-2">Date</label>
        <input
          type="date"
          id="entry-date"
          className="mt-1 p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={entryDate}
          onChange={(e) => setEntryDate(e.target.value)}
        />
      </div>
      {/* Journal Entry Text Box */}
      <div className="flex flex-col items-center justify-center mb-6 w-full">
        <label htmlFor="journal-entry" className="block text-sm font-medium text-gray-700 mb-2">Journal Entry</label>
        <textarea
          id="journal-entry"
          rows={8}
          className="mt-1 p-4 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full resize-y"
          placeholder="Write your thoughts here..."
          value={journalText}
          onChange={(e) => setJournalText(e.target.value)}
        ></textarea>
      </div>
      {/* Mood Emoji Picker */}
      <div className="flex flex-col items-center justify-center mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Mood of the Day</label>
        <EmojiPicker selectedEmoji={moodEmoji} onSelectEmoji={setMoodEmoji} />
      </div>
      {/* Save Entry Button */}
      <div className="flex justify-center mt-8">
        <button
          id="save-button"
          className="px-6 py-3 bg-blue-600 text-white font-bold text-lg rounded-full shadow-lg hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50"
          onClick={saveEntry}
        >
          Save Entry
        </button>
      </div>
    </div>
  );
};

export default DailyEntries;