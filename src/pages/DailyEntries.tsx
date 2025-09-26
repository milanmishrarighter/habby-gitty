"use client";

import React from "react";
import EmojiPicker from "@/components/EmojiPicker";
import DailyHabitTrackerCard from "@/components/DailyHabitTrackerCard";
import DeleteConfirmationModal from "@/components/DeleteConfirmationModal";
import OverwriteConfirmationModal from "@/components/OverwriteConfirmationModal"; // Import the new modal
import { showSuccess, showError } from "@/utils/toast";
import { Button } from "@/components/ui/button"; // Assuming you have a Button component
import { Habit } from "@/types/habit"; // Import the centralized Habit interface
import { supabase } from "@/lib/supabase"; // Import Supabase client

interface DailyEntry {
  date: string;
  text: string;
  mood: string;
  timestamp: string;
}

// Data structures for localStorage
interface DailyTrackingRecord {
  [date: string]: {
    [habitId: string]: string[]; // Array of contributing values tracked for this habit on this date
  };
}

interface YearlyProgressRecord {
  [year: string]: {
    [habitId: string]: number; // Current achieved count for this habit in this year
  };
}

interface DailyEntriesProps {
  setActiveTab: (tab: string) => void;
}

const DailyEntries: React.FC<DailyEntriesProps> = ({ setActiveTab }) => {
  // Function to get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [entryDate, setEntryDate] = React.useState(getTodayDate());
  const [journalText, setJournalText] = React.useState("");
  const [moodEmoji, setMoodEmoji] = React.useState("😊");
  const [habits, setHabits] = React.useState<Habit[]>([]);
  const [dailyTracking, setDailyTracking] = React.useState<DailyTrackingRecord>({});
  const [yearlyProgress, setYearlyProgress] = React.useState<YearlyProgressRecord>({});

  const [showOverwriteConfirmModal, setShowOverwriteConfirmModal] = React.useState(false);
  const [pendingEntry, setPendingEntry] = React.useState<DailyEntry | null>(null);

  // Load habits from Supabase on component mount
  React.useEffect(() => {
    const fetchHabits = async () => {
      const { data, error } = await supabase
        .from('habits')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching habits for DailyEntries:", error);
        showError("Failed to load habits for tracking.");
      } else {
        setHabits(data as Habit[]);
      }
    };
    fetchHabits();
  }, []);

  // Load daily tracking and yearly progress on component mount
  React.useEffect(() => {
    const storedDailyTracking = localStorage.getItem('dailyHabitTracking');
    if (storedDailyTracking) {
      setDailyTracking(JSON.parse(storedDailyTracking));
    }
    const storedYearlyProgress = localStorage.getItem('yearlyHabitProgress');
    if (storedYearlyProgress) {
      setYearlyProgress(JSON.parse(storedYearlyProgress));
    }
  }, []);

  // Save daily tracking and yearly progress whenever they change
  React.useEffect(() => {
    localStorage.setItem('dailyHabitTracking', JSON.stringify(dailyTracking));
  }, [dailyTracking]);

  React.useEffect(() => {
    localStorage.setItem('yearlyHabitProgress', JSON.stringify(yearlyProgress));
  }, [yearlyProgress]);

  // Effect to load journal entry for selected date
  React.useEffect(() => {
    if (entryDate) {
      const storedEntries = localStorage.getItem("dailyJournalEntries");
      const dailyEntries: DailyEntry[] = storedEntries ? JSON.parse(storedEntries) : [];
      const entryForDate = dailyEntries.find(entry => entry.date === entryDate);

      if (entryForDate) {
        setJournalText(entryForDate.text);
        setMoodEmoji(entryForDate.mood);
      } else {
        setJournalText("");
        setMoodEmoji("😊");
      }
    } else {
      setJournalText("");
      setMoodEmoji("😊");
    }
  }, [entryDate]);


  const saveEntry = (overwrite: boolean = false) => {
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

    const storedEntries = localStorage.getItem("dailyJournalEntries");
    let dailyEntries: DailyEntry[] = storedEntries ? JSON.parse(storedEntries) : [];

    const existingEntryIndex = dailyEntries.findIndex(entry => entry.date === entryDate);

    if (existingEntryIndex > -1 && !overwrite) {
      setPendingEntry(newEntry);
      setShowOverwriteConfirmModal(true);
      return;
    }

    if (existingEntryIndex > -1) {
      dailyEntries[existingEntryIndex] = newEntry;
    } else {
      dailyEntries.push(newEntry);
    }

    localStorage.setItem("dailyJournalEntries", JSON.stringify(dailyEntries));
    showSuccess("Daily entry saved!");
    setShowOverwriteConfirmModal(false);
    setPendingEntry(null);
  };

  const handleConfirmOverwrite = () => {
    saveEntry(true); // Proceed with saving, indicating overwrite is confirmed
  };

  const handleUpdateTracking = (habitId: string, date: string, trackedValuesForDay: string[], newYearlyProgress: number) => {
    setDailyTracking(prev => ({
      ...prev,
      [date]: {
        ...(prev[date] || {}),
        [habitId]: trackedValuesForDay,
      },
    }));

    const currentYear = new Date(date).getFullYear().toString();
    setYearlyProgress(prev => ({
      ...prev,
      [currentYear]: {
        ...(prev[currentYear] || {}),
        [habitId]: newYearlyProgress,
      },
    }));
  };

  const handleSetupHabitClick = () => {
    setActiveTab("setup");
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

      {/* Daily Habit Tracking Section */}
      <div className="mt-8 pt-8 border-t border-gray-200">
        <h3 className="text-2xl font-bold text-gray-800 mb-4">Daily Habit Tracking</h3>
        {habits.length === 0 ? (
          <div className="dotted-border-container">
            <p className="text-lg mb-2">No habits added yet.</p>
            <button
              onClick={handleSetupHabitClick}
              className="text-blue-500 hover:text-blue-700 underline font-semibold"
            >
              Click here to setup a new habit
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {habits.map((habit) => {
              const currentYear = entryDate ? new Date(entryDate).getFullYear().toString() : new Date().getFullYear().toString();
              const currentYearlyProgress = yearlyProgress[currentYear]?.[habit.id] || 0;
              // Extract the single tracked value for the day, or null if none
              const initialTrackedValue = entryDate && dailyTracking[entryDate]?.[habit.id]?.length > 0
                ? dailyTracking[entryDate][habit.id][0]
                : null;

              return (
                <DailyHabitTrackerCard
                  key={habit.id}
                  habit={habit}
                  entryDate={entryDate}
                  onUpdateTracking={handleUpdateTracking}
                  currentYearlyProgress={currentYearlyProgress}
                  initialTrackedValue={initialTrackedValue} // Pass single value
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Single Save Entry Button at the very bottom */}
      <div className="flex justify-center mt-8">
        <button
          id="save-button-bottom"
          className="px-6 py-3 bg-blue-600 text-white font-bold text-lg rounded-full shadow-lg hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50"
          onClick={() => saveEntry()}
        >
          Save Entry
        </button>
      </div>

      <OverwriteConfirmationModal
        isOpen={showOverwriteConfirmModal}
        onClose={() => setShowOverwriteConfirmModal(false)}
        onConfirm={handleConfirmOverwrite}
        itemToOverwriteName={`the entry for ${entryDate}`}
      />
    </div>
  );
};

export default DailyEntries;