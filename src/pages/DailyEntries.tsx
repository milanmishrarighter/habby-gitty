"use client";

import React from "react";
import EmojiPicker from "@/components/EmojiPicker";
import DailyHabitTrackerCard, { TrackingState } from "@/components/DailyHabitTrackerCard";
import OverwriteConfirmationModal from "@/components/OverwriteConfirmationModal";
import { showSuccess, showError, showInfo, dismissToast } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Habit } from "@/types/habit";
import { YearlyOutOfControlMissCount, WeeklyOffRecord, YearlyNothingsCount } from "@/types/tracking";
import { supabase } from "@/lib/supabase";
import { mapSupabaseHabitToHabit } from "@/utils/habitUtils";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, addDays, isMonday, getISOWeek, eachDayOfInterval } from 'date-fns';
import { differenceInCalendarDays } from 'date-fns';
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { AppSettings } from "@/types/appSettings";
import { runConditionsForHabits } from "@/utils/conditionRunner";
import {
  DayType,
  DAY_TYPES,
  DAY_TYPE_LABELS,
  isHabitActiveOnDayType,
  isSentinelTracking,
  WEEK_OFF,
  TEMP_HOLD,
} from "@/utils/dayType";

interface DailyEntriesProps {
  setActiveTab: (tab: string) => void;
}

// Guard rail so a mis-typed "to" date can't try to render hundreds of habit rows.
const MAX_RANGE_DAYS = 31;

// In range mode only the last date carries the written entry. The other dates
// store this pointer instead of a duplicate of the same text.
const SUMMARY_POINTER_PREFIX = "Find a summarized entry for this date on ";
const summaryPointerText = (summaryDate: string) => `${SUMMARY_POINTER_PREFIX}${summaryDate}`;
const isSummaryPointer = (text: string | null | undefined) =>
  !!text && text.startsWith(SUMMARY_POINTER_PREFIX);

type DailyTrackingMap = { [date: string]: { [habitId: string]: TrackingState } };

