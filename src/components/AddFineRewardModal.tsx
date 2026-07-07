"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showError } from "@/utils/toast";
import { FineRewardType } from "@/types/fines";
import { Habit } from "@/types/habit";

const NO_HABIT_VALUE = "__none__";

interface AddFineRewardModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: FineRewardType;
  habits: Habit[];
  onSave: (entry: {
    amount: number;
    description: string;
    habitId: string | null;
    date: string;
  }) => Promise<void>;
}

const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const AddFineRewardModal: React.FC<AddFineRewardModalProps> = ({ isOpen, onClose, type, habits, onSave }) => {
  const [amount, setAmount] = React.useState<number | "">("");
  const [description, setDescription] = React.useState("");
  const [habitId, setHabitId] = React.useState<string>(NO_HABIT_VALUE);
  const [date, setDate] = React.useState(getTodayDate());
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setAmount("");
      setDescription("");
      setHabitId(NO_HABIT_VALUE);
      setDate(getTodayDate());
    }
  }, [isOpen, type]);

  const handleSave = async () => {
    if (typeof amount !== "number" || amount <= 0) {
      showError("Please enter an amount greater than 0.");
      return;
    }
    if (!description.trim()) {
      showError("Please enter a description.");
      return;
    }
    if (!date) {
      showError("Please select a date.");
      return;
    }

    setIsSaving(true);
    await onSave({
      amount,
      description: description.trim(),
      habitId: habitId === NO_HABIT_VALUE ? null : habitId,
      date,
    });
    setIsSaving(false);
  };

  const isReward = type === "reward";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isReward ? "Add Reward" : "Add Fine"}</DialogTitle>
          <DialogDescription>
            {isReward ? "Record a reward you're giving yourself." : "Record a fine you owe."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="w-full">
            <label htmlFor="fr-amount" className="block text-sm font-medium text-gray-700 text-left">Amount</label>
            <input
              type="number"
              id="fr-amount"
              placeholder="Enter amount in Rupees"
              className="mt-1 p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
              value={amount}
              onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </div>
          <div className="w-full">
            <label htmlFor="fr-description" className="block text-sm font-medium text-gray-700 text-left">Description</label>
            <input
              type="text"
              id="fr-description"
              placeholder={isReward ? "e.g., Hit my reading goal this month" : "e.g., Skipped gym without a valid reason"}
              className="mt-1 p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="w-full text-left">
            <label className="block text-sm font-medium text-gray-700 mb-1">Habit (optional)</label>
            <Select value={habitId} onValueChange={setHabitId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a habit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_HABIT_VALUE}>None / Not tied to a habit</SelectItem>
                {habits.map((habit) => (
                  <SelectItem key={habit.id} value={habit.id}>{habit.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full">
            <label htmlFor="fr-date" className="block text-sm font-medium text-gray-700 text-left">Date</label>
            <input
              type="date"
              id="fr-date"
              className="mt-1 p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : isReward ? "Add Reward" : "Add Fine"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddFineRewardModal;
