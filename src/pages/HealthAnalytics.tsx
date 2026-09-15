"use client";

import React from "react";
import { supabase } from "@/lib/supabase";
import { showError } from "@/utils/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ComposedChart, LineChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { format, parseISO, startOfYear, endOfYear, eachMonthOfInterval } from "date-fns";
import {
  DailyHealthRecord, CalorieSettings, EMPTY_CALORIE_SETTINGS, mapSupabaseHealthRecord,
  SHITTY_DAY_GRADES,
} from "@/types/health";
import { recordCalorieTotals, hasCalorieData, readCalorieSettings } from "@/utils/healthUtils";

// Dates are plotted as timestamps on a numeric axis spanning the whole year, so
// the chart keeps a true January-to-December scale even when days are missing.
const dayTimestamp = (date: string) => parseISO(date).getTime();

const HealthAnalytics: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = React.useState(currentYear);
  const [records, setRecords] = React.useState<DailyHealthRecord[]>([]);
  const [settings, setSettings] = React.useState<CalorieSettings>(EMPTY_CALORIE_SETTINGS);
  const [isLoading, setIsLoading] = React.useState(true);

  const yearStart = startOfYear(new Date(year, 0, 1));
  const yearEnd = endOfYear(yearStart);
  const xDomain: [number, number] = [yearStart.getTime(), yearEnd.getTime()];
  const monthTicks = eachMonthOfInterval({ start: yearStart, end: yearEnd }).map(d => d.getTime());
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

  React.useEffect(() => {
    const load = async () => {
      setIsLoading(true);

      const { data: settingsData } = await supabase
        .from('app_settings')
        .select('settings_data')
        .limit(1)
        .single();
      setSettings(readCalorieSettings(settingsData?.settings_data));

      const { data, error } = await supabase
        .from('daily_health')
        .select('*')
        .gte('date', `${year}-01-01`)
        .lte('date', `${year}-12-31`)
        .order('date', { ascending: true });

      if (error) {
        console.error("Error loading health records:", error);
        showError("Failed to load health data.");
        setRecords([]);
      } else {
        setRecords((data || []).map(mapSupabaseHealthRecord));
      }
      setIsLoading(false);
    };
    load();
  }, [year]);

  const calorieData = React.useMemo(() => records
    .filter(hasCalorieData)
    .map(record => {
      const totals = recordCalorieTotals(record);
      return {
        day: dayTimestamp(record.date),
        min: Math.round(totals.min),
        max: Math.round(totals.max),
        average: Math.round(totals.average),
      };
    }), [records]);

  const weightData = React.useMemo(() => records
    .filter(record => record.weightChecked && record.weight !== null)
    .map(record => ({ day: dayTimestamp(record.date), weight: record.weight as number })), [records]);

  // One row per month: how many days were graded, and how many got each grade.
  const shittyDayRows = React.useMemo(() => eachMonthOfInterval({ start: yearStart, end: yearEnd })
    .map(monthStart => {
      const monthKey = format(monthStart, 'yyyy-MM');
      const counts = { A: 0, B: 0, C: 0, D: 0 };
      records.forEach(record => {
        if (record.shittyDay && record.date.startsWith(monthKey)) counts[record.shittyDay] += 1;
      });
      const total = counts.A + counts.B + counts.C + counts.D;
      return { month: format(monthStart, 'MMMM'), total, ...counts };
    }), [records, year]); // eslint-disable-line react-hooks/exhaustive-deps

  const shittyDayTotals = shittyDayRows.reduce(
    (sum, row) => ({
      total: sum.total + row.total,
      A: sum.A + row.A, B: sum.B + row.B, C: sum.C + row.C, D: sum.D + row.D,
    }),
    { total: 0, A: 0, B: 0, C: 0, D: 0 },
  );

  const summary = React.useMemo(() => {
    if (calorieData.length === 0) return null;
    const averages = calorieData.map(d => d.average);
    return {
      days: calorieData.length,
      mean: Math.round(averages.reduce((a, b) => a + b, 0) / averages.length),
      onTarget: settings.target ? calorieData.filter(d => d.average <= settings.target).length : 0,
      lowest: Math.min(...averages),
      highest: Math.max(...averages),
    };
  }, [calorieData, settings.target]);

  const missedDays = records.filter(record => record.missedDay).length;

  const xAxisProps = {
    dataKey: "day",
    type: "number" as const,
    scale: "time" as const,
    domain: xDomain,
    ticks: monthTicks,
    tickFormatter: (value: number) => format(new Date(value), 'MMM'),
    tick: { fontSize: 12 },
  };
  const tooltipLabel = (value: number) => format(new Date(value), 'EEE, d MMM yyyy');

  return (
    <div id="health-analytics" className="tab-content">
      <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Health Analytics</h2>
      <p className="text-gray-600 mb-6 text-center">Your calorie intake, weight and day grades across a year.</p>

      <div className="flex justify-center mb-6">
        <div className="flex flex-col items-start">
          <label className="text-sm font-medium text-gray-700 mb-1">Year</label>
          <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
            <SelectTrigger className="w-32 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-center text-gray-500">Loading...</p>
      ) : (
        <div className="space-y-6">
          {(summary || missedDays > 0) && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {summary && (
                <>
                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <p className="text-xs text-gray-600">Days logged</p>
                    <p className="text-xl font-bold text-gray-800">{summary.days}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <p className="text-xs text-blue-700">Average intake</p>
                    <p className="text-xl font-bold text-blue-800">{summary.mean}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                    <p className="text-xs text-green-700">Days on target</p>
                    <p className="text-xl font-bold text-green-800">{summary.onTarget}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <p className="text-xs text-gray-600">Range</p>
                    <p className="text-xl font-bold text-gray-800">{summary.lowest}–{summary.highest}</p>
                  </div>
                </>
              )}
              {missedDays > 0 && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-xs text-red-700">Days missed</p>
                  <p className="text-xl font-bold text-red-800">{missedDays}</p>
                </div>
              )}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Calories — {year}</CardTitle>
            </CardHeader>
            <CardContent>
              {calorieData.length === 0 ? (
                <p className="text-gray-500 text-sm">No calories recorded in {year}.</p>
              ) : (
                <>
                  <div className="w-full overflow-x-auto">
                    <ResponsiveContainer width="100%" height={340} minWidth={560}>
                      <ComposedChart data={calorieData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis {...xAxisProps} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip labelFormatter={tooltipLabel} />
                        <Legend />
                        <Area type="monotone" dataKey="max" name="Max" stroke="#dc2626" fill="#fecaca" />
                        <Area type="monotone" dataKey="min" name="Min" stroke="#16a34a" fill="#bbf7d0" />
                        <Line type="monotone" dataKey="average" name="Average" stroke="#2563eb" dot={false} strokeWidth={2} />
                        {settings.target > 0 && (
                          <ReferenceLine y={settings.target} stroke="#16a34a" strokeDasharray="4 4"
                            label={{ value: "Target", position: "insideTopRight", fontSize: 11 }} />
                        )}
                        {settings.maintaining > 0 && (
                          <ReferenceLine y={settings.maintaining} stroke="#ca8a04" strokeDasharray="4 4"
                            label={{ value: "Maintaining", position: "insideTopRight", fontSize: 11 }} />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Cheat days are plotted at 3500 kcal, or 4250 kcal when you went over. Missed days aren't plotted.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Weight — {year}</CardTitle>
            </CardHeader>
            <CardContent>
              {weightData.length === 0 ? (
                <p className="text-gray-500 text-sm">No weight recorded in {year}.</p>
              ) : (
                <div className="w-full overflow-x-auto">
                  <ResponsiveContainer width="100%" height={300} minWidth={560}>
                    <LineChart data={weightData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis {...xAxisProps} />
                      <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 12 }} />
                      <Tooltip labelFormatter={tooltipLabel} />
                      <Line type="monotone" dataKey="weight" name="Weight (kg)" stroke="#7c3aed" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Shitty days — {year}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-600">
                      <th className="text-left font-semibold py-2 pr-3">Month</th>
                      <th className="text-right font-semibold py-2 px-3">Total shitty days</th>
                      {SHITTY_DAY_GRADES.map(grade => (
                        <th key={grade} className="text-right font-semibold py-2 px-3">{grade}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shittyDayRows.map(row => (
                      <tr key={row.month} className="border-b border-gray-100">
                        <td className="py-2 pr-3 text-gray-800">{row.month}</td>
                        <td className="py-2 px-3 text-right font-semibold text-gray-800 tabular-nums">{row.total}</td>
                        {SHITTY_DAY_GRADES.map(grade => (
                          <td
                            key={grade}
                            className={`py-2 px-3 text-right tabular-nums ${row[grade] === 0 ? "text-gray-300" : "text-gray-700"}`}
                          >
                            {row[grade]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 font-semibold text-gray-800">
                      <td className="py-2 pr-3">Year</td>
                      <td className="py-2 px-3 text-right tabular-nums">{shittyDayTotals.total}</td>
                      {SHITTY_DAY_GRADES.map(grade => (
                        <td key={grade} className="py-2 px-3 text-right tabular-nums">{shittyDayTotals[grade]}</td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default HealthAnalytics;