const DailyEntries: React.FC<DailyEntriesProps> = ({ setActiveTab }) => {
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [entryDate, setEntryDate] = React.useState(getTodayDate());
  const [isRangeMode, setIsRangeMode] = React.useState(false);
  const [rangeEndDate, setRangeEndDate] = React.useState(getTodayDate());
  const [dayType, setDayType] = React.useState<DayType | null>(null);
  const [journalText, setJournalText] = React.useState("");
  const [moodEmoji, setMoodEmoji] = React.useState("");
  const [newLearningText, setNewLearningText] = React.useState("");
  const [miscTextTracking, setMiscTextTracking] = React.useState("");
  const [habits, setHabits] = React.useState<Habit[]>([]);
  const [dailyTracking, setDailyTracking] = React.useState<DailyTrackingMap>({});
  const [yearlyProgress, setYearlyProgress] = React.useState<{ [year: string]: { [habitId: string]: number } }>({});
  const [yearlyOutOfControlMissCounts, setYearlyOutOfControlMissCounts] = React.useState<{ [habitId: string]: YearlyOutOfControlMissCount }>({});
  const [entryIdsByDate, setEntryIdsByDate] = React.useState<{ [date: string]: string }>({});

  const [weeklyTrackingCounts, setWeeklyTrackingCounts] = React.useState<{ [habitId: string]: { [trackingValue: string]: number } }>({});
  const [monthlyTrackingCounts, setMonthlyTrackingCounts] = React.useState<{ [habitId: string]: { [trackingValue: string]: number } }>({});

  const [showOverwriteConfirmModal, setShowOverwriteConfirmModal] = React.useState(false);
  const [pendingOverwriteDates, setPendingOverwriteDates] = React.useState<string[]>([]);

  const [highlightDate, setHighlightDate] = React.useState(false);
  const toastIdRef = React.useRef<string | number | null>(null);

  // Week off feature
  const [appSettings, setAppSettings] = React.useState<AppSettings | null>(null);
  const [currentWeekOffRecord, setCurrentWeekOffRecord] = React.useState<WeeklyOffRecord | null>(null);
  const [usedWeekOffsCount, setUsedWeekOffsCount] = React.useState<number>(0);
  const [isWeekOffLoading, setIsWeekOffLoading] = React.useState(false);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  // "Nothing learned" feature
  const [yearlyNothingsCount, setYearlyNothingsCount] = React.useState<YearlyNothingsCount | null>(null);
  const [isNothingButtonLoading, setIsNothingButtonLoading] = React.useState(false);
  const [missedDaysGap, setMissedDaysGap] = React.useState<number>(0);
  const missedFineAppliedForDateRef = React.useRef<string | null>(null);

  // --- Derived: which dates this entry covers -------------------------------
  const rangeError = React.useMemo(() => {
    if (!isRangeMode || !entryDate || !rangeEndDate) return null;
    if (new Date(rangeEndDate) < new Date(entryDate)) {
      return "The 'to' date must be on or after the 'from' date.";
    }
    const days = differenceInCalendarDays(new Date(rangeEndDate), new Date(entryDate)) + 1;
    if (days > MAX_RANGE_DAYS) {
      return `A range can span at most ${MAX_RANGE_DAYS} days (this one is ${days}).`;
    }
    return null;
  }, [isRangeMode, entryDate, rangeEndDate]);

  const activeDates = React.useMemo(() => {
    if (!entryDate) return [];
    if (!isRangeMode || rangeError) return [entryDate];
    return eachDayOfInterval({ start: new Date(entryDate), end: new Date(rangeEndDate) })
      .map(d => format(d, 'yyyy-MM-dd'));
  }, [entryDate, rangeEndDate, isRangeMode, rangeError]);

  // A stable key so effects re-run only when the actual set of dates changes.
  const activeDatesKey = activeDates.join(',');

  // Deactivated habits are retired: never tracked on new entries, history kept.
  const activeHabits = React.useMemo(() => habits.filter(habit => !habit.isDeactivated), [habits]);
  const visibleHabits = React.useMemo(
    () => activeHabits.filter(habit => isHabitActiveOnDayType(habit.dayType, dayType)),
    [activeHabits, dayType],
  );
  const hiddenHabitsCount = activeHabits.length - visibleHabits.length;

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
        setEntryDate(getTodayDate());
      } else if (latestEntry) {
        const lastEntryDate = new Date(latestEntry.date);
        const nextDay = addDays(lastEntryDate, 1); // Set to the day after the last entry
        setEntryDate(format(nextDay, 'yyyy-MM-dd'));
      } else {
        setEntryDate(getTodayDate());
      }

      setHighlightDate(true);
      const highlightTimer = setTimeout(() => {
        setHighlightDate(false);
      }, 3000);

      toastIdRef.current = showInfo("Choose the date first", 5000);

      return () => {
        clearTimeout(highlightTimer);
        if (toastIdRef.current) {
          dismissToast(toastIdRef.current);
        }
      };
    };

    fetchLastEntryDate();
  }, []);

  // Keep the range end sane when the start date moves past it.
  React.useEffect(() => {
    if (!isRangeMode || !entryDate) return;
    if (!rangeEndDate || new Date(rangeEndDate) < new Date(entryDate)) {
      setRangeEndDate(entryDate);
    }
  }, [entryDate, isRangeMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute gap and possibly add missed-entry fine
  React.useEffect(() => {
    if (!entryDate) return;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const gap = differenceInCalendarDays(new Date(todayStr), new Date(entryDate));
    setMissedDaysGap(gap);
    // If gap >= 3 days, add a ₹500 weekly fine (once per loaded date)
    if (gap >= 3) {
      const uniqueKey = `${entryDate}:${todayStr}`;
      if (missedFineAppliedForDateRef.current !== uniqueKey) {
        (async () => {
          await maybeAddMissedEntryFine(entryDate, gap);
          missedFineAppliedForDateRef.current = uniqueKey;
        })();
      }
    }
  }, [entryDate]);

  // Effect to check authentication status
  React.useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
    };

    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session?.user);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  // Helper: find the next empty date between the day after the given date and today
  const findNextEmptyDate = React.useCallback(async (currentDateStr: string) => {
    const startDate = addDays(new Date(currentDateStr), 1);
    const today = new Date();
    const startStr = format(startDate, 'yyyy-MM-dd');
    const todayStr = format(today, 'yyyy-MM-dd');
    if (startDate > today) return todayStr;

    const { data, error } = await supabase
      .from('daily_entries')
      .select('date')
      .gte('date', startStr)
      .lte('date', todayStr);

    if (error) {
      console.error("Error scanning for next empty date:", error);
      return startStr;
    }

    const existingDates = new Set((data || []).map((r: { date: string }) => format(new Date(r.date), 'yyyy-MM-dd')));
    const allDays = eachDayOfInterval({ start: startDate, end: today });
    for (const d of allDays) {
      const dStr = format(d, 'yyyy-MM-dd');
      if (!existingDates.has(dStr)) {
        return dStr;
      }
    }
    return todayStr;
  }, []);

  // Helper: add a missed-entry fine (₹500) for the week of the loaded date
  const maybeAddMissedEntryFine = async (entryDateStr: string, gap: number) => {
    const entryDateObj = new Date(entryDateStr);
    const weekStart = startOfWeek(entryDateObj, { weekStartsOn: 1 });
    const periodKey = format(weekStart, "yyyy-'W'ww");
    const fineData = {
      period_key: periodKey,
      habit_id: "___system___", // special system fine
      fine_amount: 500,
      cause: `Daily entry for ${entryDateStr} is being recorded ${gap} days late (limit: 3 days).`,
      status: "unpaid",
      tracking_value: `ENTRY_MISS:${entryDateStr}:${gap}`, // unique per date to avoid duplicates
      condition_count: 3,
      actual_count: gap,
      type: "fine",
      entry_date: entryDateStr,
    };
    const { error } = await supabase
      .from('fines_status')
      .upsert(fineData, { onConflict: 'period_key,habit_id,tracking_value' });
    if (error) {
      console.error("Error adding missed-entry fine:", error);
    } else {
      showSuccess("₹500 fine recorded for missing daily entries beyond 3 days.");
    }
  };

  // Load habits and app settings from Supabase on component mount
  React.useEffect(() => {
    const fetchInitialData = async () => {
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('*')
        .order('created_at', { ascending: true });

      if (habitsError) {
        console.error("Error fetching habits for DailyEntries:", habitsError);
        showError("Failed to load habits for tracking.");
      } else {
        setHabits((habitsData || []).map(mapSupabaseHabitToHabit));
      }

      const { data: settingsData, error: settingsError } = await supabase
        .from('app_settings')
        .select('*')
        .limit(1)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error("Error fetching app settings:", settingsError);
        showError("Failed to load app settings.");
      } else if (settingsData) {
        setAppSettings(settingsData as AppSettings);
      }
    };
    fetchInitialData();
  }, []);

  // Recompute the weekly/monthly tracking counts around a given date.
  const refreshPeriodCounts = React.useCallback(async (referenceDate: string) => {
    const selectedDate = new Date(referenceDate);
    const ranges: [string, string, React.Dispatch<React.SetStateAction<{ [habitId: string]: { [trackingValue: string]: number } }>>][] = [
      [
        format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        setWeeklyTrackingCounts,
      ],
      [
        format(startOfMonth(selectedDate), 'yyyy-MM-dd'),
        format(endOfMonth(selectedDate), 'yyyy-MM-dd'),
        setMonthlyTrackingCounts,
      ],
    ];

    for (const [start, end, setter] of ranges) {
      const { data, error } = await supabase
        .from('daily_habit_tracking')
        .select('*')
        .gte('date', start)
        .lte('date', end);

      if (error) {
        console.error("Error fetching tracking records for period counts:", error);
        continue;
      }

      const counts: { [hId: string]: { [tValue: string]: number } } = {};
      (data || []).forEach(record => {
        if (!counts[record.habit_id]) counts[record.habit_id] = {};
        // Week offs and temporary holds are deliberate skips — never counted.
        if (!isSentinelTracking(record.tracked_values)) {
          record.tracked_values.forEach((value: string) => {
            counts[record.habit_id][value] = (counts[record.habit_id][value] || 0) + 1;
          });
        }
      });
      setter(counts);
    }
  }, []);

  // Load entries, tracking and yearly figures for every date currently in play.
  const fetchDataForDates = React.useCallback(async () => {
    if (activeDates.length === 0) {
      setJournalText("");
      setMoodEmoji("");
      setNewLearningText("");
      setMiscTextTracking("");
      setEntryIdsByDate({});
      setDailyTracking({});
      setYearlyProgress({});
      setYearlyOutOfControlMissCounts({});
      setWeeklyTrackingCounts({});
      setMonthlyTrackingCounts({});
      setCurrentWeekOffRecord(null);
      setUsedWeekOffsCount(0);
      setYearlyNothingsCount(null);
      return;
    }

    const firstDate = activeDates[0];
    const lastDate = activeDates[activeDates.length - 1];
    const selectedDate = new Date(firstDate);
    const currentYear = selectedDate.getFullYear().toString();
    const currentWeekNumber = getISOWeek(selectedDate);
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch daily entries across the active dates
    const { data: entriesData, error: entriesError } = await supabase
      .from('daily_entries')
      .select('*')
      .in('date', activeDates);

    if (entriesError) {
      console.error("Error fetching daily entries:", entriesError);
      showError("Failed to load daily entry.");
      setJournalText("");
      setMoodEmoji("");
      setNewLearningText("");
      setMiscTextTracking("");
      setEntryIdsByDate({});
    } else {
      const ids: { [date: string]: string } = {};
      (entriesData || []).forEach(row => {
        ids[format(new Date(row.date), 'yyyy-MM-dd')] = row.id;
      });
      setEntryIdsByDate(ids);

      // The written entry lives on the last date of the span, so prefill from
      // there and fall back to the latest entry that isn't just a pointer.
      const sorted = (entriesData || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
      const existing =
        sorted.find(row => format(new Date(row.date), 'yyyy-MM-dd') === lastDate) ||
        sorted.find(row => !isSummaryPointer(row.text)) ||
        sorted[0];
      if (existing) {
        setJournalText(isSummaryPointer(existing.text) ? "" : (existing.text || ""));
        setMoodEmoji(existing.mood || "");
        setNewLearningText(isSummaryPointer(existing.new_learning_text) ? "" : (existing.new_learning_text || ""));
        setMiscTextTracking(isSummaryPointer(existing.misc_text_tracking) ? "" : (existing.misc_text_tracking || ""));
        setDayType((existing.day_type as DayType) || null);
      } else {
        setJournalText("");
        setMoodEmoji("");
        setNewLearningText("");
        setMiscTextTracking("");
        setDayType(null);
      }
    }

    // Fetch daily habit tracking for the active dates
    const { data: trackingData, error: trackingError } = await supabase
      .from('daily_habit_tracking')
      .select('*')
      .in('date', activeDates);

    if (trackingError) {
      console.error("Error fetching daily tracking:", trackingError);
      showError("Failed to load daily habit tracking.");
      setDailyTracking({});
    } else {
      const newDailyTracking: DailyTrackingMap = {};
      activeDates.forEach(date => { newDailyTracking[date] = {}; });
      (trackingData || []).forEach(record => {
        const date = format(new Date(record.date), 'yyyy-MM-dd');
        if (!newDailyTracking[date]) newDailyTracking[date] = {};
        newDailyTracking[date][record.habit_id] = {
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

    // Fetch yearly nothings count for the current year and user
    if (user) {
      const { data: nothingsCountData, error: nothingsCountError } = await supabase
        .from('yearly_nothings_counts')
        .select('*')
        .eq('user_id', user.id)
        .eq('year', currentYear)
        .single();

      if (nothingsCountError && nothingsCountError.code !== 'PGRST116') {
        console.error("Error fetching yearly nothings count:", nothingsCountError);
        showError("Failed to load yearly 'nothing' count.");
        setYearlyNothingsCount(null);
      } else if (nothingsCountData) {
        setYearlyNothingsCount(nothingsCountData as YearlyNothingsCount);
      } else {
        setYearlyNothingsCount(null);
      }
    }

    await refreshPeriodCounts(lastDate);
  }, [activeDatesKey, refreshPeriodCounts]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    fetchDataForDates();
  }, [fetchDataForDates]);

  const saveEntry = async (overwrite: boolean = false) => {
    if (activeDates.length === 0 || !journalText.trim()) {
      showError("Please select a date and write your journal entry.");
      return;
    }
    if (rangeError) {
      showError(rangeError);
      return;
    }

    const missingFields: string[] = [];
    if (!dayType) missingFields.push("Day Type");
    if (!moodEmoji) missingFields.push("Mood of the Day");
    if (!newLearningText.trim()) missingFields.push("What's something new you learned today");
    if (!miscTextTracking.trim()) missingFields.push("Misc. text tracking");

    // Every visible habit needs a value, a miss, or a hold — on every date.
    const missingHabits: string[] = [];
    visibleHabits.forEach((habit) => {
      const untrackedDates = activeDates.filter(date => {
        const record = dailyTracking[date]?.[habit.id];
        const hasValue = !!record && Array.isArray(record.trackedValues) && record.trackedValues.length > 0;
        const isMissMarked = !!record && record.isOutOfControlMiss === true;
        return !hasValue && !isMissMarked;
      });
      if (untrackedDates.length > 0) {
        missingHabits.push(
          activeDates.length > 1 ? `${habit.name} (${untrackedDates.length} days)` : habit.name
        );
      }
    });

    if (missingFields.length > 0 || missingHabits.length > 0) {
      const fieldMsg = missingFields.length > 0 ? `Missing fields: ${missingFields.join(", ")}` : "";
      const habitMsg = missingHabits.length > 0 ? `Untracked habits: ${missingHabits.join(", ")}` : "";
      const divider = fieldMsg && habitMsg ? " | " : "";
      showError(`${fieldMsg}${divider}${habitMsg}`.trim());
      return;
    }

    const currentYear = new Date(activeDates[0]).getFullYear().toString();
    const yearlyNothingsAllowed = appSettings?.settings_data?.yearly_nothings_allowed || 0;
    const currentNothingsCount = yearlyNothingsCount?.count || 0;

    if (newLearningText.toLowerCase() === 'nothing' && currentNothingsCount >= yearlyNothingsAllowed && yearlyNothingsAllowed > 0) {
      showError(`You have used all ${yearlyNothingsAllowed} allowed "nothing" entries for new learning this year. Please enter something new.`);
      return;
    }

    const existingDates = activeDates.filter(date => entryIdsByDate[date]);
    if (existingDates.length > 0 && !overwrite) {
      setPendingOverwriteDates(existingDates);
      setShowOverwriteConfirmModal(true);
      return;
    }

    // In range mode the written entry belongs to the last date only. Every
    // earlier date gets a pointer to it instead of a duplicated copy.
    const summaryDate = activeDates[activeDates.length - 1];
    const pointerText = summaryPointerText(summaryDate);
    const timestamp = new Date().toISOString();

    const fieldsForDate = (date: string) => {
      const isSummaryDate = date === summaryDate;
      return {
        text: isSummaryDate ? journalText.trim() : pointerText,
        mood: moodEmoji,
        new_learning_text: isSummaryDate ? (newLearningText.trim() || null) : pointerText,
        misc_text_tracking: isSummaryDate ? (miscTextTracking.trim() || null) : pointerText,
        day_type: dayType,
        timestamp,
      };
    };

    const newIds: { [date: string]: string } = { ...entryIdsByDate };
    for (const date of activeDates) {
      const existingId = entryIdsByDate[date];
      if (existingId) {
        const { error } = await supabase
          .from('daily_entries')
          .update(fieldsForDate(date))
          .eq('id', existingId);
        if (error) {
          console.error("Error updating daily entry:", error);
          showError(`Failed to save the entry for ${date}.`);
          return;
        }
      } else {
        const { data, error } = await supabase
          .from('daily_entries')
          .insert([{ date, ...fieldsForDate(date) }])
          .select();
        if (error) {
          console.error("Error saving daily entry:", error);
          showError(`Failed to save the entry for ${date}.`);
          return;
        }
        if (data && data.length > 0) {
          newIds[date] = data[0].id;
        }
      }
    }

    setEntryIdsByDate(newIds);
    showSuccess(activeDates.length > 1 ? `Saved ${activeDates.length} daily entries!` : "Daily entry saved!");

    // Now that the day's tracking is final, evaluate each habit's conditions.
    // This records any fines/rewards and emails the accountability contacts.
    const outcomes = await runConditionsForHabits(activeHabits, activeDates);
    const fines = outcomes.filter(o => o.outcome === 'fine');
    const rewards = outcomes.filter(o => o.outcome === 'reward');
    if (rewards.length > 0) {
      showSuccess(`${rewards.length} reward${rewards.length === 1 ? '' : 's'} added to Fines & Rewards.`);
    }
    if (fines.length > 0) {
      const emailed = fines.flatMap(f => f.emailedTo);
      showError(
        `${fines.length} fine${fines.length === 1 ? '' : 's'} recorded.` +
        (emailed.length > 0 ? ` Accountability email sent to ${[...new Set(emailed)].join(', ')}.` : '')
      );
    }
    setShowOverwriteConfirmModal(false);
    setPendingOverwriteDates([]);
    window.scrollTo({ top: 0, behavior: "smooth" });

    // After a short delay, jump to the next empty date automatically
    setTimeout(async () => {
      const nextEmpty = await findNextEmptyDate(summaryDate);
      if (nextEmpty && nextEmpty !== entryDate) {
        setIsRangeMode(false);
        setEntryDate(nextEmpty);
        setRangeEndDate(nextEmpty);
        showInfo(`Moving to next empty date: ${nextEmpty}`);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 1200);
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
    if (currentWeekOffRecord?.is_off) {
      showError("This week is marked as 'Week Off'. Individual habit tracking is disabled.");
      return;
    }

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
    const { error: yearlyProgressError } = await supabase
      .from('yearly_habit_progress')
      .upsert({ year: currentYear, habit_id: habitId, progress_count: newYearlyProgress }, { onConflict: 'year,habit_id' });

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

    const { data: missCountUpsertData, error: missCountError } = await supabase
      .from('yearly_out_of_control_miss_counts')
      .upsert({ habit_id: habitId, year: currentYear, used_count: updatedUsedCount }, { onConflict: 'habit_id,year' })
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

    await refreshPeriodCounts(date);
  };

  const handleToggleTemporaryHold = async (habit: Habit, dates: string[], hold: boolean) => {
    if (currentWeekOffRecord?.is_off) {
      showError("This week is marked as 'Week Off'. Individual habit tracking is disabled.");
      return;
    }
    if (!habit.allowTemporaryHold) {
      showError(`'${habit.name}' is not allowed to be put on temporary hold.`);
      return;
    }

    const contributingValues = habit.yearlyGoal?.contributingValues || [];
    const currentYear = new Date(dates[0]).getFullYear().toString();
    let newYearlyProgress = yearlyProgress[currentYear]?.[habit.id] || 0;
    let missCount = yearlyOutOfControlMissCounts[habit.id]?.used_count || 0;

    const records = dates.map(date => {
      const existing = dailyTracking[date]?.[habit.id];
      if (hold) {
        // Holding drops whatever was tracked for that day, so undo its side effects.
        const previousValue = existing?.trackedValues?.[0];
        if (previousValue && contributingValues.includes(previousValue)) {
          newYearlyProgress = Math.max(0, newYearlyProgress - 1);
        }
        if (existing?.isOutOfControlMiss) {
          missCount = Math.max(0, missCount - 1);
        }
      }
      return {
        date,
        habit_id: habit.id,
        tracked_values: hold ? [TEMP_HOLD] : [],
        is_out_of_control_miss: false,
      };
    });

    const { error } = await supabase
      .from('daily_habit_tracking')
      .upsert(records, { onConflict: 'date,habit_id' });

    if (error) {
      console.error("Error updating temporary hold:", error);
      showError("Failed to update the temporary hold.");
      return;
    }

    setDailyTracking(prev => {
      const next = { ...prev };
      dates.forEach(date => {
        next[date] = {
          ...(next[date] || {}),
          [habit.id]: { trackedValues: hold ? [TEMP_HOLD] : [], isOutOfControlMiss: false },
        };
      });
      return next;
    });

    if (hold) {
      const { error: progressError } = await supabase
        .from('yearly_habit_progress')
        .upsert({ year: currentYear, habit_id: habit.id, progress_count: newYearlyProgress }, { onConflict: 'year,habit_id' });
      if (progressError) {
        console.error("Error rolling back yearly progress for hold:", progressError);
      } else {
        setYearlyProgress(prev => ({
          ...prev,
          [currentYear]: { ...(prev[currentYear] || {}), [habit.id]: newYearlyProgress },
        }));
      }

      const { data: missData, error: missError } = await supabase
        .from('yearly_out_of_control_miss_counts')
        .upsert({ habit_id: habit.id, year: currentYear, used_count: missCount }, { onConflict: 'habit_id,year' })
        .select();
      if (missError) {
        console.error("Error rolling back miss count for hold:", missError);
      } else if (missData && missData.length > 0) {
        setYearlyOutOfControlMissCounts(prev => ({ ...prev, [habit.id]: missData[0] }));
      }
    }

    await refreshPeriodCounts(dates[dates.length - 1]);
    showSuccess(
      hold
        ? `'${habit.name}' put on temporary hold for ${dates.length > 1 ? `${dates.length} days` : dates[0]}.`
        : `Temporary hold released for '${habit.name}'.`
    );
  };

  const handleToggleWeekOff = async (checked: boolean) => {
    if (!isAuthenticated) {
      showError("You must be logged in to mark a week off.");
      setIsWeekOffLoading(false);
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

    const allowedWeekOffs = appSettings?.settings_data?.yearly_week_offs_allowed || 0;

    if (checked) {
      if (usedWeekOffsCount >= allowedWeekOffs) {
        showError(`You have used all ${allowedWeekOffs} allowed yearly week offs.`);
        setIsWeekOffLoading(false);
        return;
      }

      const { error: upsertWeekOffError } = await supabase
        .from('weekly_offs')
        .upsert({ year: currentYear, week_number: currentWeekNumber, is_off: true }, { onConflict: 'year,week_number' });

      if (upsertWeekOffError) {
        console.error("Error marking week off:", upsertWeekOffError);
        showError("Failed to mark week off.");
        setIsWeekOffLoading(false);
        return;
      }

      const trackingRecordsToUpsert = [];
      const newDailyTrackingForWeek: DailyTrackingMap = {};

      for (const day of daysInWeek) {
        const formattedDay = format(day, 'yyyy-MM-dd');
        newDailyTrackingForWeek[formattedDay] = {};
        for (const habit of activeHabits) {
          trackingRecordsToUpsert.push({
            date: formattedDay,
            habit_id: habit.id,
            tracked_values: [WEEK_OFF],
            is_out_of_control_miss: false,
          });
          newDailyTrackingForWeek[formattedDay][habit.id] = {
            trackedValues: [WEEK_OFF],
            isOutOfControlMiss: false,
          };
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

      setDailyTracking(prev => ({ ...prev, ...newDailyTrackingForWeek }));
      fetchDataForDates();
    } else {
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

      const datesInWeek = daysInWeek.map(day => format(day, 'yyyy-MM-dd'));
      const { error: deleteTrackingError } = await supabase
        .from('daily_habit_tracking')
        .delete()
        .in('date', datesInWeek)
        .contains('tracked_values', [WEEK_OFF]);

      if (deleteTrackingError) {
        console.error("Error deleting daily tracking for unmark week off:", deleteTrackingError);
        showError("Failed to clear habit tracking for unmarking week off.");
        setIsWeekOffLoading(false);
        return;
      }

      showSuccess(`Week ${currentWeekNumber} unmarked. Habit tracking is now active.`);
      setCurrentWeekOffRecord(null);
      setUsedWeekOffsCount(prev => Math.max(0, prev - 1));

      setDailyTracking(prev => {
        const updatedPrev = { ...prev };
        for (const day of daysInWeek) {
          const formattedDay = format(day, 'yyyy-MM-dd');
          if (updatedPrev[formattedDay]) {
            for (const habit of activeHabits) {
              if (updatedPrev[formattedDay][habit.id]?.trackedValues.includes(WEEK_OFF)) {
                updatedPrev[formattedDay][habit.id] = { trackedValues: [], isOutOfControlMiss: false };
              }
            }
          }
        }
        return updatedPrev;
      });
      fetchDataForDates();
    }
    setIsWeekOffLoading(false);
  };

  const handleNothingLearned = async () => {
    if (!isAuthenticated) {
      showError("You must be logged in to record 'nothing'.");
      return;
    }
    if (!entryDate) {
      showError("Please select a date first.");
      return;
    }

    setIsNothingButtonLoading(true);
    const currentYear = new Date(entryDate).getFullYear().toString();
    const yearlyNothingsAllowed = appSettings?.settings_data?.yearly_nothings_allowed || 0;
    const currentNothingsCount = yearlyNothingsCount?.count || 0;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      showError("User not authenticated.");
      setIsNothingButtonLoading(false);
      return;
    }

    if (currentNothingsCount >= yearlyNothingsAllowed && yearlyNothingsAllowed > 0) {
      showError(`You have used all ${yearlyNothingsAllowed} allowed "nothing" entries for new learning this year.`);
      setIsNothingButtonLoading(false);
      return;
    }

    if (newLearningText.toLowerCase() === 'nothing') {
      setNewLearningText("");
      if (yearlyNothingsCount) {
        const newCount = Math.max(0, yearlyNothingsCount.count - 1);
        const { error: updateError } = await supabase
          .from('yearly_nothings_counts')
          .update({ count: newCount })
          .eq('id', yearlyNothingsCount.id);
        if (updateError) console.error("Error decrementing nothing count:", updateError);
        setYearlyNothingsCount(prev => prev ? { ...prev, count: newCount } : null);
      }
      showSuccess("Cleared 'nothing' entry.");
    } else {
      setNewLearningText("nothing");
      const newCount = (yearlyNothingsCount?.count || 0) + 1;
      const { data: upsertData, error: upsertError } = await supabase
        .from('yearly_nothings_counts')
        .upsert({ user_id: user.id, year: currentYear, count: newCount }, { onConflict: 'user_id,year' })
        .select();

      if (upsertError) {
        console.error("Error updating yearly nothings count:", upsertError);
        showError("Failed to update 'nothing' count.");
      } else if (upsertData && upsertData.length > 0) {
        setYearlyNothingsCount(upsertData[0] as YearlyNothingsCount);
        showSuccess(`Recorded "nothing" for today. ${yearlyNothingsAllowed - newCount} remaining.`);
      }
    }
    setIsNothingButtonLoading(false);
  };

  const handleSetupHabitClick = () => {
    setActiveTab("setup");
  };

  const isCurrentDateMonday = isMonday(new Date(entryDate));
  const remainingWeekOffs = (appSettings?.settings_data?.yearly_week_offs_allowed || 0) - usedWeekOffsCount;
  const yearlyNothingsAllowed = appSettings?.settings_data?.yearly_nothings_allowed || 0;
  const currentNothingsCount = yearlyNothingsCount?.count || 0;
  const remainingNothings = yearlyNothingsAllowed - currentNothingsCount;

  const isNothingButtonDisabled = isNothingButtonLoading || !isAuthenticated || (newLearningText.toLowerCase() !== 'nothing' && remainingNothings <= 0 && yearlyNothingsAllowed > 0);

  const currentYearForDisplay = activeDates.length > 0
    ? new Date(activeDates[0]).getFullYear().toString()
    : new Date().getFullYear().toString();

  return (
    <div id="daily" className="tab-content text-center">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Daily Entries</h2>
      <p className="text-gray-600 mb-6">
        Pick the kind of day, then the date, to begin your entry.
      </p>

      {/* Day Type Selector */}
      <div className="flex flex-col items-center justify-center mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">How was the day?</label>
        <div className="flex flex-wrap justify-center gap-2">
          {DAY_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setDayType(dayType === type ? null : type)}
              className={cn(
                "px-5 py-2 rounded-full border-2 font-semibold transition-colors duration-200",
                dayType === type
                  ? "bg-blue-600 border-blue-600 text-white shadow"
                  : "bg-white border-gray-300 text-gray-700 hover:bg-gray-100"
              )}
            >
              {DAY_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
        {dayType && hiddenHabitsCount > 0 && (
          <p className="mt-2 text-xs text-gray-500">
            {hiddenHabitsCount} habit{hiddenHabitsCount === 1 ? "" : "s"} hidden — not required on a {DAY_TYPE_LABELS[dayType].toLowerCase()}.
          </p>
        )}
      </div>

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

        <div className="flex flex-wrap items-end justify-center gap-4">
          <div className="flex flex-col items-center">
            <label htmlFor="entry-date" className="block text-sm font-medium text-gray-700 mb-2">
              {isRangeMode ? "From" : "Date"}
            </label>
            <input
              type="date"
              id="entry-date"
              className={cn(
                "mt-1 p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center",
                highlightDate && "ring-4 ring-blue-300 transition-all duration-500 ease-out"
              )}
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
            />
          </div>

          {isRangeMode && (
            <div className="flex flex-col items-center">
              <label htmlFor="entry-date-to" className="block text-sm font-medium text-gray-700 mb-2">To</label>
              <input
                type="date"
                id="entry-date-to"
                className="mt-1 p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
                value={rangeEndDate}
                min={entryDate}
                onChange={(e) => setRangeEndDate(e.target.value)}
              />
            </div>
          )}

          <label htmlFor="range-mode" className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer pb-3">
            <input
              type="checkbox"
              id="range-mode"
              className="form-checkbox rounded text-blue-600 focus:ring-blue-500 focus:ring-2 h-4 w-4"
              checked={isRangeMode}
              onChange={(e) => {
                setIsRangeMode(e.target.checked);
                if (e.target.checked) setRangeEndDate(entryDate);
              }}
            />
            Enter for date range
          </label>
        </div>

        {rangeError && (
          <div className="mt-3 w-full max-w-sm p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
            {rangeError}
          </div>
        )}

        {isRangeMode && !rangeError && activeDates.length > 1 && (
          <div className="mt-3 w-full max-w-md p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
            Your written entry is saved on <strong>{activeDates[activeDates.length - 1]}</strong> only — the other {activeDates.length - 1} date{activeDates.length - 1 === 1 ? "" : "s"} just point to it. Habits below are tracked separately for every day.
          </div>
        )}

        {missedDaysGap === 2 && (
          <div className="mt-2 w-full max-w-sm p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
            Heads up: If you miss entering tomorrow, a ₹500 fine will be applied.
          </div>
        )}
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
      {/* New Learning Text Field */}
      <div className="flex flex-col items-center justify-center mb-6 w-full">
        <label htmlFor="new-learning-text" className="block text-sm font-medium text-gray-700 mb-2">What's something new you learned today?</label>
        <textarea
          id="new-learning-text"
          rows={4}
          className="mt-1 p-4 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full resize-y"
          placeholder="Enter your new learning here..."
          value={newLearningText}
          onChange={(e) => setNewLearningText(e.target.value)}
        ></textarea>
        <Button
          variant="outline"
          className="mt-2 w-full max-w-sm"
          onClick={handleNothingLearned}
          disabled={isNothingButtonDisabled}
        >
          {newLearningText.toLowerCase() === 'nothing' ? "Clear 'Nothing'" : "Nothing"}
          {yearlyNothingsAllowed > 0 && (
            <span className="ml-2 text-xs text-gray-500">({remainingNothings} / {yearlyNothingsAllowed} remaining)</span>
          )}
        </Button>
      </div>
      {/* Misc. Text Tracking Field */}
      <div className="flex flex-col items-center justify-center mb-6 w-full">
        <label htmlFor="misc-text-tracking" className="block text-sm font-medium text-gray-700 mb-2">Misc. text tracking</label>
        <textarea
          id="misc-text-tracking"
          rows={4}
          className="mt-1 p-4 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full resize-y"
          placeholder="Enter any additional notes..."
          value={miscTextTracking}
          onChange={(e) => setMiscTextTracking(e.target.value)}
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
        {activeHabits.length === 0 ? (
          <div className="dotted-border-container">
            <p className="text-lg mb-2">No habits added yet.</p>
            <button
              onClick={handleSetupHabitClick}
              className="text-blue-500 hover:text-blue-700 underline font-semibold"
            >
              Click here to setup a new habit
            </button>
          </div>
        ) : visibleHabits.length === 0 ? (
          <div className="dotted-border-container">
            <p className="text-lg">No habits are required on a {dayType ? DAY_TYPE_LABELS[dayType].toLowerCase() : "day"}.</p>
          </div>
        ) : (
          <div className={cn(
            "grid gap-4",
            activeDates.length > 1
              ? "grid-cols-1 lg:grid-cols-2"
              : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
          )}>
            {visibleHabits.map((habit) => {
              const trackingByDate: { [date: string]: TrackingState | undefined } = {};
              activeDates.forEach(date => {
                trackingByDate[date] = dailyTracking[date]?.[habit.id];
              });

              return (
                <DailyHabitTrackerCard
                  key={habit.id}
                  habit={habit}
                  dates={activeDates}
                  trackingByDate={trackingByDate}
                  onUpdateTracking={handleUpdateTracking}
                  onToggleTemporaryHold={handleToggleTemporaryHold}
                  currentYearlyProgress={yearlyProgress[currentYearForDisplay]?.[habit.id] || 0}
                  yearlyOutOfControlMissCounts={yearlyOutOfControlMissCounts}
                  weeklyTrackingCounts={weeklyTrackingCounts[habit.id] || {}}
                  monthlyTrackingCounts={monthlyTrackingCounts[habit.id] || {}}
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
          {activeDates.length > 1 ? `Save Entry for ${activeDates.length} Days` : "Save Entry"}
        </button>
      </div>

      <OverwriteConfirmationModal
        isOpen={showOverwriteConfirmModal}
        onClose={() => setShowOverwriteConfirmModal(false)}
        onConfirm={handleConfirmOverwrite}
        itemToOverwriteName={
          pendingOverwriteDates.length > 1
            ? `the existing entries for ${pendingOverwriteDates.length} dates (${pendingOverwriteDates[0]} … ${pendingOverwriteDates[pendingOverwriteDates.length - 1]})`
            : pendingOverwriteDates.length === 1
              ? `the entry for ${pendingOverwriteDates[0]}`
              : "this entry"
        }
      />
    </div>
  );
};

export default DailyEntries;
