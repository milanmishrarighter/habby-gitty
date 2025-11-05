"use client";

import React from "react";
import { format, isAfter, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, addMonths, isSameWeek, isSameMonth, isBefore, addDays, subDays } from 'date-fns';
import { getWeeksInYear, getMonthsInYear } from "@/lib/date-utils";
import FineCard from "@/components/FineCard";
import { FineDetail, FinesPeriodData } from "@/types/fines";
import { Habit } from "@/types/habit";
import { DailyEntry } from "@/types/dailyEntry";
import { DailyTrackingRecord as SupabaseDailyTrackingRecord, YearlyOutOfControlMissCount } from "@/types/tracking"; // Import Supabase type and new type
import { supabase } from "@/lib/supabase";
import { mapSupabaseHabitToHabit } from "@/utils/habitUtils"; // Import the new utility

interface DailyTrackingRecord {
  [date: string]: {
    [habitId: string]: {
      trackedValues: string[];
      isOutOfControlMiss: boolean;
    };
  };
}

const Fines: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<"weekly" | "monthly">("weekly");
  const [habits, setHabits] = React.useState<Habit[]>([]);
  const [dailyTracking, setDailyTracking] = React.useState<DailyTrackingRecord>({});
  const [finesStatus, setFinesStatus] = React.useState<FinesPeriodData>({});
  const [yearlyOutOfControlMissCounts, setYearlyOutOfControlMissCounts] = React.useState<{ [habitId: string]: YearlyOutOfControlMissCount }>({});
  const [lastEntryDate, setLastEntryDate] = React.useState<Date | null>(null);

  // Load data from Supabase
  React.useEffect(() => {
    const loadData = async () => {
      // Fetch habits from Supabase
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('*')
        .order('created_at', { ascending: true }); // Order habits by created_at

      if (habitsError) {
        console.error("Error fetching habits for Fines:", habitsError);
      } else {
        setHabits((habitsData || []).map(mapSupabaseHabitToHabit)); // Apply mapping
      }

      // Fetch all daily habit tracking records
      const { data: trackingData, error: trackingError } = await supabase
        .from('daily_habit_tracking')
        .select('*');

      if (trackingError) {
        console.error("Error fetching daily tracking:", trackingError);
        setDailyTracking({});
      } else {
        const newDailyTracking: DailyTrackingRecord = {};
        trackingData.forEach(record => {
          if (!newDailyTracking[record.date]) {
            newDailyTracking[record.date] = {};
          }
          newDailyTracking[record.date][record.habit_id] = {
            trackedValues: record.tracked_values,
            isOutOfControlMiss: record.is_out_of_control_miss,
          };
        });
        setDailyTracking(newDailyTracking);
      }

      // Fetch fines status from Supabase
      const { data: finesData, error: finesError } = await supabase
        .from('fines_status')
        .select('*');

      if (finesError) {
        console.error("Error fetching fines status:", finesError);
        setFinesStatus({});
      } else {
        const newFinesStatus: FinesPeriodData = {};
        finesData.forEach(fine => {
          if (!newFinesStatus[fine.period_key]) {
            newFinesStatus[fine.period_key] = {};
          }
          if (!newFinesStatus[fine.period_key][fine.habit_id]) {
            newFinesStatus[fine.period_key][fine.habit_id] = [];
          }
          newFinesStatus[fine.period_key][fine.habit_id].push({
            id: fine.id,
            habitId: fine.habit_id,
            habitName: habitsData?.find(h => h.id === fine.habit_id)?.name || 'Unknown Habit',
            fineAmount: fine.fine_amount,
            cause: fine.cause,
            status: fine.status as 'paid' | 'unpaid',
            trackingValue: fine.tracking_value,
            conditionCount: fine.condition_count,
            actualCount: fine.actual_count,
            created_at: fine.created_at,
          });
        });
        setFinesStatus(newFinesStatus);
      }

      // Fetch yearly out-of-control miss counts for the current year
      const currentYear = new Date().getFullYear().toString();
      const { data: missCountsData, error: missCountsError } = await supabase
        .from('yearly_out_of_control_miss_counts')
        .select('*')
        .eq('year', currentYear);

      if (missCountsError) {
        console.error("Error fetching yearly out-of-control miss counts:", missCountsError);
        setYearlyOutOfControlMissCounts({});
      } else {
        const newMissCounts: { [habitId: string]: YearlyOutOfControlMissCount } = {};
        missCountsData.forEach(record => {
          newMissCounts[record.habit_id] = record;
        });
        setYearlyOutOfControlMissCounts(newMissCounts);
      }

      // Fetch last entry date from Supabase
      const { data: latestEntry, error: latestEntryError } = await supabase
        .from('daily_entries')
        .select('date')
        .order('date', { ascending: false })
        .limit(1)
        .single();

      if (latestEntryError && latestEntryError.code !== 'PGRST116') {
        console.error("Error fetching latest daily entry date:", latestEntryError);
      } else if (latestEntry) {
        setLastEntryDate(new Date(latestEntry.date));
      } else {
        setLastEntryDate(null);
      }
    };
    loadData();
  }, []); // Empty dependency array to run once on mount

  const handleUpdateFineStatus = async (periodKey: string, updatedFine: FineDetail) => {
    const fineData = {
      period_key: periodKey,
      habit_id: updatedFine.habitId,
      fine_amount: updatedFine.fineAmount,
      cause: updatedFine.cause,
      status: updatedFine.status,
      tracking_value: updatedFine.trackingValue,
      condition_count: updatedFine.conditionCount,
      actual_count: updatedFine.actualCount,
    };

    const { error } = await supabase
      .from('fines_status')
      .upsert(fineData, { onConflict: 'period_key,habit_id,tracking_value' });

    if (error) {
      console.error("Error updating fine status:", error);
      showError("Failed to update fine status.");
    } else {
      setFinesStatus(prev => {
        const newFinesStatus = { ...prev };
        if (!newFinesStatus[periodKey]) {
          newFinesStatus[periodKey] = {};
        }
        if (!newFinesStatus[periodKey][updatedFine.habitId]) {
          newFinesStatus[periodKey][updatedFine.habitId] = [];
        }

        const habitFines = newFinesStatus[periodKey][updatedFine.habitId];
        const fineIndex = habitFines.findIndex(
          f => f.trackingValue === updatedFine.trackingValue
        );

        if (fineIndex > -1) {
          habitFines[fineIndex] = updatedFine;
        } else {
          habitFines.push(updatedFine);
        }
        return newFinesStatus;
      });
      showSuccess(`Fine for '${updatedFine.habitName}' (${updatedFine.trackingValue}) marked as ${updatedFine.status}.`);
    }
  };

  const currentYear = new Date().getFullYear();
  const allWeeks = getWeeksInYear(currentYear);
  const allMonths = getMonthsInYear(currentYear);
  const today = new Date();

  const filteredWeeks = lastEntryDate
    ? allWeeks.filter(week => isBefore(week.start, startOfWeek(addWeeks(lastEntryDate, 1), { weekStartsOn: 1 }))).reverse()
    : [];

  const filteredMonths = lastEntryDate
    ? allMonths.filter(month => isBefore(month.start, startOfMonth(addMonths(lastEntryDate, 1)))).reverse()
    : [];

  return (
    <div id="fines" className="tab-content text-center">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Fines</h2>
      <p className="text-gray-600 mb-6">Track and manage fines incurred from habit deviations.</p>

      {/* Fines Navigation Tabs */}
      <nav className="flex justify-center mb-6 border-b border-gray-200">
        <button
          className={`tab-button px-4 py-2 text-sm sm:text-base font-medium rounded-t-lg transition-all duration-300 ease-in-out ${
            activeTab === "weekly" ? "text-blue-600 border-blue-500 active" : "text-gray-700 bg-white border-b-2 border-transparent hover:border-blue-500"
          }`}
          onClick={() => setActiveTab("weekly")}
        >
          Weekly Fines
        </button>
        <button
          className={`tab-button px-4 py-2 text-sm sm:text-base font-medium rounded-t-lg transition-all duration-300 ease-in-out ${
            activeTab === "monthly" ? "text-blue-600 border-blue-500 active" : "text-gray-700 bg-white border-b-2 border-transparent hover:border-blue-500"
          }`}
          onClick={() => setActiveTab("monthly")}
        >
          Monthly Fines
        </button>
      </nav>

      {/* Tab Content */}
      {activeTab === "weekly" && (
        <div id="weekly-fines-content" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWeeks.length === 0 ? (
            <div className="dotted-border-container col-span-full">
              <p className="text-lg">No weekly entries found yet. Start tracking daily habits!</p>
            </div>
          ) : (
            filteredWeeks.map((week) => (
              <FineCard
                key={week.periodKey}
                periodStart={week.start}
                periodEnd={week.end}
                periodKey={week.periodKey}
                periodLabel={week.label}
                periodType="weekly"
                habits={habits}
                dailyTracking={dailyTracking}
                finesStatus={finesStatus}
                onUpdateFineStatus={handleUpdateFineStatus}
                isCurrentPeriod={isSameWeek(week.start, today, { weekStartsOn: 1 })}
                yearlyOutOfControlMissCounts={yearlyOutOfControlMissCounts} // Pass new prop
              />
            ))
          )}
        </div>
      )}

      {activeTab === "monthly" && (
        <div id="monthly-fines-content" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMonths.length === 0 ? (
            <div className="dotted-border-container col-span-full">
              <p className="text-lg">No monthly entries found yet. Start tracking daily habits!</p>
            </div>
          ) : (
            filteredMonths.map((month) => (
              <FineCard
                key={month.periodKey}
                periodStart={month.start}
                periodEnd={month.end}
                periodKey={month.periodKey}
                periodLabel={month.label}
                periodType="monthly"
                habits={habits}
                dailyTracking={dailyTracking}
                finesStatus={finesStatus}
                onUpdateFineStatus={handleUpdateFineStatus}
                isCurrentPeriod={isSameMonth(month.start, today)}
                yearlyOutOfControlMissCounts={yearlyOutOfControlMissCounts} // Pass new prop
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Fines;