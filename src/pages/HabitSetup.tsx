"use client";

import React from "react";
import HabitCard from "@/components/HabitCard";
import DeleteConfirmationModal from "@/components/DeleteConfirmationModal";
import EditHabitModal from "@/components/EditHabitModal";
import { showSuccess, showError } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Habit } from "@/types/habit";
import { supabase } from "@/lib/supabase";
import { mapSupabaseHabitToHabit } from "@/utils/habitUtils"; // Import the new utility
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Import shadcn Select

interface FrequencyConditionInput {
  trackingValue: string;
  frequency: "weekly" | "monthly";
  count: number | "";
}

const MAX_FREQUENCY_CONDITIONS = 5;

const HabitSetup: React.FC = () => {
  const [habitName, setHabitName] = React.useState("");
  const [habitColor, setHabitColor] = React.useState("#4F46E5");
  const [habitType, setHabitType] = React.useState<'tracking' | 'text_field'>('tracking'); // New state for habit type
  const [tempTrackingValues, setTempTrackingValues] = React.useState<string[]>([]);
  const [trackingValueInput, setTrackingValueInput] = React.useState("");
  const [frequencyConditions, setFrequencyConditions] = React.useState<FrequencyConditionInput[]>([
    { trackingValue: "", frequency: "weekly", count: "" },
  ]);
  const [fineAmount, setFineAmount] = React.useState<number | "">("");
  const [yearlyGoalCount, setYearlyGoalCount] = React.useState<number | "">("");
  const [contributingValues, setContributingValues] = React.useState<string[]>([]);
  const [allowedOutOfControlMisses, setAllowedOutOfControlMisses] = React.useState<number | "">("");
  const [hintText, setHintText] = React.useState("");
  const [habits, setHabits] = React.useState<Habit[]>([]);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [habitToDelete, setHabitToDelete] = React.useState<{ id: string; name: string } | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [habitToEdit, setHabitToEdit] = React.useState<Habit | null>(null);
  const habitToScrollRef = React.useRef<string | null>(null);

  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Function to fetch habits from Supabase
  const fetchHabits = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error("Error fetching habits in HabitSetup:", error);
      setError("Failed to load habits. Please try again.");
      showError("Failed to load habits.");
    } else {
      const mappedHabits = (data || []).map(mapSupabaseHabitToHabit);
      setHabits(mappedHabits);
    }
    setIsLoading(false);
  }, []);

  // Load habits from Supabase on initial mount
  React.useEffect(() => {
    fetchHabits();
  }, [fetchHabits]);

  // Effect to scroll to the last edited habit after re-render
  React.useEffect(() => {
    if (habitToScrollRef.current) {
      setTimeout(() => {
        const element = document.getElementById(habitToScrollRef.current!);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        habitToScrollRef.current = null;
      }, 100);
    }
  }, [habits]);

  const resetForm = () => {
    setHabitName("");
    setHabitColor("#4F46E5");
    setHabitType("tracking"); // Reset habit type
    setTempTrackingValues([]);
    setTrackingValueInput("");
    setFrequencyConditions([{ trackingValue: "", frequency: "weekly", count: "" }]);
    setFineAmount("");
    setYearlyGoalCount("");
    setContributingValues([]);
    setAllowedOutOfControlMisses("");
    setHintText("");
  };

  const handleAddNewTrackingValue = () => {
    const value = trackingValueInput.trim();
    if (value !== "" && !tempTrackingValues.includes(value)) {
      setTempTrackingValues((prev) => [...prev, value]);
      setTrackingValueInput("");
    }
  };

  const handleTrackingValueKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddNewTrackingValue();
    }
  };

  const removeTrackingValue = (valueToRemove: string) => {
    setTempTrackingValues((prev) => prev.filter((value) => value !== valueToRemove));
    setContributingValues((prev) => prev.filter((value) => value !== valueToRemove));
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

  const handleAddHabit = async () => {
    if (!habitName.trim()) {
      showError("Habit name cannot be empty.");
      return;
    }

    const newHabitData: any = {
      name: habitName.trim(),
      color: habitColor,
      type: habitType,
      hint_text: habitType === 'tracking' ? hintText.trim() : null,
    };

    if (habitType === 'tracking') {
      newHabitData.tracking_values = tempTrackingValues;
      newHabitData.frequency_conditions = frequencyConditions
        .filter(cond => cond.trackingValue && cond.count !== "")
        .map(cond => ({ ...cond, count: Number(cond.count) as number }));
      newHabitData.fine_amount = typeof fineAmount === 'number' ? fineAmount : 0;
      newHabitData.yearly_goal = {
        count: typeof yearlyGoalCount === 'number' ? yearlyGoalCount : 0,
        contributingValues: contributingValues,
      };
      newHabitData.allowed_out_of_control_misses = typeof allowedOutOfControlMisses === 'number' ? allowedOutOfControlMisses : 0;
    } else {
      // Explicitly set tracking-related fields to null/default for 'text_field' type
      newHabitData.tracking_values = null;
      newHabitData.frequency_conditions = null;
      newHabitData.fine_amount = 0; // Assuming 0 is a valid default for fineAmount
      newHabitData.yearly_goal = null;
      newHabitData.allowed_out_of_control_misses = 0; // Assuming 0 is a valid default
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from('habits')
      .insert([newHabitData])
      .select();

    if (error) {
      console.error("Error adding habit:", error);
      showError("Failed to add habit.");
    } else if (data && data.length > 0) {
      const addedHabit = mapSupabaseHabitToHabit(data[0]);
      setHabits((prev) => [...prev, addedHabit]);
      habitToScrollRef.current = addedHabit.id;
      showSuccess("Habit added successfully!");
      resetForm();
    }
    setIsLoading(false);
  };

  const handleEditHabitClick = (habit: Habit) => {
    setHabitToEdit(habit);
    setIsEditModalOpen(true);
    habitToScrollRef.current = habit.id;
  };

  const handleSaveEditedHabit = async (updatedHabit: Habit) => {
    const { id, name, color, type, trackingValues, frequencyConditions, fineAmount, yearlyGoal, allowedOutOfControlMisses, hintText, created_at } = updatedHabit;
    
    const updatedHabitData: any = { // Use 'any' for now to handle conditional properties
      name,
      color,
      type, // Include type in update
      hint_text: type === 'tracking' ? hintText : null, // Only save hint text for 'tracking' type
      created_at,
    };

    if (type === 'tracking') {
      updatedHabitData.tracking_values = trackingValues;
      updatedHabitData.frequency_conditions = frequencyConditions;
      updatedHabitData.fine_amount = fineAmount;
      updatedHabitData.yearly_goal = yearlyGoal;
      updatedHabitData.allowed_out_of_control_misses = allowedOutOfControlMisses;
    } else {
      // If type is 'text_field', ensure tracking-specific fields are null/default
      updatedHabitData.tracking_values = null;
      updatedHabitData.frequency_conditions = null;
      updatedHabitData.fine_amount = 0;
      updatedHabitData.yearly_goal = null;
      updatedHabitData.allowed_out_of_control_misses = 0;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from('habits')
      .update(updatedHabitData)
      .eq('id', id)
      .select();

    if (error) {
      console.error("Error updating habit:", error);
      showError("Failed to update habit.");
    } else if (data && data.length > 0) {
      setHabits((prev) => prev.map(h => h.id === id ? mapSupabaseHabitToHabit(data[0]) : h));
      showSuccess("Habit updated successfully!");
    }
    setIsLoading(false);
  };

  const handleDeleteClick = (id: string, name: string) => {
    setHabitToDelete({ id, name });
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteHabit = async () => {
    if (!habitToDelete) return;

    const idToDelete = habitToDelete.id;

    setIsLoading(true);

    // Delete habit from Supabase
    const { error: habitDeleteError } = await supabase
      .from('habits')
      .delete()
      .eq('id', idToDelete);

    if (habitDeleteError) {
      console.error("Error deleting habit:", habitDeleteError);
      showError("Failed to delete habit.");
      setIsLoading(false);
      return;
    }

    // Delete associated daily habit tracking records
    const { error: trackingDeleteError } = await supabase
      .from('daily_habit_tracking')
      .delete()
      .eq('habit_id', idToDelete);

    if (trackingDeleteError) {
      console.error("Error deleting associated daily tracking:", trackingDeleteError);
      showError("Failed to delete associated daily tracking data.");
    }

    // Delete associated yearly habit progress records
    const { error: progressDeleteError } = await supabase
      .from('yearly_habit_progress')
      .delete()
      .eq('habit_id', idToDelete);

    if (progressDeleteError) {
      console.error("Error deleting associated yearly progress:", progressDeleteError);
      showError("Failed to delete associated yearly progress data.");
    }

    // Delete associated fines status records
    const { error: finesDeleteError } = await supabase
      .from('fines_status')
      .delete()
      .eq('habit_id', idToDelete);

    if (finesDeleteError) {
      console.error("Error deleting associated fines status:", finesDeleteError);
      showError("Failed to delete associated fines data.");
    }

    // Delete associated yearly out of control miss counts
    const { error: missCountsDeleteError } = await supabase
      .from('yearly_out_of_control_miss_counts')
      .delete()
      .eq('habit_id', idToDelete);

    if (missCountsDeleteError) {
      console.error("Error deleting associated yearly out of control miss counts:", missCountsDeleteError);
      showError("Failed to delete associated out of control miss data.");
    }

    // Remove habit from local state
    setHabits(prev => prev.filter(h => h.id !== idToDelete));

    showSuccess(`Habit '${habitToDelete.name}' and its associated data deleted successfully!`);
    setIsDeleteModalOpen(false);
    setHabitToDelete(null);
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-lg text-gray-600">Loading habits...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        <p className="text-lg">{error}</p>
        <Button onClick={fetchHabits} className="mt-4">Retry Loading Habits</Button>
      </div>
    );
  }

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
        {/* Habit Type Selector */}
        <div className="w-full max-w-sm">
          <label htmlFor="habit-type" className="block text-sm font-medium text-gray-700 text-left">Habit Type</label>
          <Select value={habitType} onValueChange={(value: 'tracking' | 'text_field') => {
            setHabitType(value);
            if (value === 'text_field') {
              setHintText(""); // Clear hint text when switching to text_field
            }
          }}>
            <SelectTrigger className="w-full mt-1">
              <SelectValue placeholder="Select habit type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tracking">Tracking (Values, Frequency, Goals)</SelectItem>
              <SelectItem value="text_field">Free Text Field</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500 mt-1 text-left">
            Choose 'Tracking' for habits with specific values/goals, or 'Free Text Field' for open-ended entries.
          </p>
        </div>
        {/* Hint Text Input - Conditionally rendered */}
        {habitType === 'tracking' && (
          <div className="w-full max-w-sm">
            <label htmlFor="hint-text" className="block text-sm font-medium text-gray-700 text-left">Hint Text (Optional)</label>
            <input
              type="text"
              id="hint-text"
              placeholder="e.g., This habit needs 5 'Yes's"
              className="mt-1 p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
              value={hintText}
              onChange={(e) => setHintText(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1 text-left">A short reminder for this habit, displayed on the Daily Entries page.</p>
          </div>
        )}
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

        {habitType === 'tracking' && (
          <>
            {/* Tracking Values Input */}
            <div className="w-full max-w-sm">
              <label htmlFor="tracking-values" className="block text-sm font-medium text-gray-700 text-left">Tracking Values</label>
              <div className="flex gap-2 mt-1">
                <input
                  type="text"
                  id="tracking-values"
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-value-select text-gray-900 bg-white"
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
                    {frequencyConditions.length > 1 && (
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

            {/* Allowed Out-of-Control Misses Section */}
            <div className="w-full max-w-sm">
              <label htmlFor="allowed-misses" className="block text-sm font-medium text-gray-700 text-left">Allowed Yearly Out-of-Control Misses</label>
              <input
                type="number"
                id="allowed-misses"
                placeholder="e.g., 3"
                className="mt-1 p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
                value={allowedOutOfControlMisses}
                onChange={(e) => setAllowedOutOfControlMisses(e.target.value === "" ? "" : Number(e.target.value))}
              />
              <p className="text-xs text-gray-500 mt-1 text-left">Number of times you can mark a miss as "out of control" per year without incurring a fine.</p>
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
          </>
        )}

        {/* Add Habit Button */}
        <div className="flex justify-center mt-4">
          <button
            id="add-habit-button"
            className="px-6 py-3 bg-blue-600 text-white font-bold text-lg rounded-full shadow-lg hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50"
            onClick={handleAddHabit}
            disabled={isLoading}
          >
            {isLoading ? "Adding..." : "Add Habit"}
          </button>
        </div>
      </div>

      {/* Your Habits Section */}
      <div className="mt-8 pt-8 border-t border-gray-200">
        <h3 className="text-2xl font-bold text-gray-800 mb-4">Your Habits</h3>
        <div id="habits-list" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {habits.length === 0 ? (
            <div id="empty-habits-placeholder" className="dotted-border-container col-span-full">
              <p className="text-lg">No habits added yet. Create your first habit above!</p>
            </div>
          ) : (
            habits.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                onEdit={handleEditHabitClick}
                onDelete={handleDeleteClick}
              />
            ))
          )}
        </div>
      </div>

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDeleteHabit}
        itemToDeleteName={habitToDelete ? `the habit "${habitToDelete.name}"` : "this habit"}
      />

      <EditHabitModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        initialHabit={habitToEdit}
        onSave={handleSaveEditedHabit}
      />
    </div>
  );
};

export default HabitSetup;