"use client";

import React from "react";
import { format, isAfter, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, addMonths, isSameWeek, isSameMonth, isBefore, addDays, subDays } from 'date-fns';
import { getWeeksInYear, getMonthsInYear } from "@/lib/date-utils";
import FineCard from "@/components/FineCard";
import { FineDetail, FinesPeriodData } from "@/types/fines";
import { Habit } from "@/types/habit"; // Import the centralized Habit interface
import { supabase } from "@/lib/supabase"; // Import Supabase client

interface DailyEntry {
  date: string;
  text: string;
  mood: string;
  timestamp: string;
}

interface DailyTrackingRecord {
  [date: string]: {
    [habitId: string]: string[];
  };
}

const Fines: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<"weekly" | "monthly">("weekly");
  const [habits, setHabits] = React.useState<Habit[]>([]);
  const [dailyTracking, setDailyTracking] = React.useState<DailyTrackingRecord>({});
  const [finesStatus, setFinesStatus] = React.useState<FinesPeriodData>({});
  const [lastEntryDate, setLastEntryDate] = React.useState<Date | null>(null);

  // Load data from localStorage and Supabase
  React.useEffect(() => {
    const loadData = async () => {
      // Fetch habits from Supabase
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('*');

      if (habitsError) {
        console.error("Error fetching habits for Fines:", habitsError);
        // Optionally show a toast error
      } else {
        setHabits(habitsData as Habit[]);
      }

      // Load daily tracking from localStorage
      const storedDailyTracking = localStorage.getItem('dailyHabitTracking');
      if (storedDailyTracking) {
        setDailyTracking(JSON.parse(storedDailyTracking));
      }

      // Load fines status from localStorage
      const storedFinesStatus = localStorage.getItem('dailyJournalFinesStatus');
      if (storedFinesStatus) {
        setFinesStatus(JSON.parse(storedFinesStatus));
      }

      // Load last entry date from localStorage
      const storedEntries = localStorage.getItem("dailyJournalEntries");
      if (storedEntries) {
        const parsedEntries: DailyEntry[] = JSON.parse(storedEntries);
        if (parsedEntries.length > 0) {
          const latestDate = parsedEntries.reduce((maxDate, entry) => {
            const entryDate = new Date(entry.date);
            return entryDate > maxDate ? entryDate : maxDate;
          }, new Date(0)); // Initialize with a very old date
          setLastEntryDate(latestDate);
        }
      }
    };
    loadData();
  }, []);

  // Save fines status to localStorage whenever it changes
  React.useEffect(() => {
    localStorage.setItem('dailyJournalFinesStatus', JSON.stringify(finesStatus));
  }, [finesStatus]);

  const handleUpdateFineStatus = (periodKey: string, updatedFine: FineDetail) => {
    setFinesStatus(prev => {
      const newFinesStatus = { ...prev }; // Shallow copy of the top-level object

      // Ensure a new object for the periodKey if it's being modified
      const periodData = { ...(newFinesStatus[periodKey] || {}) };
      newFinesStatus[periodKey] = periodData;

      // Ensure a new array for the habitId if it's being modified
      const habitFines = [...(periodData[updatedFine.habitId] || [])]; // Create a new array reference
      periodData[updatedFine.habitId] = habitFines;

      const fineIndex = habitFines.findIndex(
        f => f.trackingValue === updatedFine.trackingValue
      );

      if (fineIndex > -1) {
        habitFines[fineIndex] = updatedFine; // Update the item in the new array
      } else {
        habitFines.push(updatedFine); // Add to the new array
      }

      return newFinesStatus;
    });
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
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Fines;