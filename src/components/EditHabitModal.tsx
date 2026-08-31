"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { showSuccess, showError } from "@/utils/toast";
import { Habit } from "@/types/habit"; // Import the centralized Habit interface
import { Switch } from "@/components/ui/switch";
import HabitDayTypeFields from "@/components/HabitDayTypeFields";
import HabitConditionsEditor, { ConditionInput, emptyCondition } from "@/components/HabitConditionsEditor";
import { DayType } from "@/utils/dayType";

interface EditHabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialHabit: Habit | null;
  onSave: (updatedHabit: Habit) => void;
  availableEmails: string[];
}

const EditHabitModal: React.FC<EditHabitModalProps> = ({ isOpen, onClose, initialHabit, onSave, availableEmails }) => {
  const [habitName, setHabitName] = React.useState("");
  const [habitColor, setHabitColor] = React.useState("#4F46E5");
  const [tempTrackingValues, setTempTrackingValues] = React.useState<string[]>([]);
  const [trackingValueInput, setTrackingValueInput] = React.useState("");
  const [frequencyConditions, setFrequencyConditions] = React.useState<ConditionInput[]>([emptyCondition()]);
  const [fineAmount, setFineAmount] = React.useState<number | "">("");
  const [yearlyGoalCount, setYearlyGoalCount] = React.useState<number | "">("");
  const [contributingValues, setContributingValues] = React.useState<string[]>([]);
  const [allowedOutOfControlMisses, setAllowedOutOfControlMisses] = React.useState<number | "">(""); // New state
  const [hintText, setHintText] = React.useState(""); // New state for hint text
  const [dayType, setDayType] = React.useState<DayType>("hard");
  const [allowTemporaryHold, setAllowTemporaryHold] = React.useState(false);
  const [isDeactivated, setIsDeactivated] = React.useState(false);
  const [rewardAmount, setRewardAmount] = React.useState<number | "">("");
  const [alertEmails, setAlertEmails] = React.useState<string[]>([]);
  const [alertSubject, setAlertSubject] = React.useState("");
  const [alertBody, setAlertBody] = React.useState("");

  // Populate form fields when modal opens or initialHabit changes
  React.useEffect(() => {
    if (initialHabit) {
      setHabitName(initialHabit.name);
      setHabitColor(initialHabit.color);
      setTempTrackingValues(initialHabit.trackingValues || []); // Defensive check
      setTrackingValueInput("");
      setFrequencyConditions(
        (initialHabit.frequencyConditions || []).length > 0 // Defensive check
          ? (initialHabit.frequencyConditions || []).map(cond => ({ ...cond, count: cond.count === 0 ? "" : cond.count }))
          : [emptyCondition()]
      );
      setFineAmount(initialHabit.fineAmount === 0 ? "" : initialHabit.fineAmount);
      setYearlyGoalCount(initialHabit.yearlyGoal?.count === 0 ? "" : initialHabit.yearlyGoal?.count || ""); // Defensive check
      setContributingValues(initialHabit.yearlyGoal?.contributingValues || []); // Defensive check
      setAllowedOutOfControlMisses(initialHabit.allowedOutOfControlMisses === 0 ? "" : initialHabit.allowedOutOfControlMisses); // Set new field
      setHintText(initialHabit.hintText || ""); // Set new field
      setDayType(initialHabit.dayType || "hard");
      setAllowTemporaryHold(initialHabit.allowTemporaryHold ?? false);
      setIsDeactivated(initialHabit.isDeactivated ?? false);
      setRewardAmount(initialHabit.rewardAmount === 0 ? "" : initialHabit.rewardAmount);
      setAlertEmails(initialHabit.alertEmails || []);
      setAlertSubject(initialHabit.alertSubject || "");
      setAlertBody(initialHabit.alertBody || "");
    } else {
      // Reset form if no initial habit (e.g., closing modal)
      setHabitName("");
      setHabitColor("#4F46E5");
      setTempTrackingValues([]);
      setTrackingValueInput("");
      setFrequencyConditions([emptyCondition()]);
      setFineAmount("");
      setYearlyGoalCount("");
      setContributingValues([]);
      setAllowedOutOfControlMisses(""); // Reset new field
      setHintText(""); // Reset new field
      setDayType("hard");
      setAllowTemporaryHold(false);
      setIsDeactivated(false);
      setRewardAmount("");
      setAlertEmails([]);
      setAlertSubject("");
      setAlertBody("");
    }
  }, [initialHabit]);

  const handleAddNewTrackingValue = () => {
    const value = trackingValueInput.trim();
    if (value !== "" && !tempTrackingValues.includes(value)) {
      setTempTrackingValues((prev) => [...prev, value]);
      setTrackingValueInput("");
    }
  };

  const handleTrackingValueKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault(); // Prevent form submission if this input is part of a form
      handleAddNewTrackingValue();
    }
  };

  const removeTrackingValue = (valueToRemove: string) => {
    setTempTrackingValues((prev) => prev.filter((value) => value !== valueToRemove));
    setContributingValues((prev) => prev.filter((value) => value !== valueToRemove));
  };

  const handleContributingValueChange = (value: string, isChecked: boolean) => {
    setContributingValues((prev) =>
      isChecked ? [...prev, value] : prev.filter((v) => v !== value)
    );
  };

  const handleSave = () => {
    if (!initialHabit) return; // Should not happen if modal is open for editing

    if (!habitName.trim()) {
      showError("Habit name cannot be empty.");
      return;
    }

    const updatedHabit: Habit = {
      ...initialHabit,
      name: habitName.trim(),
      color: habitColor,
      trackingValues: tempTrackingValues,
      frequencyConditions: frequencyConditions
        .filter(cond => cond.trackingValue && cond.count !== "")
        .map(cond => ({ ...cond, count: Number(cond.count) })),
      fineAmount: typeof fineAmount === 'number' ? fineAmount : 0,
      rewardAmount: typeof rewardAmount === 'number' ? rewardAmount : 0,
      alertEmails,
      alertSubject: alertSubject.trim(),
      alertBody: alertBody.trim(),
      yearlyGoal: {
        count: typeof yearlyGoalCount === 'number' ? yearlyGoalCount : 0,
        contributingValues: contributingValues,
      },
      allowedOutOfControlMisses: typeof allowedOutOfControlMisses === 'number' ? allowedOutOfControlMisses : 0, // Save new field
      hintText: hintText.trim(), // Save new field
      dayType,
      allowTemporaryHold,
      isDeactivated,
      // created_at remains the same
    };

    onSave(updatedHabit);
    showSuccess("Habit updated successfully!");
    onClose();
  };

  if (!initialHabit) return null; // Don't render modal if no habit to edit

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Habit: {initialHabit.name}</DialogTitle>
          <DialogDescription>
            Make changes to your habit details.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Deactivate Habit — only offered when editing an existing habit */}
          <div className={`w-full flex items-center justify-between gap-4 text-left p-3 rounded-lg border ${isDeactivated ? "bg-amber-50 border-amber-300" : "bg-gray-50 border-gray-200"}`}>
            <label htmlFor="deactivate-habit-edit" className="flex-grow text-sm font-medium text-gray-800 cursor-pointer">
              Deactivate Habit
              <p className="text-xs text-gray-600 mt-1">
                Stops this habit appearing on the Daily Entries page and in any new entries.
                Nothing is deleted — its past tracking stays on the Recorded Entries page,
                and you can switch this back off any time.
              </p>
            </label>
            <Switch
              id="deactivate-habit-edit"
              checked={isDeactivated}
              onCheckedChange={setIsDeactivated}
            />
          </div>

          {/* Habit Name Input */}
          <div className="w-full">
            <label htmlFor="habit-name-edit" className="block text-sm font-medium text-gray-700 text-left">Habit Name</label>
            <input
              type="text"
              id="habit-name-edit"
              className="mt-1 p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
              value={habitName}
              onChange={(e) => setHabitName(e.target.value)}
            />
          </div>
          {/* Hint Text Input */}
          <div className="w-full">
            <label htmlFor="hint-text-edit" className="block text-sm font-medium text-gray-700 text-left">Hint Text (Optional)</label>
            <input
              type="text"
              id="hint-text-edit"
              placeholder="e.g., This habit needs 5 'Yes's"
              className="mt-1 p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
              value={hintText}
              onChange={(e) => setHintText(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1 text-left">A short reminder for this habit, displayed on the Daily Entries page.</p>
          </div>
          {/* Day Type + Temporary Hold */}
          <HabitDayTypeFields
            idSuffix="edit"
            dayType={dayType}
            onDayTypeChange={setDayType}
            allowTemporaryHold={allowTemporaryHold}
            onAllowTemporaryHoldChange={setAllowTemporaryHold}
          />
          {/* Color Picker Input */}
          <div className="w-full">
            <label htmlFor="habit-color-edit" className="block text-sm font-medium text-gray-700 text-left">Assign a Color</label>
            <input
              type="color"
              id="habit-color-edit"
              value={habitColor}
              onChange={(e) => setHabitColor(e.target.value)}
              className="mt-1 w-full h-10 p-1 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {/* Tracking Values Input */}
          <div className="w-full">
            <label htmlFor="tracking-values-edit" className="block text-sm font-medium text-gray-700 text-left">Tracking Values</label>
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                id="tracking-values-edit"
                placeholder="e.g., Water, 8 glasses"
                className="p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
                value={trackingValueInput}
                onChange={(e) => setTrackingValueInput(e.target.value)}
                onKeyDown={handleTrackingValueKeyDown}
              />
              <Button
                type="button"
                onClick={handleAddNewTrackingValue}
                className="shrink-0"
                disabled={!trackingValueInput.trim()}
              >
                Add
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1 text-left">Press Enter or click 'Add' to save a value.</p>
            <div id="tracking-values-container-edit" className="mt-2 flex flex-wrap gap-2 text-left">
              {tempTrackingValues.map((value, index) => (
                <span key={index} className="bg-blue-200 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded-full flex items-center space-x-1">
                  {value}
                  <button
                    type="button"
                    onClick={() => removeTrackingValue(value)}
                    className="ml-1 text-blue-800 hover:text-blue-900 focus:outline-none"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Conditions, Fine and Reward */}
          <HabitConditionsEditor
            idSuffix="edit"
            trackingValues={tempTrackingValues}
            conditions={frequencyConditions}
            onConditionsChange={setFrequencyConditions}
            fineAmount={fineAmount}
            onFineAmountChange={setFineAmount}
            rewardAmount={rewardAmount}
            onRewardAmountChange={setRewardAmount}
            availableEmails={availableEmails}
            alertEmails={alertEmails}
            onAlertEmailsChange={setAlertEmails}
            alertSubject={alertSubject}
            onAlertSubjectChange={setAlertSubject}
            alertBody={alertBody}
            onAlertBodyChange={setAlertBody}
            onError={showError}
          />

          {/* Allowed Out-of-Control Misses Section */}
          <div className="w-full">
            <label htmlFor="allowed-misses-edit" className="block text-sm font-medium text-gray-700 text-left">Allowed Yearly Out-of-Control Misses</label>
            <input
              type="number"
              id="allowed-misses-edit"
              placeholder="e.g., 3"
              className="mt-1 p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
              value={allowedOutOfControlMisses}
              onChange={(e) => setAllowedOutOfControlMisses(e.target.value === "" ? "" : Number(e.target.value))}
            />
            <p className="text-xs text-gray-500 mt-1 text-left">Number of times you can mark a miss as "out of control" per year without incurring a fine.</p>
          </div>

          {/* Yearly Goals Section */}
          <div className="w-full text-left">
            <label className="block text-sm font-medium text-gray-700">Yearly Goals</label>
            {/* Yearly Goal Count */}
            <div className="mt-2">
              <label htmlFor="yearly-goal-count-edit" className="block text-xs font-medium text-gray-500">Yearly Goal Count</label>
              <input
                type="number"
                id="yearly-goal-count-edit"
                placeholder="Enter a number"
                className="mt-1 p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
                value={yearlyGoalCount}
                onChange={(e) => setYearlyGoalCount(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
            {/* Contributing Values */}
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-500">Contributing Values</label>
              <div id="contributing-values-container-edit" className="mt-2 flex flex-wrap gap-2 text-left">
                {tempTrackingValues.map((value, index) => (
                  <label key={index} className="inline-flex items-center space-x-2 bg-gray-100 px-4 py-2 rounded-full text-sm font-medium text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      value={value}
                      className="form-checkbox rounded text-blue-600 focus:ring-blue-500 focus:ring-2 h-4 w-4 mr-2"
                      checked={contributingValues.includes(value)}
                      onChange={(e) => handleContributingValueChange(value, e.target.checked)}
                    />
                    {value}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditHabitModal;