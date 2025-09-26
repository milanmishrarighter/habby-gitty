"use client";

import React from "react";
import HabitCard from "@/components/HabitCard";
import { showSuccess, showError } from "@/utils/toast";

interface Habit {
  id: string; // Added unique ID
  name: string;
  color: string;
  trackingValues: string[];
  frequencyConditions: { trackingValue: string; frequency: string; count: number }[];
  fineAmount: number;
  yearlyGoal: {
    count: number; // This is the TARGET count
    contributingValues: string[];
  };
  createdAt: string; // Storing as string for simplicity with localStorage
}

interface FrequencyConditionInput {
  trackingValue: string;
  frequency: "weekly" | "monthly";
  count: number | "";
}

const MAX_FREQUENCY_CONDITIONS = 5;

const HabitSetup: React.FC = () => {
  const [habitName, setHabitName] = React.useState("");
  const [habitColor, setHabitColor] = React.useState("#4F46E5");
  const [tempTrackingValues, setTempTrackingValues] = React.useState<string[]>([]);
  const [trackingValueInput, setTrackingValueInput] = React.useState("");
  const [frequencyConditions, setFrequencyConditions] = React.useState<FrequencyConditionInput[]>([
    { trackingValue: "", frequency: "weekly", count: "" },
  ]);
  const [fineAmount, setFineAmount] = React.useState<number | "">("");
  const [yearlyGoalCount, setYearlyGoalCount] = React.useState<number | "">("");
  const [contributingValues, setContributingValues] = React.useState<string[]>([]);
  const [habits, setHabits] = React.useState<Habit[]>([]);

  // Load habits from localStorage on initial mount
  React.useEffect(() => {
    const storedHabits = localStorage.getItem('dailyJournalHabits');
    if (storedHabits) {
      setHabits(JSON.parse(storedHabits));
    }
  }, []);

  // Save habits to localStorage whenever the habits state changes
  React.useEffect(() => {
    localStorage.setItem('dailyJournalHabits', JSON.stringify(habits));
  }, [habits]);

  const addTrackingValue = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      const value = trackingValueInput.trim();
      if (value !== "" && !tempTrackingValues.includes(value)) {
        setTempTrackingValues((prev) => [...prev, value]);
        setTrackingValueInput("");
      }
    }
  };

  const removeTrackingValue = (valueToRemove: string) => {
    setTempTrackingValues((prev) => prev.filter((value) => value !== valueToRemove));
    setContributingValues((prev) => prev.filter((value) => value !== valueToRemove)); // Also remove from contributing if it was there
  };

  const handleFrequencyChange = (index: number, field: keyof FrequencyConditionInput, value: string | number) => {
    setFrequencyConditions((prev) =>
      prev.map((condition, i) =>
        i === index ? { ...condition, [field]: value } : condition
      )
    );
  };

  const addFrequencyCondition = () => {
    if (frequencyConditions.length < MAX_FREQUENCY_CONDITIONS) {
      setFrequencyConditions((prev) => [...prev, { trackingValue: "", frequency: "weekly", count: "" }]);
    } else {
      showError(`Maximum of ${MAX_FREQUENCY_CONDITIONS} frequency conditions reached.`);
    }
  };

  const removeFrequencyCondition = (indexToRemove: number) => {
    setFrequencyConditions((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  const handleContributingValueChange = (value: string, isChecked: boolean) => {
    setContributingValues((prev) =>
      isChecked ? [...prev, value] : prev.filter((v) => v !== value)
    );
  };

  const addHabit = () => {
    if (!habitName.trim()) {
      showError("Habit name cannot be empty.");
      return;
    }

    const newHabit: Habit = {
      id: crypto.randomUUID(), // Generate a unique ID
      name: habitName.trim(),
      color: habitColor,
      trackingValues: tempTrackingValues,
      frequencyConditions: frequencyConditions
        .filter(cond => cond.trackingValue && cond.count !== "")
        .map(cond => ({ ...cond, count: Number(cond.count) as number })),
      fineAmount: typeof fineAmount === 'number' ? fineAmount : 0,
      yearlyGoal: {
        count: typeof yearlyGoalCount === 'number' ? yearlyGoalCount : 0,
        contributingValues: contributingValues,
      },
      createdAt: new Date().toISOString(),
    };

    setHabits((prev) => [...prev, newHabit]);
    showSuccess("Habit added successfully!");

    // Reset form
    setHabitName("");
    setHabitColor("#4F46E5");
    setTempTrackingValues([]);
    setTrackingValueInput("");
    setFrequencyConditions([{ trackingValue: "", frequency: "weekly", count: "" }]);
    setFineAmount("");
    setYearlyGoalCount("");
    setContributingValues([]);
  };

  return (
    <div id="setup" className="tab-content text-center">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Habit Setup</h2>
      <p className="text-gray-600 mb-6">Create and assign a color to your habits to track them easily.</p>
      <div className="flex flex-col items-center justify-center space-y-4">
        {/* Habit Name Input */}
        <div className="w-full max-w-sm">
          <label htmlFor="habit-name" className="block text-sm font-medium text-gray-700 text-left">Habit Name</label>
          <input
            type="text"
            id="habit-name"
            className="mt-1 p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
            value={habitName}
            onChange={(e) => setHabitName(e.target.value)}
          />
        </div>
        {/* Color Picker Input */}
        <div className="w-full max-w-sm">
          <label htmlFor="habit-color" className="block text-sm font-medium text-gray-700 text-left">Assign a Color</label>
          <input
            type="color"
            id="habit-color"
            value={habitColor}
            onChange={(e) => setHabitColor(e.target.value)}
            className="mt-1 w-full h-10 p-1 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        {/* Tracking Values Input */}
        <div className="w-full max-w-sm">
          <label htmlFor="tracking-values" className="block text-sm font-medium text-gray-700 text-left">Tracking Values (Press Enter to save)</label>
          <input
            type="text"
            id="tracking-values"
            placeholder="e.g., Water, 8 glasses"
            className="mt-1 p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
            value={trackingValueInput}
            onChange={(e) => setTrackingValueInput(e.target.value)}
            onKeyDown={addTrackingValue}
          />
          <div id="tracking-values-container" className="mt-2 flex flex-wrap gap-2 text-left">
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

        {/* Tracking Frequency Section */}
        <div className="w-full max-w-lg text-left">
          <label className="block text-sm font-medium text-gray-700 mb-2">Tracking Frequency</label>
          <div id="frequency-container" className="flex flex-col gap-4">
            {frequencyConditions.map((condition, index) => (
              <div key={index} className="flex items-center gap-4">
                <select
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-value-select"
                  value={condition.trackingValue}
                  onChange={(e) => handleFrequencyChange(index, "trackingValue", e.target.value)}
                >
                  <option value="" disabled>Select tracking value</option>
                  {tempTrackingValues.map((value, idx) => (
                    <option key={idx} value={value}>{value}</option>
                  ))}
                </select>
                <select
                  className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={condition.frequency}
                  onChange={(e) => handleFrequencyChange(index, "frequency", e.target.value as "weekly" | "monthly")}
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                <input
                  type="number"
                  placeholder="Number"
                  className="w-28 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 numeric-value"
                  value={condition.count}
                  onChange={(e) => handleFrequencyChange(index, "count", e.target.value === "" ? "" : Number(e.target.value))}
                />
                {frequencyConditions.length > 1 && ( // Only show remove button if there's more than one condition
                  <button
                    type="button"
                    onClick={() => removeFrequencyCondition(index)}
                    className="text-red-500 hover:text-red-700 focus:outline-none p-2 rounded-full hover:bg-red-100"
                    aria-label="Remove frequency condition"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            id="add-frequency-button"
            className="mt-4 w-full bg-green-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            onClick={addFrequencyCondition}
          >
            + Add Another Frequency
          </button>
        </div>

        {/* Fine Amount Section */}
        <div className="w-full max-w-sm">
          <label htmlFor="fine-amount" className="block text-sm font-medium text-gray-700 text-left">Fine Amount</label>
          <input
            type="number"
            id="fine-amount"
            placeholder="Enter amount in Rupees"
            className="mt-1 p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
            value={fineAmount}
            onChange={(e) => setFineAmount(e.target.value === "" ? "" : Number(e.target.value))}
          />
        </div>

        {/* Yearly Goals Section */}
        <div className="w-full max-w-sm text-left">
          <label className="block text-sm font-medium text-gray-700">Yearly Goals</label>
          {/* Yearly Goal Count */}
          <div className="mt-2">
            <label htmlFor="yearly-goal-count" className="block text-xs font-medium text-gray-500">Yearly Goal Count</label>
            <input
              type="number"
              id="yearly-goal-count"
              placeholder="Enter a number"
              className="mt-1 p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
              value={yearlyGoalCount}
              onChange={(e) => setYearlyGoalCount(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </div>
          {/* Contributing Values */}
          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-500">Contributing Values</label>
            <div id="contributing-values-container" className="mt-2 flex flex-wrap gap-2 text-left">
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

        {/* Add Habit Button */}
        <button
          id="add-habit-button"
          className="px-6 py-3 bg-blue-600 text-white font-bold text-lg rounded-full shadow-lg hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50"
          onClick={addHabit}
        >
          Add Habit
        </button>
      </div>

      {/* Your Habits Section */}
      <div className="mt-8 pt-8 border-t border-gray-200">
        <h3 className="text-2xl font-bold text-gray-800 mb-4">Your Habits</h3>
        <div id="habits-list">
          {habits.length === 0 ? (
            <div id="empty-habits-placeholder" className="dotted-border-container">
              <p className="text-lg">No habits added yet. Create your first habit above!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {habits.map((habit) => (
                <HabitCard key={habit.id} habit={habit} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HabitSetup;