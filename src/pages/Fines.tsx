"use client";

import React from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import AddFineRewardModal from "@/components/AddFineRewardModal";
import DeleteConfirmationModal from "@/components/DeleteConfirmationModal";
import { FineRewardEntry, FineRewardType } from "@/types/fines";
import { Habit } from "@/types/habit";
import { supabase } from "@/lib/supabase";
import { mapSupabaseHabitToHabit } from "@/utils/habitUtils";
import { showSuccess, showError } from "@/utils/toast";

const GENERAL_HABIT_SENTINEL = "___general___";

interface FinesStatusRow {
  id: string;
  type: string | null;
  fine_amount: number;
  cause: string;
  habit_id: string;
  entry_date: string | null;
  created_at: string;
}

const Fines: React.FC = () => {
  const [habits, setHabits] = React.useState<Habit[]>([]);
  const [entries, setEntries] = React.useState<FineRewardEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [modalType, setModalType] = React.useState<FineRewardType | null>(null);
  const [entryPendingDelete, setEntryPendingDelete] = React.useState<FineRewardEntry | null>(null);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);

    const { data: habitsData, error: habitsError } = await supabase
      .from('habits')
      .select('*')
      .order('created_at', { ascending: true });

    if (habitsError) {
      console.error("Error fetching habits for Fines & Rewards:", habitsError);
      showError("Failed to load habits.");
    } else {
      setHabits((habitsData || []).map(mapSupabaseHabitToHabit));
    }

    const { data: entriesData, error: entriesError } = await supabase
      .from('fines_status')
      .select('*')
      .order('entry_date', { ascending: false });

    if (entriesError) {
      console.error("Error fetching fines & rewards:", entriesError);
      showError("Failed to load fines & rewards.");
      setEntries([]);
    } else {
      const mapped: FineRewardEntry[] = (entriesData || []).map((row: FinesStatusRow) => ({
        id: row.id,
        type: (row.type as FineRewardType) || 'fine',
        amount: row.fine_amount,
        description: row.cause,
        habitId: row.habit_id && row.habit_id !== GENERAL_HABIT_SENTINEL ? row.habit_id : null,
        habitName: row.habit_id && row.habit_id !== GENERAL_HABIT_SENTINEL
          ? (habitsData || []).find((h: { id: string }) => h.id === row.habit_id)?.name || 'Unknown Habit'
          : null,
        date: row.entry_date || format(new Date(row.created_at), 'yyyy-MM-dd'),
        created_at: row.created_at,
      }));
      setEntries(mapped);
    }

    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveEntry = async (input: { amount: number; description: string; habitId: string | null; date: string }) => {
    if (!modalType) return;

    const payload = {
      type: modalType,
      fine_amount: input.amount,
      cause: input.description,
      habit_id: input.habitId || GENERAL_HABIT_SENTINEL,
      entry_date: input.date,
      status: 'unpaid',
      period_key: input.date,
      tracking_value: `MANUAL:${crypto.randomUUID()}`,
      condition_count: 0,
      actual_count: 0,
    };

    const { error } = await supabase.from('fines_status').insert([payload]);

    if (error) {
      console.error("Error saving fine/reward:", error);
      showError(`Failed to save ${modalType}.`);
      return;
    }

    showSuccess(`${modalType === 'reward' ? 'Reward' : 'Fine'} added successfully!`);
    setModalType(null);
    loadData();
  };

  const handleConfirmDelete = async () => {
    if (!entryPendingDelete) return;

    const { error } = await supabase
      .from('fines_status')
      .delete()
      .eq('id', entryPendingDelete.id);

    if (error) {
      console.error("Error deleting fine/reward:", error);
      showError("Failed to delete entry.");
    } else {
      showSuccess("Entry deleted.");
      setEntries(prev => prev.filter(e => e.id !== entryPendingDelete.id));
    }
    setEntryPendingDelete(null);
  };

  const totalFines = entries.filter(e => e.type === 'fine').reduce((sum, e) => sum + e.amount, 0);
  const totalRewards = entries.filter(e => e.type === 'reward').reduce((sum, e) => sum + e.amount, 0);
  const net = totalRewards - totalFines;

  return (
    <div id="fines" className="tab-content text-center">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Fines & Rewards</h2>
      <p className="text-gray-600 mb-6">Manually record fines and rewards for yourself.</p>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 max-w-2xl mx-auto">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 font-medium">Total Fines</p>
          <p className="text-2xl font-bold text-red-600">₹{totalFines}</p>
        </div>
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700 font-medium">Total Rewards</p>
          <p className="text-2xl font-bold text-green-600">₹{totalRewards}</p>
        </div>
        <div className={`p-4 rounded-lg border ${net >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-sm font-medium ${net >= 0 ? 'text-green-700' : 'text-red-700'}`}>Net</p>
          <p className={`text-2xl font-bold ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {net >= 0 ? '+' : '-'}₹{Math.abs(net)}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-4 mb-8">
        <Button variant="destructive" onClick={() => setModalType('fine')}>+ Add Fine</Button>
        <Button className="bg-green-600 hover:bg-green-700" onClick={() => setModalType('reward')}>+ Add Reward</Button>
      </div>

      {/* Entries List */}
      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : entries.length === 0 ? (
        <div className="dotted-border-container">
          <p className="text-lg">No fines or rewards recorded yet.</p>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto space-y-3 text-left">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                entry.type === 'reward' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}
            >
              <div>
                <p className="font-medium text-gray-800">{entry.description}</p>
                <p className="text-xs text-gray-500">
                  {format(new Date(entry.date), 'MMM dd, yyyy')}
                  {entry.habitName ? ` · ${entry.habitName}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`font-bold ${entry.type === 'reward' ? 'text-green-600' : 'text-red-600'}`}>
                  {entry.type === 'reward' ? '+' : '-'}₹{entry.amount}
                </span>
                <button
                  onClick={() => setEntryPendingDelete(entry)}
                  className="text-gray-400 hover:text-red-600 focus:outline-none"
                  aria-label="Delete entry"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddFineRewardModal
        isOpen={modalType !== null}
        onClose={() => setModalType(null)}
        type={modalType || 'fine'}
        habits={habits}
        onSave={handleSaveEntry}
      />

      <DeleteConfirmationModal
        isOpen={entryPendingDelete !== null}
        onClose={() => setEntryPendingDelete(null)}
        onConfirm={handleConfirmDelete}
        itemToDeleteName={entryPendingDelete ? `the ${entryPendingDelete.type} "${entryPendingDelete.description}"` : "this entry"}
      />
    </div>
  );
};

export default Fines;
