"use client";

import React from "react";
import { format, parseISO } from "date-fns";
import { Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import DeleteConfirmationModal from "@/components/DeleteConfirmationModal";
import { Reminder, mapSupabaseReminder, nextOccurrence } from "@/utils/reminders";

const Reminders: React.FC = () => {
  const [reminders, setReminders] = React.useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [date, setDate] = React.useState("");
  const [text, setText] = React.useState("");
  const [repeatsYearly, setRepeatsYearly] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<Reminder | null>(null);

  const today = format(new Date(), "yyyy-MM-dd");

  const loadReminders = React.useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from("reminders").select("*");
    if (error) {
      console.error("Error loading reminders:", error);
      showError("Failed to load reminders.");
      setReminders([]);
    } else {
      setReminders((data || []).map(mapSupabaseReminder));
    }
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  const handleAdd = async () => {
    if (!date) {
      showError("Pick a date for the reminder.");
      return;
    }
    if (!text.trim()) {
      showError("Write what the reminder is for.");
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.from("reminders").insert([{
      reminder_date: date,
      text: text.trim(),
      repeats_yearly: repeatsYearly,
    }]);
    setIsSaving(false);

    if (error) {
      console.error("Error adding reminder:", error);
      showError("Failed to add the reminder.");
      return;
    }

    showSuccess("Reminder added.");
    setDate("");
    setText("");
    setRepeatsYearly(false);
    loadReminders();
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    const { error } = await supabase.from("reminders").delete().eq("id", pendingDelete.id);
    if (error) {
      console.error("Error deleting reminder:", error);
      showError("Failed to delete the reminder.");
    } else {
      showSuccess("Reminder deleted.");
      setReminders(prev => prev.filter(r => r.id !== pendingDelete.id));
    }
    setPendingDelete(null);
  };

  // Soonest next occurrence first; one-off reminders that have passed go last.
  const sorted = React.useMemo(() => reminders
    .map(reminder => ({ reminder, next: nextOccurrence(reminder, today) }))
    .sort((a, b) => {
      if (a.next && b.next) return a.next.localeCompare(b.next);
      if (a.next) return -1;
      if (b.next) return 1;
      return b.reminder.date.localeCompare(a.reminder.date);
    }), [reminders, today]);

  return (
    <div id="reminders" className="tab-content text-center">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Reminders</h2>
      <p className="text-gray-600 mb-6">
        Birthdays and date-based reminders. The next two show at the top of Daily Entries.
      </p>

      <div className="w-full max-w-md mx-auto text-left space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-50">
        <div>
          <label htmlFor="reminder-date" className="block text-sm font-medium text-gray-700">Date</label>
          <input
            type="date"
            id="reminder-date"
            className="mt-1 p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full bg-white"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="reminder-text" className="block text-sm font-medium text-gray-700">Reminder</label>
          <input
            type="text"
            id="reminder-text"
            placeholder="e.g., Mom's birthday"
            className="mt-1 p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
          />
        </div>
        <label htmlFor="reminder-yearly" className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            id="reminder-yearly"
            className="form-checkbox rounded text-blue-600 focus:ring-blue-500 focus:ring-2 h-4 w-4"
            checked={repeatsYearly}
            onChange={(e) => setRepeatsYearly(e.target.checked)}
          />
          Repeats every year (birthdays, anniversaries)
        </label>
        <Button onClick={handleAdd} disabled={isSaving} className="w-full">
          {isSaving ? "Adding…" : "Add Reminder"}
        </Button>
      </div>

      <div className="max-w-md mx-auto mt-8 text-left">
        {isLoading ? (
          <p className="text-gray-500 text-center">Loading…</p>
        ) : sorted.length === 0 ? (
          <div className="dotted-border-container">
            <p className="text-lg">No reminders yet.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {sorted.map(({ reminder, next }) => (
              <li
                key={reminder.id}
                className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${
                  next ? "bg-white border-gray-200" : "bg-gray-50 border-gray-200 opacity-60"
                }`}
              >
                <div>
                  <p className="font-medium text-gray-800">{reminder.text}</p>
                  <p className="text-xs text-gray-500">
                    {reminder.repeatsYearly
                      ? `Every year on ${format(parseISO(reminder.date), "d MMMM")}`
                      : format(parseISO(reminder.date), "d MMMM yyyy")}
                    {next
                      ? ` · next ${next === today ? "today" : format(parseISO(next), "d MMM yyyy")}`
                      : " · passed"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingDelete(reminder)}
                  className="text-gray-400 hover:text-red-600 focus:outline-none shrink-0"
                  aria-label={`Delete ${reminder.text}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <DeleteConfirmationModal
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
        itemToDeleteName={pendingDelete ? `the reminder "${pendingDelete.text}"` : "this reminder"}
      />
    </div>
  );
};

export default Reminders;
