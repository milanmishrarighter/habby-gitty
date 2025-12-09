"use client";

import React from "react";
import { supabase } from "@/lib/supabase";
import { Habit } from "@/types/habit";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown } from "lucide-react";

interface TrackedForDateProps {
  date: string;
  allHabits: Habit[];
}

type TrackedItem = {
  name: string;
  color: string;
  text: string;
};

const TrackedForDate: React.FC<TrackedForDateProps> = ({ date, allHabits }) => {
  const [items, setItems] = React.useState<TrackedItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!date) {
        setItems([]);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase
        .from("daily_habit_tracking")
        .select("*")
        .eq("date", date);

      if (error) {
        console.error("Error fetching tracking for date:", error);
        if (mounted) {
          setItems([]);
          setLoading(false);
        }
        return;
      }

      const list: TrackedItem[] = (data || []).map((record: any) => {
        const habit = Array.isArray(allHabits)
          ? allHabits.find((h) => String(h.id) === String(record.habit_id))
          : undefined;
        const name = habit?.name ?? "Unknown habit";
        const color = habit?.color ?? "#9ca3af";

        const trackedValuesArray = Array.isArray(record.tracked_values)
          ? record.tracked_values
          : [];

        let text = "";
        if (trackedValuesArray.length > 0) {
          if (trackedValuesArray.includes("WEEK_OFF")) {
            text = "Week Off";
          } else {
            text = trackedValuesArray.join(", ");
          }
        } else if (record.is_out_of_control_miss) {
          text = "Out-of-Control Miss";
        } else {
          text = "";
        }

        return { name, color, text };
      }).filter((it: TrackedItem) => it.text !== "");

      if (mounted) {
        setItems(list);
        setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [date, allHabits]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-2 text-left">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-800 text-sm">
          Tracked habits{items.length ? ` (${items.length})` : ""}
        </h4>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-9 p-0">
            <ChevronsUpDown className="h-4 w-4" />
            <span className="sr-only">Toggle tracked habits</span>
          </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent className="space-y-1 mt-2">
        {loading ? (
          <p className="text-sm text-gray-500 italic">Loading tracked habits…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No habits tracked for this day.</p>
        ) : (
          <ul className="list-none space-y-1">
            {items.map((item, idx) => (
              <li key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                <span className="font-medium">{item.name}:</span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default TrackedForDate;