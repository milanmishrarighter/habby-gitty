"use client";

import React from "react";
import EmojiPicker from "@/components/EmojiPicker";
import DailyHabitTrackerCard, { TrackingState } from "@/components/DailyHabitTrackerCard";
import OverwriteConfirmationModal from "@/components/OverwriteConfirmationModal";
import { showSuccess, showError, showInfo, dismissToast } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Habit } from "@/types/habit";
import { YearlyOutOfControlMissCount } from "@/types/tracking";
import { supabase } from "@/lib/supabase";
import { mapSupabaseHabitToHabit } from "@/utils/habitUtils";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, addDays, eachDayOfInterval, parseISO } from 'date-fns';
import { differenceInCalendarDays } from 'date-fns';
import { cn } from "@/lib/utils";
import { AppSettings } from "@/types/appSettings";
import { runConditionsForHabits } from "@/utils/conditionRunner";
import HealthCard from "@/components/HealthCard";
import SaveProgressDialog, { SaveStep, RegisteredAmount } from "@/components/SaveProgressDialog";
import UpcomingReminders from "@/components/UpcomingReminders";
import SupabaseUsage from "@/components/SupabaseUsage";
import HolidayPanel from "@/components/HolidayPanel";
import {
  DailyHealthRecord, CalorieSettings, EMPTY_CALORIE_SETTINGS, emptyHealthRecord, mapSupabaseHealthRecord,
  MISSED_DAY_FINES, CHEAT_DAY_UNDER_REWARD, CHEAT_DAY_OVER_FINE, CHEAT_DAY_OVER_FREE_PER_MONTH, cheatDayMeal, missedDayMeal,
  DAILY_CALORIE_LIMIT_KCAL, DAILY_CALORIE_LIMIT_FINE, isOverDailyCalorieLimit,
} from "@/types/health";
import { readCalorieSettings, calorieTotals, calorieBandFor, summariseWeek, AllowanceUsage } from "@/utils/healthUtils";
import { isSentinelTracking, hasRealTrackedValue, WEEK_OFF, TEMP_HOLD } from "@/utils/trackingSentinels";
import { sendAlertEmail } from "@/utils/alertEmail";
import {
  HolidayRange, isHoliday, readHolidayRanges, readHolidaysAllowed, fetchHolidayRanges,
} from "@/utils/holidays";

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
  const [journalText, setJournalText] = React.useState("");
  const [moodEmoji, setMoodEmoji] = React.useState("");
  const [newLearningText, setNewLearningText] = React.useState("");
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

  const [appSettings, setAppSettings] = React.useState<AppSettings | null>(null);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  // Holidays: no fines are calculated on these dates. Null until loaded, so
  // nothing that depends on them (like the late-entry fine) runs too early.
  const [holidayRanges, setHolidayRanges] = React.useState<HolidayRange[] | null>(null);
  const [holidaysAllowed, setHolidaysAllowed] = React.useState(0);

  const [missedDaysGap, setMissedDaysGap] = React.useState<number>(0);
  const missedFineAppliedForDateRef = React.useRef<string | null>(null);

  // Save progress dialog
  const [isSaveDialogOpen, setIsSaveDialogOpen] = React.useState(false);
  const [saveSteps, setSaveSteps] = React.useState<SaveStep[]>([]);
  const [saveFinished, setSaveFinished] = React.useState(false);
  const [saveSucceeded, setSaveSucceeded] = React.useState(false);
  const [saveSummary, setSaveSummary] = React.useState<RegisteredAmount[]>([]);
  // The last date written by a successful save; where "next empty date" starts.
  const savedThroughDateRef = React.useRef<string | null>(null);

  // Health
  const [healthRecords, setHealthRecords] = React.useState<{ [date: string]: DailyHealthRecord }>({});
  const [calorieSettings, setCalorieSettings] = React.useState<CalorieSettings>(EMPTY_CALORIE_SETTINGS);
  const [weekUsage, setWeekUsage] = React.useState<AllowanceUsage>({ targetDays: 0, maintainingDays: 0 });

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

  const holidayDatesOnScreen = React.useMemo(
    () => activeDates.filter(date => isHoliday(holidayRanges || [], date)),
    [activeDatesKey, holidayRanges], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const isEntryDateHoliday = !!entryDate && isHoliday(holidayRanges || [], entryDate);

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
    // Wait for the holidays to load: a holiday is never fined for being late,
    // which is exactly when entries tend to pile up.
    if (holidayRanges === null || isHoliday(holidayRanges, entryDate)) return;
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
  }, [entryDate, holidayRanges]);

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
    // Keyed on the date alone: the gap grows every day, so keying on it would
    // charge again each day the same late date is opened.
    const trackingValue = `ENTRY_MISS:${entryDateStr}`;

    // Opening a date that already has an entry isn't recording it late.
    const { data: existingEntry } = await supabase
      .from('daily_entries')
      .select('id')
      .eq('date', entryDateStr)
      .maybeSingle();
    if (existingEntry) return;

    // habit_id is null for fines not tied to a habit, and nulls never match in
    // an ON CONFLICT, so check for the row explicitly rather than upserting.
    const { data: existingFine } = await supabase
      .from('fines_status')
      .select('id')
      .eq('tracking_value', trackingValue)
      .maybeSingle();
    if (existingFine) return;

    const fineData = {
      period_key: periodKey,
      habit_id: null,
      fine_amount: 500,
      cause: `Daily entry for ${entryDateStr} is being recorded ${gap} days late (limit: 3 days).`,
      status: "unpaid",
      tracking_value: trackingValue,
      condition_count: 3,
      actual_count: gap,
      type: "fine",
      entry_date: entryDateStr,
      is_auto: true,
    };
    const { error } = await supabase.from('fines_status').insert([fineData]);
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
        setCalorieSettings(readCalorieSettings(settingsData.settings_data));
      }
      // Loaded even when settings failed, so fines that wait on holidays still run.
      setHolidayRanges(readHolidayRanges(settingsData?.settings_data));
      setHolidaysAllowed(readHolidaysAllowed(settingsData?.settings_data));
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
      setEntryIdsByDate({});
      setDailyTracking({});
      setYearlyProgress({});
      setYearlyOutOfControlMissCounts({});
      setWeeklyTrackingCounts({});
      setMonthlyTrackingCounts({});
      return;
    }

    const firstDate = activeDates[0];
    const lastDate = activeDates[activeDates.length - 1];
    const currentYear = new Date(firstDate).getFullYear().toString();

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
      } else {
        setJournalText("");
        setMoodEmoji("");
        setNewLearningText("");
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

    // Health: load the record for the summary date, plus the surrounding week so
    // the target/maintaining allowances can be counted.
    const { data: healthRows, error: healthError } = await supabase
      .from('daily_health')
      .select('*')
      .gte('date', format(startOfWeek(new Date(firstDate), { weekStartsOn: 1 }), 'yyyy-MM-dd'))
      .lte('date', format(endOfWeek(new Date(lastDate), { weekStartsOn: 1 }), 'yyyy-MM-dd'));

    if (healthError) {
      console.error("Error fetching health records:", healthError);
      setHealthRecords(Object.fromEntries(activeDates.map(d => [d, emptyHealthRecord(d)])));
      setWeekUsage({ targetDays: 0, maintainingDays: 0 });
    } else {
      const mapped = (healthRows || []).map(mapSupabaseHealthRecord);
      const byDate: { [date: string]: DailyHealthRecord } = {};
      activeDates.forEach(date => {
        const existing = mapped.find(r => format(new Date(r.date), 'yyyy-MM-dd') === date);
        byDate[date] = existing ? { ...existing, date } : emptyHealthRecord(date);
      });
      setHealthRecords(byDate);
      // The day being edited is excluded — it is counted live from the form.
      // Dates being edited are excluded — they are counted live from the form.
      setWeekUsage(summariseWeek(
        mapped.filter(r => !activeDates.includes(format(new Date(r.date), 'yyyy-MM-dd'))),
        readCalorieSettings(appSettings?.settings_data),
      ));
    }

    await refreshPeriodCounts(lastDate);
  }, [activeDatesKey, refreshPeriodCounts, appSettings]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    fetchDataForDates();
  }, [fetchDataForDates]);

  const saveEntry = async (overwrite: boolean = false) => {
    if (activeDates.length === 0 || !journalText.trim()) {
      showError("Please select a date and write your journal entry.");
      scrollToProblem(activeDates.length === 0 ? "entry-date" : "journal-entry");
      return;
    }
    if (rangeError) {
      showError(rangeError);
      return;
    }

    const missingFields: string[] = [];
    // Ordered top-to-bottom so the first one is what we scroll to.
    const problems: { label: string; elementId: string }[] = [];
    const flagMissing = (label: string, elementId: string) => {
      missingFields.push(label);
      problems.push({ label, elementId });
    };

    if (!journalText.trim()) flagMissing("Journal Entry", "journal-entry");
    if (!moodEmoji) flagMissing("Mood of the Day", "mood-picker");

    // Every visible habit needs a value, a miss, or a hold — on every date,
    // holidays included: a holiday turns fines off, not tracking.
    const missingHabits: string[] = [];
    activeHabits.forEach((habit) => {
      const untrackedDates = activeDates.filter(date => {
        const record = dailyTracking[date]?.[habit.id];
        const values = record?.trackedValues;
        // A week off (from before holidays replaced them) or a temporary hold
        // counts as handled; a stale day-type skip marker does not.
        const isHandled = hasRealTrackedValue(values)
          || !!values?.includes(WEEK_OFF)
          || !!values?.includes(TEMP_HOLD);
        return !isHandled && record?.isOutOfControlMiss !== true;
      });
      if (untrackedDates.length > 0) {
        missingHabits.push(
          activeDates.length > 1 ? `${habit.name} (${untrackedDates.length} days)` : habit.name
        );
        problems.push({ label: habit.name, elementId: `habit-card-${habit.id}` });
      }
    });

    if (missingFields.length > 0 || missingHabits.length > 0) {
      const fieldMsg = missingFields.length > 0 ? `Missing fields: ${missingFields.join(", ")}` : "";
      const habitMsg = missingHabits.length > 0 ? `Untracked habits: ${missingHabits.join(", ")}` : "";
      const divider = fieldMsg && habitMsg ? " | " : "";
      showError(`${fieldMsg}${divider}${habitMsg}`.trim());
      scrollToProblem(problems[0]?.elementId);
      return;
    }

    const existingDates = activeDates.filter(date => entryIdsByDate[date]);
    if (existingDates.length > 0 && !overwrite) {
      setPendingOverwriteDates(existingDates);
      setShowOverwriteConfirmModal(true);
      return;
    }

    setShowOverwriteConfirmModal(false);
    setPendingOverwriteDates([]);
    await runSavePipeline();
  };

  // --- Save pipeline --------------------------------------------------------

  const SAVE_STEPS: { id: string; label: string }[] = [
    { id: "entry", label: "Saving journal entry" },
    { id: "health", label: "Saving health details" },
    { id: "learning", label: "Checking the learning reward" },
    { id: "conditions", label: "Checking habit conditions, fines, rewards and emails" },
  ];

  const updateSaveStep = (id: string, patch: Partial<SaveStep>) =>
    setSaveSteps(prev => prev.map(step => (step.id === id ? { ...step, ...patch } : step)));

  /**
   * Runs one step and records its outcome in the dialog. A failing step never
   * stops the ones after it — except the entry itself, which everything else
   * depends on. Returns false only when the step failed.
   */
  const runSaveStep = async (id: string, work: () => Promise<string | void>): Promise<boolean> => {
    updateSaveStep(id, { status: "running" });
    try {
      const detail = await work();
      updateSaveStep(id, { status: "done", detail: detail || undefined });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Save step '${id}' failed:`, err);
      updateSaveStep(id, { status: "error", detail: message });
      return false;
    }
  };

  const runSavePipeline = async () => {
    const summaryDate = activeDates[activeDates.length - 1];

    setSaveSteps(SAVE_STEPS.map(step => ({ ...step, status: "pending" as const })));
    setSaveSummary([]);
    setSaveFinished(false);
    setSaveSucceeded(false);
    setIsSaveDialogOpen(true);
    savedThroughDateRef.current = null;

    const entrySaved = await runSaveStep("entry", async () => {
      await saveJournalEntries(summaryDate);
      return activeDates.length > 1 ? `${activeDates.length} dates saved` : undefined;
    });

    if (!entrySaved) {
      // Nothing else can meaningfully run without the entry.
      SAVE_STEPS.filter(step => step.id !== "entry").forEach(step =>
        updateSaveStep(step.id, { status: "error", detail: "Skipped because the entry didn't save." })
      );
      setSaveFinished(true);
      return;
    }

    // Holidays are re-read here rather than trusted from state, because every
    // fine below depends on them.
    let holidays: HolidayRange[] = holidayRanges || [];
    try {
      holidays = await fetchHolidayRanges();
      setHolidayRanges(holidays);
    } catch (err) {
      console.error("Falling back to the holidays already loaded:", err);
    }

    await runSaveStep("health", async () => {
      const notes = await saveHealthForDates(holidays);
      return notes.length > 0 ? notes.join(' ') : undefined;
    });
    await runSaveStep("learning", async () => {
      const note = await syncLearningReward(summaryDate);
      return note ?? "No learning entered, so no reward";
    });
    await runSaveStep("conditions", async () => {
      const outcomes = await runConditionsForHabits(activeHabits, activeDates, holidays);
      const emailed = [...new Set(outcomes.flatMap(o => o.emailedTo))];
      const holidayCount = activeDates.filter(date => isHoliday(holidays, date)).length;
      const notes = [
        emailed.length > 0 ? `Email sent to ${emailed.join(', ')}` : '',
        holidayCount > 0 ? `${holidayCount} holiday day${holidayCount === 1 ? '' : 's'} — no fines for ${holidayCount === 1 ? 'it' : 'them'}.` : '',
      ].filter(Boolean);
      return notes.length > 0 ? notes.join(' ') : undefined;
    });

    savedThroughDateRef.current = summaryDate;
    setSaveSummary(await registeredAmountsFor(activeDates));
    setSaveSucceeded(true);
    setSaveFinished(true);
  };

  /**
   * Every fine and reward that belongs to these dates, read back from the
   * ledger once all saving is finished. Filtering on entry_date is what keeps
   * this to the entry being saved: a weekly condition books its result on the
   * week's last day, so it appears when saving that Sunday and not otherwise,
   * and the just-closed period judged alongside an early-month save carries its
   * own earlier date and is left out.
   */
  const registeredAmountsFor = async (dates: string[]): Promise<RegisteredAmount[]> => {
    const { data, error } = await supabase
      .from('fines_status')
      .select('type, fine_amount, cause, entry_date')
      .in('entry_date', dates)
      .order('entry_date', { ascending: true });

    if (error) {
      console.error("Error reading fines and rewards for the saved dates:", error);
      return [];
    }
    return (data || []).map((row: any) => ({
      type: row.type === 'reward' ? 'reward' : 'fine',
      amount: Number(row.fine_amount) || 0,
      description: row.cause,
      date: format(new Date(row.entry_date), 'yyyy-MM-dd'),
    }));
  };

  /** Pressing Done: back to the top, then on to the next date needing an entry. */
  const handleSaveDone = async () => {
    setIsSaveDialogOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });

    const savedThrough = savedThroughDateRef.current;
    if (!saveSucceeded || !savedThrough) return;

    const nextEmpty = await findNextEmptyDate(savedThrough);
    setIsRangeMode(false);
    setRangeEndDate(nextEmpty);
    setEntryDate(nextEmpty);
  };

  /** Writes the daily_entries rows. Throws if any date fails. */
  const saveJournalEntries = async (summaryDate: string) => {
    // In range mode the written entry belongs to the last date only. Every
    // earlier date gets a pointer to it instead of a duplicated copy.
    const pointerText = summaryPointerText(summaryDate);
    const timestamp = new Date().toISOString();

    const fieldsForDate = (date: string) => {
      const isSummaryDate = date === summaryDate;
      return {
        text: isSummaryDate ? journalText.trim() : pointerText,
        mood: moodEmoji,
        new_learning_text: isSummaryDate ? (newLearningText.trim() || null) : pointerText,
        // misc_text_tracking and day_type are retired. They are left out rather
        // than cleared, so whatever older entries hold is kept.
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
        if (error) throw new Error(`Couldn't save ${date}: ${error.message}`);
      } else {
        const { data, error } = await supabase
          .from('daily_entries')
          .insert([{ date, ...fieldsForDate(date) }])
          .select();
        if (error) throw new Error(`Couldn't save ${date}: ${error.message}`);
        if (data && data.length > 0) newIds[date] = data[0].id;
      }
    }
    setEntryIdsByDate(newIds);
  };

  /**
   * ₹100 for writing down something you learned. Keyed to the date the written
   * entry lives on, and withdrawn if the field is later cleared.
   */
  const syncLearningReward = async (summaryDate: string): Promise<string | null> => {
    const learned = newLearningText.trim();
    const amount = await syncAutoEntry({
      key: `AUTO:LEARNING:${summaryDate}`,
      date: summaryDate,
      applies: learned.length > 0,
      type: 'reward',
      amount: 100,
      cause: `Reward: recorded something new learned on ${summaryDate}.`,
    });
    return amount > 0 ? `₹${amount} reward for recording something you learned.` : null;
  };

  /** Brings the first thing blocking a save into view. */
  const scrollToProblem = (elementId?: string) => {
    if (!elementId) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const element = document.getElementById(elementId);
    if (!element) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    // A ring that fades, so it's obvious which field is being complained about.
    element.classList.add("ring-4", "ring-red-400", "rounded-lg");
    setTimeout(() => element.classList.remove("ring-4", "ring-red-400", "rounded-lg"), 2500);
  };

  /**
   * Writes the health record for every active date, then syncs the calorie
   * reward and the health fines. No health fine applies on a holiday.
   * Returns notes for the summary; throws on failure.
   */
  const saveHealthForDates = async (holidays: HolidayRange[]): Promise<string[]> => {
    const notes: string[] = [];
    const rows: any[] = [];
    for (const date of activeDates) {
      const record = healthRecords[date];
      if (!record) continue;
      const isBlank = record.meals.length === 0 && !record.weightChecked
        && !record.missedDay && !record.shittyDay && !record.isCheatDay;
      if (isBlank) continue;

      rows.push({
        date,
        // Missed days and cheat days are stored as one stand-in meal at a fixed
        // figure (missed: 2000/2500/3500, cheat: 3500/4250) so they count in totals.
        meals: record.missedDay
          ? [missedDayMeal(record.missedDayEating ?? 'good')]
          : record.isCheatDay
            ? [cheatDayMeal(record.cheatDayOutcome ?? 'under')]
            : record.meals,
        calories_burned: record.missedDay || record.isCheatDay ? 0 : record.caloriesBurned,
        is_cheat_day: record.missedDay ? false : record.isCheatDay,
        cheat_day_outcome: !record.missedDay && record.isCheatDay ? (record.cheatDayOutcome ?? 'under') : null,
        weight_checked: record.weightChecked,
        weight: record.weightChecked ? record.weight : null,
        shitty_day: record.shittyDay,
        missed_day: record.missedDay,
        missed_day_eating: record.missedDay ? (record.missedDayEating ?? 'good') : null,
        updated_at: new Date().toISOString(),
      });
    }

    if (rows.length > 0) {
      const { error } = await supabase.from('daily_health').upsert(rows, { onConflict: 'date' });
      if (error) throw new Error(error.message);
    }

    let rewardTotal = 0;
    let fineTotal = 0;
    let overLimitTotal = 0;
    const overLimitEmailed = new Set<string>();

    for (const date of activeDates) {
      const record = healthRecords[date];
      if (!record) continue;
      const onHoliday = isHoliday(holidays, date);

      const { average } = calorieTotals(record.meals, record.caloriesBurned);
      const band = calorieBandFor(average, calorieSettings);
      const earnedReward = !record.missedDay
        && record.meals.length > 0
        && !record.isCheatDay
        && band === 'target';
      rewardTotal += await syncAutoEntry({
        key: `AUTO:HEALTH:TARGET:${date}`,
        date,
        applies: earnedReward,
        type: 'reward',
        amount: 50,
        cause: `Reward: stayed at or under the ${calorieSettings.target} kcal target on ${date} (${Math.round(average)} kcal).`,
      });

      const grade = record.missedDayEating ?? 'good';
      const missedFine = record.missedDay ? MISSED_DAY_FINES[grade] : 0;
      fineTotal += await syncAutoEntry({
        key: `AUTO:HEALTH:MISSED:${date}`,
        date,
        applies: record.missedDay && missedFine > 0 && !onHoliday,
        type: 'fine',
        amount: missedFine,
        cause: `Fine: health tracking missed on ${date} — eating recorded as '${grade}'.`,
      });

      // Going over the daily limit on a normal day: a fine, and an email to
      // the accountability contacts from Settings.
      const overLimit = isOverDailyCalorieLimit(record, average) && !onHoliday;
      overLimitTotal += await syncAutoEntry({
        key: `AUTO:HEALTH:OVER_LIMIT:${date}`,
        date,
        applies: overLimit,
        type: 'fine',
        amount: DAILY_CALORIE_LIMIT_FINE,
        cause: `Fine: ate more than ${DAILY_CALORIE_LIMIT_KCAL} kcal on ${date} (${Math.round(average)} kcal).`,
      });
      if (overLimit) {
        const emailed = await emailOverLimit(date, average);
        emailed.forEach(email => overLimitEmailed.add(email));
      }
    }

    if (rewardTotal > 0) notes.push(`₹${rewardTotal} reward for hitting your calorie target.`);
    if (fineTotal > 0) notes.push(`₹${fineTotal} fine for missed health tracking.`);
    if (overLimitTotal > 0) notes.push(`₹${overLimitTotal} fine for going over ${DAILY_CALORIE_LIMIT_KCAL} kcal.`);
    if (overLimitEmailed.size > 0) notes.push(`Email sent to ${[...overLimitEmailed].join(', ')}.`);
    notes.push(...await syncCheatDayOutcomes(holidays));
    return notes;
  };

  /** Tells the accountability contacts about a day over the calorie limit, once per date. */
  const emailOverLimit = async (date: string, averageKcal: number): Promise<string[]> => {
    const recipients: string[] = Array.isArray(appSettings?.settings_data?.accountability_emails)
      ? appSettings!.settings_data.accountability_emails
      : [];
    const when = date === format(new Date(), 'yyyy-MM-dd')
      ? 'today'
      : `on ${format(parseISO(date), 'EEEE, d MMMM yyyy')}`;
    return sendAlertEmail({
      recipients,
      subject: `Milan ate more than ${DAILY_CALORIE_LIMIT_KCAL} calories ${when}`,
      body: `Milan ate more than ${DAILY_CALORIE_LIMIT_KCAL} calories ${when} (about ${Math.round(averageKcal)} kcal).\n`
        + `He owes you ${DAILY_CALORIE_LIMIT_FINE}₹.\n\n`
        + `Make sure he pays up. You are his assigned accountability partner!\n`,
      alertKey: `AUTO:HEALTH:OVER_LIMIT:${date}`,
      sourceId: 'HEALTH',
      periodKey: date,
    });
  };

  /**
   * Cheat day rewards and fines. Kept under the limit: a reward, every time.
   * Went over: free the first two times in a calendar month, then a fine for
   * each one after. The fine depends on the whole month, so the month is
   * re-ranked from the database and every date in it is re-synced — editing
   * an earlier date correctly shifts which later days are fined. A holiday
   * cheat day is never fined and doesn't use up one of the free ones.
   */
  const syncCheatDayOutcomes = async (holidays: HolidayRange[]): Promise<string[]> => {
    let rewardTotal = 0;
    let fineTotal = 0;

    for (const date of activeDates) {
      const record = healthRecords[date];
      const isUnder = !!record && !record.missedDay && record.isCheatDay
        && (record.cheatDayOutcome ?? 'under') === 'under';
      rewardTotal += await syncAutoEntry({
        key: `AUTO:HEALTH:CHEAT_UNDER:${date}`,
        date,
        applies: isUnder,
        type: 'reward',
        amount: CHEAT_DAY_UNDER_REWARD,
        cause: `Reward: cheat day on ${date} kept under 3500 kcal.`,
      });
    }

    const months = [...new Set(activeDates.map(date => date.slice(0, 7)))];
    for (const month of months) {
      const monthStart = `${month}-01`;
      const monthEnd = format(endOfMonth(new Date(monthStart)), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('daily_health')
        .select('date, is_cheat_day, missed_day, cheat_day_outcome')
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date', { ascending: true });
      if (error) throw new Error(error.message);

      const allOverDates = (data || [])
        .filter((row: any) => row.is_cheat_day && !row.missed_day && row.cheat_day_outcome === 'over')
        .map((row: any) => format(new Date(row.date), 'yyyy-MM-dd'));
      const overDates = allOverDates.filter(date => !isHoliday(holidays, date));
      const overSet = new Set(overDates);

      // Every date in the month that could hold a fine: the over days, plus
      // anything being saved now (which may have just stopped being one).
      const candidates = [...new Set([
        ...allOverDates,
        ...activeDates.filter(date => date.startsWith(month)),
      ])];

      for (const date of candidates) {
        const rank = overDates.indexOf(date) + 1; // 1-based; 0 when not an over day
        const fined = overSet.has(date) && rank > CHEAT_DAY_OVER_FREE_PER_MONTH;
        fineTotal += await syncAutoEntry({
          key: `AUTO:HEALTH:CHEAT_OVER:${date}`,
          date,
          applies: fined,
          type: 'fine',
          amount: CHEAT_DAY_OVER_FINE,
          cause: `Fine: cheat day on ${date} went over 3500 kcal — number ${rank} this month, `
            + `past the ${CHEAT_DAY_OVER_FREE_PER_MONTH} allowed.`,
        });
      }
    }

    const notes: string[] = [];
    if (rewardTotal > 0) notes.push(`₹${rewardTotal} reward for keeping a cheat day under 3500 kcal.`);
    if (fineTotal > 0) notes.push(`₹${fineTotal} fine for going over 3500 kcal on a cheat day more than twice this month.`);
    return notes;
  };

  /**
   * Creates, updates or withdraws one automatic fine/reward, keyed so it can
   * never be double-recorded. Returns the amount if it was newly recorded.
   */
  const syncAutoEntry = async (input: {
    key: string; date: string; applies: boolean;
    type: 'fine' | 'reward'; amount: number; cause: string;
  }): Promise<number> => {
    const { data: existing, error: readError } = await supabase
      .from('fines_status')
      .select('id')
      .eq('tracking_value', input.key)
      .maybeSingle();
    if (readError) throw new Error(readError.message);

    if (!input.applies) {
      if (existing) await supabase.from('fines_status').delete().eq('id', existing.id);
      return 0;
    }
    if (existing) {
      await supabase
        .from('fines_status')
        .update({ fine_amount: input.amount, cause: input.cause })
        .eq('id', existing.id);
      return 0; // Already recorded on a previous save.
    }

    const { error } = await supabase.from('fines_status').insert([{
      type: input.type,
      fine_amount: input.amount,
      cause: input.cause,
      habit_id: null,
      entry_date: input.date,
      status: 'unpaid',
      period_key: input.date,
      tracking_value: input.key,
      condition_count: 0,
      actual_count: 0,
      is_auto: true,
    }]);
    if (error) throw new Error(error.message);
    return input.amount;
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

  const handleSetupHabitClick = () => {
    setActiveTab("setup");
  };

  const currentYearForDisplay = activeDates.length > 0
    ? new Date(activeDates[0]).getFullYear().toString()
    : new Date().getFullYear().toString();

  return (
    <div id="daily" className="tab-content text-center">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Daily Entries</h2>
      <SupabaseUsage />
      <p className="text-gray-600 mb-6">
        Pick the date to begin your entry.
      </p>

      <div className="flex flex-col items-center justify-center mb-6">
        {holidayRanges !== null && (
          <HolidayPanel
            entryDates={activeDates}
            ranges={holidayRanges}
            allowedPerYear={holidaysAllowed}
            onRangesChange={setHolidayRanges}
            isAuthenticated={isAuthenticated}
          />
        )}

        <UpcomingReminders fromDate={activeDates[0] ?? entryDate} />

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

        {missedDaysGap === 2 && !isEntryDateHoliday && (
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
      </div>
      {/* Mood Emoji Picker */}
      <div className="flex flex-col items-center justify-center mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Mood of the Day</label>
        <div id="mood-picker">
          <EmojiPicker selectedEmoji={moodEmoji} onSelectEmoji={setMoodEmoji} />
        </div>
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
        ) : (
          <div className={cn(
            "grid gap-4",
            activeDates.length > 1
              ? "grid-cols-1 lg:grid-cols-2"
              : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
          )}>
            {activeHabits.map((habit) => {
              const trackingByDate: { [date: string]: TrackingState | undefined } = {};
              activeDates.forEach(date => {
                trackingByDate[date] = dailyTracking[date]?.[habit.id];
              });

              return (
                <div id={`habit-card-${habit.id}`} key={habit.id}>
                <DailyHabitTrackerCard
                  habit={habit}
                  dates={activeDates}
                  trackingByDate={trackingByDate}
                  onUpdateTracking={handleUpdateTracking}
                  onToggleTemporaryHold={handleToggleTemporaryHold}
                  currentYearlyProgress={yearlyProgress[currentYearForDisplay]?.[habit.id] || 0}
                  yearlyOutOfControlMissCounts={yearlyOutOfControlMissCounts}
                  weeklyTrackingCounts={weeklyTrackingCounts[habit.id] || {}}
                  monthlyTrackingCounts={monthlyTrackingCounts[habit.id] || {}}
                  holidayDates={holidayDatesOnScreen}
                />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Health — one card per date, same as the habits */}
      <div className="mt-8 pt-8 border-t border-gray-200 space-y-4">
        {activeDates.map((date) => (
          <HealthCard
            key={date}
            record={healthRecords[date] || emptyHealthRecord(date)}
            onChange={(updated) => setHealthRecords(prev => ({ ...prev, [date]: updated }))}
            settings={calorieSettings}
            weekUsage={weekUsage}
            dateLabel={activeDates.length > 1 ? format(new Date(date), 'EEE, d MMM') : undefined}
            onHoliday={holidayDatesOnScreen.includes(date)}
          />
        ))}
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

      <SaveProgressDialog
        open={isSaveDialogOpen}
        steps={saveSteps}
        finished={saveFinished}
        summary={saveSummary}
        dates={activeDates}
        onDone={handleSaveDone}
      />

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
