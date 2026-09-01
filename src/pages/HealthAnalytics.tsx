"use client";

import React from "react";
import { supabase } from "@/lib/supabase";
import { showError } from "@/utils/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { format, startOfYear, endOfYear, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { DailyHealthRecord, CalorieSettings, EMPTY_CALORIE_SETTINGS, mapSupabaseHealthRecord } from "@/types/health";
import { calorieTotals, readCalorieSettings } from "@/utils/healthUtils";

type Scope = "monthly" | "yearly";

const HealthAnalytics: React.FC = () => {
  const [records, setRecords] = React.useState<DailyHealthRecord[]>([]);
  const [settings, setSettings] = React.useState<CalorieSettings>(EMPTY_CALORIE_SETTINGS);
  const [scope, setScope] = React.useState<Scope>("monthly");
  const [anchor, setAnchor] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = React.useState(true);

  const range = React.useMemo(() => {
    const date = parseISO(anchor);
    return scope === "yearly"
      ? { start: startOfYear(date), end: endOfYear(date) }
      : { start: startOfMonth(date), end: endOfMonth(date) };
  }, [anchor, scope]);

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
        .gte('date', format(range.start, 'yyyy-MM-dd'))
        .lte('date', format(range.end, 'yyyy-MM-dd'))
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
  }, [range]);

  const calorieData = React.useMemo(() => records
    .filter(record => record.meals.length > 0)
    .map(record => {
      const totals = calorieTotals(record.meals, record.caloriesBurned);
      return {
        date: format(parseISO(record.date), scope === 'yearly' ? 'd MMM' : 'd MMM'),
        min: Math.round(totals.min),
        max: Math.round(totals.max),
        average: Math.round(totals.average),
      };
    }), [records, scope]);

  const weightData = React.useMemo(() => records
    .filter(record => record.weightChecked && record.weight !== null)
    .map(record => ({
      date: format(parseISO(record.date), 'd MMM'),
      weight: record.weight as number,
    })), [records]);

  const summary = React.useMemo(() => {
    if (calorieData.length === 0) return null;
    const averages = calorieData.map(d => d.average);
    const onTarget = settings.target
      ? calorieData.filter(d => d.average <= settings.target).length
      : 0;
    return {
      days: calorieData.length,
      mean: Math.round(averages.reduce((a, b) => a + b, 0) / averages.length),
      lowest: Math.min(...averages),
      highest: Math.max(...averages),
      onTarget,
    };
  }, [calorieData, settings.target]);

  const periodLabel = format(range.start, scope === 'yearly' ? 'yyyy' : 'MMMM yyyy');

  return (
    <div id="health-analytics" className="tab-content">
      <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Health Analytics</h2>
      <p className="text-gray-600 mb-6 text-center">Your calorie intake and weight over time.</p>

      <div className="flex flex-wrap items-end justify-center gap-4 mb-6">
        <div className="flex flex-col items-start">
          <label className="text-sm font-medium text-gray-700 mb-1">View</label>
          <Select value={scope} onValueChange={(value) => setScope(value as Scope)}>
            <SelectTrigger className="w-40 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col items-start">
          <label htmlFor="health-anchor" className="text-sm font-medium text-gray-700 mb-1">
            {scope === 'yearly' ? 'Any date in the year' : 'Any date in the month'}
          </label>
          <input
            type="date"
            id="health-anchor"
            className="p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={anchor}
            onChange={(e) => setAnchor(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-center text-gray-500">Loading...</p>
      ) : (
        <div className="space-y-6">
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Calories — {periodLabel}</CardTitle>
            </CardHeader>
            <CardContent>
              {calorieData.length === 0 ? (
                <p className="text-gray-500 text-sm">No meals recorded in this period.</p>
              ) : (
                <div className="w-full overflow-x-auto">
                  <ResponsiveContainer width="100%" height={320} minWidth={320}>
                    <AreaChart data={calorieData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="max" name="Max" stroke="#dc2626" fill="#fecaca" />
                      <Area type="monotone" dataKey="min" name="Min" stroke="#16a34a" fill="#bbf7d0" />
                      <Line type="monotone" dataKey="average" name="Average" stroke="#2563eb" dot={false} />
                      {settings.target > 0 && (
                        <ReferenceLine y={settings.target} stroke="#16a34a" strokeDasharray="4 4"
                          label={{ value: "Target", position: "insideTopRight", fontSize: 11 }} />
                      )}
                      {settings.maintaining > 0 && (
                        <ReferenceLine y={settings.maintaining} stroke="#ca8a04" strokeDasharray="4 4"
                          label={{ value: "Maintaining", position: "insideTopRight", fontSize: 11 }} />
                      )}
                      {settings.cheatDay > 0 && (
                        <ReferenceLine y={settings.cheatDay} stroke="#dc2626" strokeDasharray="4 4"
                          label={{ value: "Cheat day", position: "insideTopRight", fontSize: 11 }} />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Weight — {periodLabel}</CardTitle>
            </CardHeader>
            <CardContent>
              {weightData.length === 0 ? (
                <p className="text-gray-500 text-sm">No weight recorded in this period.</p>
              ) : (
                <div className="w-full overflow-x-auto">
                  <ResponsiveContainer width="100%" height={300} minWidth={320}>
                    <LineChart data={weightData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="weight" name="Weight (kg)" stroke="#7c3aed" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default HealthAnalytics;
