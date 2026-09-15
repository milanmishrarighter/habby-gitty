"use client";

import React from "react";
import { supabase } from "@/lib/supabase";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown } from "lucide-react";
import { DailyHealthRecord, mapSupabaseHealthRecord, MISSED_DAY_EATING_LABELS, CHEAT_DAY_OUTCOME_LABELS } from "@/types/health";
import { recordCalorieTotals, hasCalorieData } from "@/utils/healthUtils";

interface HealthForDateProps {
  date: string;
}

/** Collapsible health summary for one day on the Recorded Entries page. */
const HealthForDate: React.FC<HealthForDateProps> = ({ date }) => {
  const [record, setRecord] = React.useState<DailyHealthRecord | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!date) {
        setRecord(null);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase
        .from("daily_health")
        .select("*")
        .eq("date", date)
        .maybeSingle();

      if (!mounted) return;
      if (error) {
        console.error("Error fetching health for date:", error);
        setRecord(null);
      } else {
        setRecord(data ? mapSupabaseHealthRecord(data) : null);
      }
      setLoading(false);
    };

    load();
    return () => {
      mounted = false;
    };
  }, [date]);

  const totals = record && hasCalorieData(record) ? recordCalorieTotals(record) : null;

  const headline = !record
    ? ""
    : record.missedDay
      ? " — missed"
      : record.isCheatDay
        ? ` — cheat day, ${totals?.max ?? ""} kcal`
      : record.meals.length > 0 && totals
        ? ` — ${Math.round(totals.min)}–${Math.round(totals.max)} kcal`
        : "";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-2 text-left">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-800 text-sm">Health{headline}</h4>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-9 p-0">
            <ChevronsUpDown className="h-4 w-4" />
            <span className="sr-only">Toggle health details</span>
          </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent className="space-y-2 mt-2 text-sm text-gray-700">
        {loading ? (
          <p className="text-gray-500 italic">Loading health details…</p>
        ) : !record ? (
          <p className="text-gray-500 italic">No health details recorded for this day.</p>
        ) : (
          <>
            {record.missedDay ? (
              <p>
                <span className="font-medium">Missed this day.</span>{" "}
                Eating: {MISSED_DAY_EATING_LABELS[record.missedDayEating ?? "good"]}
              </p>
            ) : (
              <>
                {record.isCheatDay ? (
                  <p className="font-medium text-amber-700">
                    Cheat day: {CHEAT_DAY_OUTCOME_LABELS[record.cheatDayOutcome ?? "under"]}
                  </p>
                ) : record.meals.length === 0 ? (
                  <p className="text-gray-500 italic">No meals recorded.</p>
                ) : (
                  <ul className="list-none space-y-1">
                    {record.meals.map((meal, index) => (
                      <li key={index} className="flex justify-between gap-3">
                        <span>{meal.foodName}</span>
                        <span className="text-gray-500 shrink-0">{meal.minCalorie}–{meal.maxCalorie} kcal</span>
                      </li>
                    ))}
                  </ul>
                )}

                {record.caloriesBurned > 0 && (
                  <p>Burned through exercise/walking: {record.caloriesBurned} kcal</p>
                )}

                {totals && (
                  <p className="font-medium">
                    Total: <span className="text-green-700">{Math.round(totals.min)}</span>
                    {" – "}
                    <span className="text-red-700">{Math.round(totals.max)}</span> kcal
                    <span className="text-gray-500 font-normal"> (avg {Math.round(totals.average)})</span>
                  </p>
                )}
              </>
            )}

            {record.weightChecked && record.weight !== null && (
              <p>Weight: {record.weight} kg</p>
            )}
            {record.shittyDay && <p>Shitty day grade: {record.shittyDay}</p>}
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default HealthForDate;
