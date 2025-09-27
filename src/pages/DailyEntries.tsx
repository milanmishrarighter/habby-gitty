"use client";

import React from "react";
import EmojiPicker from "@/components/EmojiPicker";
import DailyHabitTrackerCard from "@/components/DailyHabitTrackerCard";
import DeleteConfirmationModal from "@/components/DeleteConfirmationModal";
import OverwriteConfirmationModal from "@/components/OverwriteConfirmationModal";
import { showSuccess, showError } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Habit } from "@/types/habit";
import { DailyEntry } from "@/types/dailyEntry";
import { DailyTrackingRecord, YearlyProgressRecord, YearlyOutOfControlMissCount } from "@/types/tracking"; // Import new types
import { supabase } from "@/lib/supabase";
import { mapSupabaseHabitToHabit } from "@/utils/habitUtils"; // Import the new utility

interface DailyEntriesProps {
  setActiveTab: (tab: string) => void;
}

const DailyEntries: React.FC<DailyEntriesProps> = ({ setActiveTab }) => {
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [entryDate, setEntryDate] = React.useState(getTodayDate());
  const [journalText, setJournalText] = React.useState("");
  const [moodEmoji, setMoodEmoji] = React.useState("😊");
  const [habits, setHabits] = React.useState<Habit[]>([]);
  const [dailyTracking, setDailyTracking] = React.useState<{ [date: string]: { [habitId: string]: { trackedValues: string[], isOutOfControlMiss: boolean } } }>({});
  const [yearlyProgress, setYearlyProgress] = React.useState<{ [year: string]: { [habitId: string]: number } }>({});
  const [yearlyOutOfControlMissCounts, setYearlyOutOfControlMissCounts] = React.useState<{ [habitId: string]: YearlyOutOfControlMissCount }>({});
  const [currentEntryId, setCurrentEntryId] = React.useState<string | null>(null);

  const [showOverwriteConfirmModal, setShowOverwriteConfirmModal] = React.useState(false);
  const [pendingEntry, setPendingEntry] = React.useState<Omit<DailyEntry, 'id'> | null>(null);

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
        console.log("DailyEntries: Supabase raw habits data:", data); // Log raw data
        const mappedHabits = (data || []).map(mapSupabaseHabitToHabit); // Apply mapping
        console.log("DailyEntries: Mapped habits data:", mappedHabits); // Log mapped data
        setHabits(mappedHabits);
      }
    };
    fetchHabits();
  }, []);

  // Effect to load journal entry, daily tracking, and yearly progress for selected date from Supabase
  React.useEffect(() => {
    const fetchDataForDate = async () => {
      if (!entryDate) {
        setJournalText("");
        setMoodEmoji("😊");
        setCurrentEntryId(null);
        setDailyTracking({});
        setYearlyProgress({});
        setYearlyOutOfControlMissCounts({});
        return;
      }

      // Fetch daily entry
      const { data: entryData, error: entryError } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('date', entryDate)
        .single();

      if (entryError && entryError.code !== 'PGRST116') {
        console.error("Error fetching daily entry:", entryError);
        showError("Failed to load daily entry.");
        setJournalText("");
        setMoodEmoji("😊");
        setCurrentEntryId(null);
      } else if (entryData) {
        setJournalText(entryData.text);
        setMoodEmoji(entryData.mood);
        setCurrentEntryId(entryData.id);
      } else {
        setJournalText("");
        setMoodEmoji("😊");
        setCurrentEntryId(null);
      }

      // Fetch daily habit tracking for the selected date
      const { data: trackingData, error: trackingError } = await supabase
        .from('daily_habit_tracking')
        .select('*')
        .eq('date', entryDate);

      if (trackingError) {
        console.error("Error fetching daily tracking:", trackingError);
        showError("Failed to load daily habit tracking.");
        setDailyTracking({});
      } else {
        const newDailyTracking: { [date: string]: { [habitId: string]: { trackedValues: string[], isOutOfControlMiss: boolean } } } = { [entryDate]: {} };
        trackingData.forEach(record => {
          newDailyTracking[entryDate][record.habit_id] = {
            trackedValues: record.tracked_values,
            isOutOfControlMiss: record.is_out_of_control_miss,
          };
        });
        setDailyTracking(newDailyTracking);
      }

      // Fetch yearly progress for the current year
      const currentYear = new Date(entryDate).getFullYear().toString();
      const { data: yearlyProgressData, error: yearlyProgressError } = await supabase
        .from('yearly_habit_progress')
        .select('*')
        .eq('year', currentYear);

      if (yearlyProgressError) {
        console.error("Error fetching yearly progress:", yearlyProgressError);
        showError("Failed to load yearly habit progress.");
        setYearlyProgress({});
      } else {
        const newYearlyProgress: { [year: string]: { [habitId: string]: number } } = { [currentYear]: {} };
        yearlyProgressData.forEach(record => {
          newYearlyProgress[currentYear][record.habit_id] = record.progress_count;
        });
        setYearlyProgress(newYearlyProgress);
      }

      // Fetch yearly out-of-control miss counts for the current year
      const { data: missCountsData, error: missCountsError } = await supabase
        .from('yearly_out_of_control_miss_counts')
        .select('*')
        .eq('year', currentYear);

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
    };
    fetchDataForDate();
  }, [entryDate]);


  const saveEntry = async (overwrite: boolean = false) => {
    if (!entryDate || !journalText.trim()) {
      showError("Please select a date and write your journal entry.");
      return;
    }

    const entryData = {
      date: entryDate,
      text: journalText.trim(),
      mood: moodEmoji,
      timestamp: new Date().toISOString(),
    };

    if (currentEntryId && !overwrite) {
      setPendingEntry(entryData);
      setShowOverwriteConfirmModal(true);
      return;
    }

    let error = null;
    if (currentEntryId && overwrite) {
      const { error: updateError } = await supabase
        .from('daily_entries')
        .update(entryData)
        .eq('id', currentEntryId);
      error = updateError;
    } else {
      const { data, error: insertError } = await supabase
        .from('daily_entries')
        .insert([entryData])
        .select();
      error = insertError;
      if (data && data.length > 0) {
        setCurrentEntryId(data[0].id);
      }
    }

    if (error) {
      console.error("Error saving daily entry:", error);
      showError("Failed to save daily entry.");
    } else {
      showSuccess("Daily entry saved!");
      setShowOverwriteConfirmModal(false);
      setPendingEntry(null);
    }
  };

  const handleConfirmOverwrite = () => {
    saveEntry(true);
  };

  const handleUpdateTracking = async (
    habitId: string,
    date: string,
    trackedValuesForDay: string[],
    newYearlyProgress: number,
    isOutOfControlMiss: boolean,
    oldIsOutOfControlMiss: boolean,
  ) => {
    // Update daily tracking in Supabase
    const dailyTrackingRecord = {
      date: date,
      habit_id: habitId,
      tracked_values: trackedValuesForDay,
      is_out_of_control_miss: isOutOfControlMiss,
    };

    const { error: dailyTrackingError } = await supabase
      .from('daily_habit_tracking')
      .upsert(dailyTrackingRecord, { onConflict: 'date,habit_id' });

    if (dailyTrackingError) {
      console.error("Error updating daily tracking:", dailyTrackingError);
      showError("Failed to update daily habit tracking.");
    } else {
      setDailyTracking(prev => ({
        ...prev,
        [date]: {
          ...(prev[date] || {}),
          [habitId]: {
            trackedValues: trackedValuesForDay,
            isOutOfControlMiss: isOutOfControlMiss,
          },
        },
      }));
    }

    // Update yearly progress in Supabase
    const currentYear = new Date(date).getFullYear().toString();
    const yearlyProgressRecord = {
      year: currentYear,
      habit_id: habitId,
      progress_count: newYearlyProgress,
    };

    const { error: yearlyProgressError } = await supabase
      .from('yearly_habit_progress')
      .upsert(yearlyProgressRecord, { onConflict: 'year,habit_id' });

    if (yearlyProgressError) {
      console.error("Error updating yearly progress:", yearlyProgressError);
      showError("Failed to update yearly habit progress.");
    } else {
      setYearlyProgress(prev => ({
        ...prev,
        [currentYear]: {
          ...(prev[currentYear] || {}),
          [habitId]: newYearlyProgress,
        },
      }));
    }

    // Update yearly out-of-control miss counts in Supabase
    let updatedUsedCount = yearlyOutOfControlMissCounts[habitId]?.used_count || 0;
    if (isOutOfControlMiss && !oldIsOutOfControlMiss) {
      updatedUsedCount += 1;
    } else if (!isOutOfControlMiss && oldIsOutOfControlMiss) {
      updatedUsedCount = Math.max(0, updatedUsedCount - 1);
    }

    const yearlyMissCountRecord = {
      habit_id: habitId,
      year: currentYear,
      used_count: updatedUsedCount,
    };

    const { data: missCountUpsertData, error: missCountError } = await supabase
      .from('yearly_out_of_control_miss_counts')
      .upsert(yearlyMissCountRecord, { onConflict: 'habit_id,year' })
      .select();

    if (missCountError) {
      console.error("Error updating yearly out-of-control miss count:", missCountError);
      showError("Failed to update out-of-control miss count.");
    } else if (missCountUpsertData && missCountUpsertData.length > 0) {
      setYearlyOutOfControlMissCounts(prev => ({
        ...prev,
        [habitId]: missCountUpsertData[0],
      }));
    }
  };

  const handleSetupHabitClick = () => {
    setActiveTab("setup");
  };

  // Moved console.log into a useEffect
  React.useEffect(() => {
    console.log("DailyEntries: Current habits state for rendering (from useEffect):", habits);
  }, [habits]);

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
              const initialTrackedValue = entryDate && dailyTracking[entryDate]?.[habit.id]?.trackedValues?.length > 0
                ? dailyTracking[entryDate][habit.id].trackedValues[0]
                : null;
              const initialIsOutOfControlMiss = entryDate && dailyTracking[entryDate]?.[habit.id]?.isOutOfControlMiss || false;

              return (
                <DailyHabitTrackerCard
                  key={habit.id}
                  habit={habit}
                  entryDate={entryDate}
                  onUpdateTracking={handleUpdateTracking}
                  currentYearlyProgress={currentYearlyProgress}
                  initialTrackedValue={initialTrackedValue}
                  initialIsOutOfControlMiss={initialIsOutOfControlMiss}
                  yearlyOutOfControlMissCounts={yearlyOutOfControlMissCounts}
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
        itemToOverwriteName={pendingEntry ? `the entry for ${pendingEntry.date}` : "this entry"}
      />
    </div>
  );
};

export default DailyEntries;