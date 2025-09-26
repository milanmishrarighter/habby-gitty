"use client";

import React from "react";
import { format, isAfter, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, addMonths, isSameWeek, isSameMonth, isBefore } from 'date-fns';
import { getWeeksInYear, getMonthsInYear } from "@/lib/date-utils";
import FineCard from "@/components/FineCard";
import { FineDetail, FinesPeriodData } from "@/types/fines";

// Interfaces from existing files (copied for self-containment of Fines page)
interface Habit {
  id: string;
  name: string;
  color: string;
  trackingValues: string[];
  frequencyConditions: { trackingValue: string; frequency: string; count: number }[];
  fineAmount: number;
  yearlyGoal: {
    count: number;
    contributingValues: string[];
  };
  createdAt: string;
}

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

  // Load data from localStorage
  React.useEffect(() => {
    const storedHabits = localStorage.getItem('dailyJournalHabits');
    if (storedHabits) {
      setHabits(JSON.parse(storedHabits));
    }

    const storedDailyTracking = localStorage.getItem('dailyHabitTracking');
    if (storedDailyTracking) {
      setDailyTracking(JSON.parse(storedDailyTracking));
    }

    const storedFinesStatus = localStorage.getItem('dailyJournalFinesStatus');
    if (storedFinesStatus) {
      setFinesStatus(JSON.parse(storedFinesStatus));
    }

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
  }, []);

  // Save fines status to localStorage whenever it changes
  React.useEffect(() => {
    localStorage.setItem('dailyJournalFinesStatus', JSON.stringify(finesStatus));
  }, [finesStatus]);

  const handleUpdateFineStatus = (periodKey: string, updatedFine: FineDetail) => {
    setFinesStatus(prev => {
      const newFinesStatus = { ...prev };
      if (!newFinesStatus[periodKey]) {
        newFinesStatus[periodKey] = {};
      }
      if (!newFinesStatus[periodKey][updatedFine.habitId]) {
        newFinesStatus[periodKey][updatedFine.habitId] = [];
      }

      const fineIndex = newFinesStatus[periodKey][updatedFine.habitId].findIndex(
        f => f.trackingValue === updatedFine.trackingValue
      );

      if (fineIndex > -1) {
        newFinesStatus[periodKey][updatedFine.habitId][fineIndex] = updatedFine;
      } else {
        // If it's a new fine being marked for the first time, add it.
        newFinesStatus[periodKey][updatedFine.habitId].push(updatedFine);
      }

      return newFinesStatus;
    });
  };

  const currentYear = new Date().getFullYear();
  const allWeeks = getWeeksInYear(currentYear);
  const allMonths = getMonthsInYear(currentYear);

  const filteredWeeks = lastEntryDate
    ? allWeeks.filter(week => isBefore(week.start, addWeeks(lastEntryDate, 1)) || isSameWeek(week.start, lastEntryDate, { weekStartsOn: 1 }))
    : [];

  const filteredMonths = lastEntryDate
    ? allMonths.filter(month => isBefore(month.start, addMonths(lastEntryDate, 1)) || isSameMonth(month.start, lastEntryDate))
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
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Fines;