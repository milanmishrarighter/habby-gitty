"use client";

import React from "react";
import { supabase } from "@/lib/supabase";
import { Habit } from "@/types/habit";
import { mapSupabaseHabitToHabit } from "@/utils/habitUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { getDaysInYear, differenceInDays, startOfYear, endOfYear, format, isThisYear } from 'date-fns';
import { showSuccess, showError } from "@/utils/toast";

interface YearlyTrackingCounts {
  [habitId: string]: {
    [trackingValue: string]: number;
  };
}

interface YearlyProgressDisplay {
  [habitId: string]: {
    progressCount: number;
    goalCount: number;
  };
}

const YearlyAnalytics: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = React.useState<string>(currentYear.toString());
  const [habits, setHabits] = React.useState<Habit[]>([]);
  const [yearlyTrackingCounts, setYearlyTrackingCounts] = React.useState<YearlyTrackingCounts>({});
  const [yearlyProgressDisplay, setYearlyProgressDisplay] = React.useState<YearlyProgressDisplay>({});
  const [isLoading, setIsLoading] = true;
  const [hasDataForYear, setHasDataForYear] = React.useState(false);

  const years = React.useMemo(() => {
    const yearsArray = [];
    for (let i = currentYear; i >= currentYear - 5; i--) { // Show current year and 5 past years
      yearsArray.push(i.toString());
    }
    return yearsArray;
  }, [currentYear]);

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setHasDataForYear(false);
      setYearlyTrackingCounts({});
      setYearlyProgressDisplay({});

      // Fetch all habits
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('*')
        .order('created_at', { ascending: true }); // Order habits by created_at

      if (habitsError) {
        console.error("Error fetching habits for YearlyAnalytics:", habitsError);
        showError("Failed to load habits.");
        setIsLoading(false);
        return;
      }
      const mappedHabits = (habitsData || []).map(mapSupabaseHabitToHabit);
      setHabits(mappedHabits);

      // Fetch daily tracking records for the selected year
      const yearStart = format(startOfYear(new Date(Number(selectedYear), 0, 1)), 'yyyy-MM-dd');
      const yearEnd = format(endOfYear(new Date(Number(selectedYear), 0, 1)), 'yyyy-MM-dd');

      const { data: trackingData, error: trackingError } = await supabase
        .from('daily_habit_tracking')
        .select('*')
        .gte('date', yearStart)
        .lte('date', yearEnd);

      if (trackingError) {
        console.error("Error fetching daily tracking for year:", trackingError);
        showError("Failed to load yearly tracking data.");
        setIsLoading(false);
        return;
      }

      const calculatedYearlyTrackingCounts: YearlyTrackingCounts = {};
      let foundTrackingData = false;
      trackingData.forEach(record => {
        foundTrackingData = true;
        if (!calculatedYearlyTrackingCounts[record.habit_id]) {
          calculatedYearlyTrackingCounts[record.habit_id] = {};
        }
        record.tracked_values.forEach(value => {
          calculatedYearlyTrackingCounts[record.habit_id][value] = (calculatedYearlyTrackingCounts[record.habit_id][value] || 0) + 1;
        });
      });
      setYearlyTrackingCounts(calculatedYearlyTrackingCounts);

      // Fetch yearly progress records for the selected year
      const { data: progressData, error: progressError } = await supabase
        .from('yearly_habit_progress')
        .select('*')
        .eq('year', selectedYear);

      if (progressError) {
        console.error("Error fetching yearly progress for year:", progressError);
        showError("Failed to load yearly progress data.");
        setIsLoading(false);
        return;
      }

      const calculatedYearlyProgressDisplay: YearlyProgressDisplay = {};
      let foundProgressData = false;
      progressData.forEach(record => {
        foundProgressData = true;
        calculatedYearlyProgressDisplay[record.habit_id] = {
          progressCount: record.progress_count,
          goalCount: mappedHabits.find(h => h.id === record.habit_id)?.yearlyGoal?.count || 0,
        };
      });
      setYearlyProgressDisplay(calculatedYearlyProgressDisplay);

      setHasDataForYear(foundTrackingData || foundProgressData);
      setIsLoading(false);
    };

    fetchData();
  }, [selectedYear]);

  // Calculate year progress for the current year
  const today = new Date();
  const yearStartDate = startOfYear(today);
  const yearEndDate = endOfYear(today);
  const totalDaysInYear = getDaysInYear(today);
  const daysPassed = differenceInDays(today, yearStartDate) + 1; // +1 to include today
  const daysLeft = differenceInDays(yearEndDate, today);
  const yearProgressPercentage = (daysPassed / totalDaysInYear) * 100;

  return (
    <div id="yearly-analytics" className="tab-content text-center">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Yearly Analytics</h2>
      <p className="text-gray-600 mb-6">Review your habit performance and progress over the year.</p>

      <div className="flex justify-center mb-6">
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select Year" />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={year}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-lg text-gray-600">Loading yearly data...</p>
        </div>
      ) : !hasDataForYear ? (
        <div className="dotted-border-container">
          <p className="text-lg">No data exists for {selectedYear}.</p>
          <p className="text-sm text-gray-500">Start tracking habits in Daily Entries to see analytics here.</p>
        </div>
      ) : (
        <>
          {/* Year Progress Bar (only for current year) */}
          {isThisYear(new Date(Number(selectedYear), 0, 1)) && (
            <Card className="mb-6 p-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl font-semibold">Year Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-2">
                  {daysPassed} of {totalDaysInYear} days passed ({daysLeft} days left)
                </p>
                <Progress value={yearProgressPercentage} className="w-full" />
              </CardContent>
            </Card>
          )}

          {/* Habit Analytics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {habits.map((habit) => {
              const habitYearlyTracking = yearlyTrackingCounts[habit.id] || {};
              const habitYearlyProgress = yearlyProgressDisplay[habit.id];

              // Only show habits that have some tracking data or a yearly goal
              if (Object.keys(habitYearlyTracking).length === 0 && (!habitYearlyProgress || habitYearlyProgress.goalCount === 0)) {
                return null;
              }

              return (
                <Card key={habit.id} className="flex flex-col" style={{ backgroundColor: `${habit.color}33` }}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-lg font-semibold">
                      <span>{habit.name}</span>
                      <div className="w-6 h-6 rounded-full border-2 border-white shadow" style={{ backgroundColor: habit.color }}></div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow text-left">
                    {Object.keys(habitYearlyTracking).length > 0 ? (
                      <div className="mb-3">
                        <h4 className="font-medium text-gray-700 mb-1">Tracking Values:</h4>
                        <ul className="list-disc list-inside text-sm text-gray-600">
                          {Object.entries(habitYearlyTracking).map(([value, count]) => (
                            <li key={value}>{value}: {count} times</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic mb-3">No specific values tracked this year.</p>
                    )}

                    {habitYearlyProgress && habitYearlyProgress.goalCount > 0 ? (
                      <div>
                        <h4 className="font-medium text-gray-700 mb-1">Yearly Goal:</h4>
                        <p className="text-sm text-gray-600">
                          Progress: {habitYearlyProgress.progressCount} / {habitYearlyProgress.goalCount}
                        </p>
                        <Progress value={(habitYearlyProgress.progressCount / habitYearlyProgress.goalCount) * 100} className="w-full mt-1" />
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">No yearly goal set or tracked for this habit.</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default YearlyAnalytics;