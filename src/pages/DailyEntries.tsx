"use client";

import React from "react";
import EmojiPicker from "@/components/EmojiPicker";
import DailyHabitTrackerCard from "@/components/DailyHabitTrackerCard";
import DeleteConfirmationModal from "@/components/DeleteConfirmationModal";
import OverwriteConfirmationModal from "@/components/OverwriteConfirmationModal";
import { showSuccess, showError, showInfo, dismissToast } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Habit } from "@/types/habit";
import { DailyEntry } from "@/types/dailyEntry";
import { DailyTrackingRecord, YearlyProgressRecord, YearlyOutOfControlMissCount, WeeklyOffRecord } from "@/types/tracking"; // Import new types
import { supabase } from "@/lib/supabase";
import { mapSupabaseHabitToHabit } from "@/utils/habitUtils";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, addDays, isMonday, getISOWeek, eachDayOfInterval } from 'date-fns'; // Added addDays, isMonday, getISOWeek, eachDayOfInterval
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch"; // Import Switch component
import { AppSettings } from "@/types/appSettings"; // Import AppSettings

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

  const [weeklyTrackingCounts, setWeeklyTrackingCounts] = React.useState<{ [habitId: string]: { [trackingValue: string]: number } }>({});
  const [monthlyTrackingCounts, setMonthlyTrackingCounts] = React.useState<{ [habitId: string]: { [trackingValue: string]: number } }>({});

  const [showOverwriteConfirmModal, setShowOverwriteConfirmModal] = React.useState(false);
  const [pendingEntry, setPendingEntry] = React.useState<Omit<DailyEntry, 'id'> | null>(null);

  const [highlightDate, setHighlightDate] = React.useState(false);
  const toastIdRef = React.useRef<string | number | null>(null);

  // New states for week off feature
  const [appSettings, setAppSettings] = React.useState<AppSettings | null>(null);
  const [currentWeekOffRecord, setCurrentWeekOffRecord] = React.useState<WeeklyOffRecord | null>(null);
  const [usedWeekOffsCount, setUsedWeekOffsCount] = React.useState<number>(0);
  const [isWeekOffLoading, setIsWeekOffLoading] = React.useState(false);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false); // New state for authentication status

  // Effect to set default date, highlight, and show hint
  React.useEffect(() => {
    const fetchLastEntryDate = async () => {
      const { data: latestEntry, error } = await supabase
        .from('daily_entries')
        .select('date')
        .order('date', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 means "no rows found"
        console.error("Error fetching latest daily entry date:", error);
        showError("Failed to load last entry date.");
        setEntryDate(getTodayDate()); // Fallback to today
      } else if (latestEntry) {
        const lastEntryDate = new Date(latestEntry.date);
        const nextDay = addDays(lastEntryDate, 1); // Set to the day after the last entry
        setEntryDate(format(nextDay, 'yyyy-MM-dd'));
      } else {
        setEntryDate(getTodayDate()); // No entries found, default to today
      }

      // Highlight the date field
      setHighlightDate(true);
      const highlightTimer = setTimeout(() => {
        setHighlightDate(false);
      }, 3000); // Highlight for 3 seconds

      // Show temporary hint toast
      toastIdRef.current = showInfo("Choose the date first", 5000);

      return () => {
        clearTimeout(highlightTimer);
        if (toastIdRef.current) {
          dismissToast(toastIdRef.current);
        }
      };
    };

    fetchLastEntryDate();
  }, []); // Run once on mount

  // Effect to check authentication status
  React.useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
    };

    checkUser();

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session?.user);
    });

    return () => {
      authListener?.unsubscribe();
    };
  }, []); // Empty dependency array to run once on mount and listen for changes

  // Load habits and app settings from Supabase on component mount
  React.useEffect(() => {
    const fetchInitialData = async () => {
      // Fetch habits
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('*')
        .order('created_at', { ascending: false });

      if (habitsError) {
        console.error("Error fetching habits for DailyEntries:", habitsError);
        showError("Failed to load habits for tracking.");
      } else {
        const mappedHabits = (habitsData || []).map(mapSupabaseHabitToHabit);
        setHabits(mappedHabits);
      }

      // Fetch app settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('app_settings')
        .select('*')
        .limit(1)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error("Error fetching app settings:", settingsError);
        showError("Failed to load app settings.");
      } else if (settingsData) {
        setAppSettings(settingsData as AppSettings); // Cast to new AppSettings interface
      }
    };
    fetchInitialData();
  }, []);

  // Effect to load journal entry, daily tracking, yearly progress, and weekly/monthly counts for selected date from Supabase
  React.useEffect(() => {
    const fetchDataForDate = async () => {
      if (!entryDate) {
        setJournalText("");
        setMoodEmoji("😊");
        setCurrentEntryId(null);
        setDailyTracking({});
        setYearlyProgress({});
        setYearlyOutOfControlMissCounts({});
        setWeeklyTrackingCounts({});
        setMonthlyTrackingCounts({});
        setCurrentWeekOffRecord(null); // Reset week off record
        setUsedWeekOffsCount(0); // Reset used week offs
        return;
      }

      const selectedDate = new Date(entryDate);
      const currentYear = selectedDate.getFullYear().toString();
      const currentWeekNumber = getISOWeek(selectedDate);

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

      // Fetch current week off record and total used week offs for the year
      const { data: weekOffsData, error: weekOffsError } = await supabase
        .from('weekly_offs')
        .select('*')
        .eq('year', currentYear);

      if (weekOffsError) {
        console.error("Error fetching weekly offs:", weekOffsError);
        showError("Failed to load weekly off data.");
        setCurrentWeekOffRecord(null);
        setUsedWeekOffsCount(0);
      } else {
        const currentWeekOff = weekOffsData.find(wo => wo.week_number === currentWeekNumber && wo.is_off);
        setCurrentWeekOffRecord(currentWeekOff || null);
        setUsedWeekOffsCount(weekOffsData.filter(wo => wo.is_off).length);
      }

      // --- Calculate Weekly and Monthly Tracking Counts ---
      const startOfCurrentWeek = format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'); // Monday start
      const endOfCurrentWeek = format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const startOfCurrentMonth = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
      const endOfCurrentMonth = format(endOfMonth(selectedDate), 'yyyy-MM-dd');

      // Fetch all tracking records for the current week
      const { data: weeklyRecords, error: weeklyError } = await supabase
        .from('daily_habit_tracking')
        .select('*')
        .gte('date', startOfCurrentWeek)
        .lte('date', endOfCurrentWeek);

      if (weeklyError) {
        console.error("Error fetching weekly tracking records:", weeklyError);
        showError("Failed to load weekly tracking data.");
      } else {
        const calculatedWeeklyCounts: { [hId: string]: { [tValue: string]: number } } = {};
        weeklyRecords.forEach(record => {
          if (!calculatedWeeklyCounts[record.habit_id]) {
            calculatedWeeklyCounts[record.habit_id] = {};
          }
          // Only count if not a "WEEK_OFF" entry
          if (!record.tracked_values.includes("WEEK_OFF")) {
            record.tracked_values.forEach(value => {
              calculatedWeeklyCounts[record.habit_id][value] = (calculatedWeeklyCounts[record.habit_id][value] || 0) + 1;
            });
          }
        });
        setWeeklyTrackingCounts(calculatedWeeklyCounts);
      }

      // Fetch all tracking records for the current month
      const { data: monthlyRecords, error: monthlyError } = await supabase
        .from('daily_habit_tracking')
        .select('*')
        .gte('date', startOfCurrentMonth)
        .lte('date', endOfCurrentMonth);

      if (monthlyError) {
        console.error("Error fetching monthly tracking records:", monthlyError);
        showError("Failed to load monthly tracking data.");
      } else {
        const calculatedMonthlyCounts: { [hId: string]: { [tValue: string]: number } } = {};
        monthlyRecords.forEach(record => {
          if (!calculatedMonthlyCounts[record.habit_id]) {
            calculatedMonthlyCounts[record.habit_id] = {};
          }
          // Only count if not a "WEEK_OFF" entry
          if (!record.tracked_values.includes("WEEK_OFF")) {
            record.tracked_values.forEach(value => {
              calculatedMonthlyCounts[record.habit_id][value] = (calculatedMonthlyCounts[record.habit_id][value] || 0) + 1;
            });
          }
        });
        setMonthlyTrackingCounts(calculatedMonthlyCounts);
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
    // If the current week is marked off, prevent individual habit tracking updates
    if (currentWeekOffRecord?.is_off) {
      showError("This week is marked as 'Week Off'. Individual habit tracking is disabled.");
      return;
    }

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
    // Re-fetch weekly/monthly counts after any update to ensure they are current
    const selectedDate = new Date(date);
    const startOfCurrentWeek = format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const endOfCurrentWeek = format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const startOfCurrentMonth = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
    const endOfCurrentMonth = format(endOfMonth(selectedDate), 'yyyy-MM-dd');

    const { data: weeklyRecords, error: weeklyError } = await supabase
      .from('daily_habit_tracking')
      .select('*')
      .gte('date', startOfCurrentWeek)
      .lte('date', endOfCurrentWeek);

    if (!weeklyError) {
      const calculatedWeeklyCounts: { [hId: string]: { [tValue: string]: number } } = {};
      weeklyRecords.forEach(record => {
        if (!calculatedWeeklyCounts[record.habit_id]) {
          calculatedWeeklyCounts[record.habit_id] = {};
        }
        if (!record.tracked_values.includes("WEEK_OFF")) { // Exclude "WEEK_OFF" from counts
          record.tracked_values.forEach(value => {
            calculatedWeeklyCounts[record.habit_id][value] = (calculatedWeeklyCounts[record.habit_id][value] || 0) + 1;
          });
        }
      });
      setWeeklyTrackingCounts(calculatedWeeklyCounts);
    }

    const { data: monthlyRecords, error: monthlyError } = await supabase
      .from('daily_habit_tracking')
      .select('*')
      .gte('date', startOfCurrentMonth)
      .lte('date', endOfCurrentMonth);

    if (!monthlyError) {
      const calculatedMonthlyCounts: { [hId: string]: { [tValue: string]: number } } = {};
      monthlyRecords.forEach(record => {
        if (!calculatedMonthlyCounts[record.habit_id]) {
          calculatedMonthlyCounts[record.habit_id] = {};
        }
        if (!record.tracked_values.includes("WEEK_OFF")) { // Exclude "WEEK_OFF" from counts
          record.tracked_values.forEach(value => {
            calculatedMonthlyCounts[record.habit_id][value] = (calculatedMonthlyCounts[record.habit_id][value] || 0) + 1;
          });
        }
      });
      setMonthlyTrackingCounts(calculatedMonthlyCounts);
    }
  };

  const handleToggleWeekOff = async (checked: boolean) => {
    if (!isAuthenticated) {
      showError("You must be logged in to mark a week off.");
      setIsWeekOffLoading(false); // Ensure loading state is reset
      return;
    }

    if (!entryDate || !isMonday(new Date(entryDate))) {
      showError("You can only mark a week off starting on a Monday.");
      return;
    }

    setIsWeekOffLoading(true);
    const selectedDate = new Date(entryDate);
    const currentYear = selectedDate.getFullYear().toString();
    const currentWeekNumber = getISOWeek(selectedDate);
    const startOfCurrentWeek = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const endOfCurrentWeek = endOfWeek(selectedDate, { weekStartsOn: 1 });
    const daysInWeek = eachDayOfInterval({ start: startOfCurrentWeek, end: endOfCurrentWeek });

    const allowedWeekOffs = appSettings?.settings_data?.yearly_week_offs_allowed || 0; // Access from settings_data

    if (checked) {
      // Mark week off
      if (usedWeekOffsCount >= allowedWeekOffs) {
        showError(`You have used all ${allowedWeekOffs} allowed yearly week offs.`);
        setIsWeekOffLoading(false);
        return;
      }

      // Insert/update weekly_offs record
      const { error: upsertWeekOffError } = await supabase
        .from('weekly_offs')
        .upsert({
          year: currentYear,
          week_number: currentWeekNumber,
          is_off: true,
        }, { onConflict: 'year,week_number' });

      if (upsertWeekOffError) {
        console.error("Error marking week off:", upsertWeekOffError);
        showError("Failed to mark week off.");
        setIsWeekOffLoading(false);
        return;
      }

      // Update daily_habit_tracking for all habits for all days in the week
      const trackingRecordsToUpsert = [];
      for (const day of daysInWeek) {
        const formattedDay = format(day, 'yyyy-MM-dd');
        for (const habit of habits) {
          trackingRecordsToUpsert.push({
            date: formattedDay,
            habit_id: habit.id,
            tracked_values: ["WEEK_OFF"],
            is_out_of_control_miss: false,
          });
        }
      }

      if (trackingRecordsToUpsert.length > 0) {
        const { error: upsertTrackingError } = await supabase
          .from('daily_habit_tracking')
          .upsert(trackingRecordsToUpsert, { onConflict: 'date,habit_id' });

        if (upsertTrackingError) {
          console.error("Error updating daily tracking for week off:", upsertTrackingError);
          showError("Failed to update habit tracking for week off.");
          setIsWeekOffLoading(false);
          return;
        }
      }

      showSuccess(`Week ${currentWeekNumber} marked as 'Week Off' for all habits!`);
      setCurrentWeekOffRecord({ id: 'temp', year: currentYear, week_number: currentWeekNumber, is_off: true, created_at: new Date().toISOString() });
      setUsedWeekOffsCount(prev => prev + 1);
      // Re-fetch data for the current date to reflect changes in habit cards
      fetchDataForDate();

    } else {
      // Unmark week off
      const { error: deleteWeekOffError } = await supabase
        .from('weekly_offs')
        .delete()
        .eq('year', currentYear)
        .eq('week_number', currentWeekNumber);

      if (deleteWeekOffError) {
        console.error("Error unmarking week off:", deleteWeekOffError);
        showError("Failed to unmark week off.");
        setIsWeekOffLoading(false);
        return;
      }

      // Delete all "WEEK_OFF" daily_habit_tracking records for this week
      const datesInWeek = daysInWeek.map(day => format(day, 'yyyy-MM-dd'));
      const { error: deleteTrackingError } = await supabase
        .from('daily_habit_tracking')
        .delete()
        .in('date', datesInWeek)
        .contains('tracked_values', ['WEEK_OFF']); // Only delete records explicitly marked "WEEK_OFF"

      if (deleteTrackingError) {
        console.error("Error deleting daily tracking for unmark week off:", deleteTrackingError);
        showError("Failed to clear habit tracking for unmarking week off.");
        setIsWeekOffLoading(false);
        return;
      }

      showSuccess(`Week ${currentWeekNumber} unmarked. Habit tracking is now active.`);
      setCurrentWeekOffRecord(null);
      setUsedWeekOffsCount(prev => Math.max(0, prev - 1));
      // Re-fetch data for the current date to reflect changes in habit cards
      fetchDataForDate();
    }
    setIsWeekOffLoading(false);
  };

  const handleSetupHabitClick = () => {
    setActiveTab("setup");
  };

  const isCurrentDateMonday = isMonday(new Date(entryDate));
  const remainingWeekOffs = (appSettings?.settings_data?.yearly_week_offs_allowed || 0) - usedWeekOffsCount; // Access from settings_data

  return (
    <div id="daily" className="tab-content text-center">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Daily Entries</h2>
      <p className="text-gray-600 mb-6">
        Select a date to begin your entry.
      </p>
      <div className="flex flex-col items-center justify-center mb-6">
        {isCurrentDateMonday && appSettings && (
          <div className="flex items-center justify-between w-full max-w-sm mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <label htmlFor="take-week-off-switch" className="flex-grow text-sm font-medium text-blue-800 text-left cursor-pointer">
              Take this week off
              <p className="text-xs text-blue-600">({remainingWeekOffs} / {appSettings.settings_data.yearly_week_offs_allowed} remaining this year)</p>
            </label>
            <Switch
              id="take-week-off-switch"
              checked={currentWeekOffRecord?.is_off || false}
              onCheckedChange={handleToggleWeekOff}
              disabled={isWeekOffLoading || (!currentWeekOffRecord?.is_off && remainingWeekOffs <= 0) || !isAuthenticated}
            />
          </div>
        )}

        <label htmlFor="entry-date" className="block text-sm font-medium text-gray-700 mb-2">Date</label>
        <input
          type="date"
          id="entry-date"
          className={cn(
            "mt-1 p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center", // Removed w-full max-w-sm
            highlightDate && "ring-4 ring-blue-300 transition-all duration-500 ease-out"
          )}
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

              // Determine if this specific day is part of a "week off"
              const isWeekOffForThisDay = initialTrackedValue === "WEEK_OFF";

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
                  weeklyTrackingCounts={weeklyTrackingCounts[habit.id] || {}}
                  monthlyTrackingCounts={monthlyTrackingCounts[habit.id] || {}}
                  isWeekOffForThisDay={isWeekOffForThisDay} // Pass the new prop
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