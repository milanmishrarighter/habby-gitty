"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Trash2, Pencil, Check, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { DailyHealthRecord, SavedMeal, MealEntry, CalorieSettings, mapSupabaseSavedMeal } from "@/types/health";
import {
  calorieTotals, healthWarningsFor, AllowanceUsage,
  WEEKLY_MAINTAINING_ALLOWANCE, WEEKLY_TARGET_ALLOWANCE,
} from "@/utils/healthUtils";

interface HealthCardProps {
  record: DailyHealthRecord;
  onChange: (record: DailyHealthRecord) => void;
  settings: CalorieSettings;
  weekUsage: AllowanceUsage;
  /** More than one date means the same health entry is written to each of them. */
  dateCount: number;
}

const HealthCard: React.FC<HealthCardProps> = ({ record, onChange, settings, weekUsage, dateCount }) => {
  const [savedMeals, setSavedMeals] = React.useState<SavedMeal[]>([]);
  const [foodName, setFoodName] = React.useState("");
  const [minCalorie, setMinCalorie] = React.useState<number | "">("");
  const [maxCalorie, setMaxCalorie] = React.useState<number | "">("");
  const [saveThisMeal, setSaveThisMeal] = React.useState(false);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [editingMealId, setEditingMealId] = React.useState<string | null>(null);
  const [editMin, setEditMin] = React.useState<number | "">("");
  const [editMax, setEditMax] = React.useState<number | "">("");

  const loadSavedMeals = React.useCallback(async () => {
    const { data, error } = await supabase
      .from('saved_meals')
      .select('*')
      .order('food_name', { ascending: true });

    if (error) {
      console.error("Error loading saved meals:", error);
      return;
    }
    setSavedMeals((data || []).map(mapSupabaseSavedMeal));
  }, []);

  React.useEffect(() => {
    loadSavedMeals();
  }, [loadSavedMeals]);

  const suggestions = React.useMemo(() => {
    const query = foodName.trim().toLowerCase();
    if (!query) return [];
    return savedMeals.filter(meal => meal.foodName.toLowerCase().includes(query)).slice(0, 6);
  }, [foodName, savedMeals]);

  const applySuggestion = (meal: SavedMeal) => {
    setFoodName(meal.foodName);
    setMinCalorie(meal.minCalorie);
    setMaxCalorie(meal.maxCalorie);
    setShowSuggestions(false);
  };

  const addMeal = async () => {
    const name = foodName.trim();
    if (!name) {
      showError("Enter what you ate first.");
      return;
    }

    const meal: MealEntry = {
      foodName: name,
      minCalorie: typeof minCalorie === 'number' ? minCalorie : 0,
      maxCalorie: typeof maxCalorie === 'number' ? maxCalorie : 0,
    };

    if (meal.maxCalorie < meal.minCalorie) {
      showError("Max calories can't be lower than min calories.");
      return;
    }

    onChange({ ...record, meals: [...record.meals, meal] });

    if (saveThisMeal) {
      const { error } = await supabase
        .from('saved_meals')
        .upsert({
          food_name: name,
          min_calorie: meal.minCalorie,
          max_calorie: meal.maxCalorie,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'food_name' });

      if (error) {
        console.error("Error saving meal:", error);
        showError("Added to today, but couldn't save it for reuse.");
      } else {
        showSuccess(`'${name}' saved for reuse.`);
        loadSavedMeals();
      }
    }

    setFoodName("");
    setMinCalorie("");
    setMaxCalorie("");
    setSaveThisMeal(false);
  };

  const removeMeal = (index: number) => {
    onChange({ ...record, meals: record.meals.filter((_, i) => i !== index) });
  };

  const startEditSavedMeal = (meal: SavedMeal) => {
    setEditingMealId(meal.id);
    setEditMin(meal.minCalorie);
    setEditMax(meal.maxCalorie);
  };

  const saveEditedMeal = async (meal: SavedMeal) => {
    const { error } = await supabase
      .from('saved_meals')
      .update({
        min_calorie: typeof editMin === 'number' ? editMin : 0,
        max_calorie: typeof editMax === 'number' ? editMax : 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', meal.id);

    if (error) {
      console.error("Error updating saved meal:", error);
      showError("Failed to update the saved meal.");
      return;
    }
    setEditingMealId(null);
    loadSavedMeals();
    showSuccess(`'${meal.foodName}' updated.`);
  };

  const deleteSavedMeal = async (meal: SavedMeal) => {
    const { error } = await supabase.from('saved_meals').delete().eq('id', meal.id);
    if (error) {
      console.error("Error deleting saved meal:", error);
      showError("Failed to delete the saved meal.");
      return;
    }
    loadSavedMeals();
    showSuccess(`'${meal.foodName}' removed from saved meals.`);
  };

  const totals = calorieTotals(record.meals, record.caloriesBurned);
  const warnings = healthWarningsFor(record, settings, weekUsage);

  return (
    <div className="p-4 rounded-lg shadow-md flex flex-col space-y-4 bg-emerald-50 border border-emerald-200 text-left">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold text-gray-800">Health</h3>
        {dateCount > 1 && (
          <span className="bg-white/70 text-gray-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
            Applied to {dateCount} dates
          </span>
        )}
      </div>

      {/* Cheat day */}
      <label htmlFor="cheat-day" className="flex items-center justify-between gap-4 p-3 rounded-lg bg-white/70 cursor-pointer">
        <span className="flex-grow text-sm font-medium text-gray-800">
          Was today a cheat day?
          <span className="block text-xs text-gray-600 font-normal">
            {settings.cheatDay > 0
              ? `Calories shouldn't cross ${settings.cheatDay} kcal on a cheat day.`
              : "Set a cheat day limit in Settings."}
          </span>
        </span>
        <Switch
          id="cheat-day"
          checked={record.isCheatDay}
          onCheckedChange={(checked) => onChange({ ...record, isCheatDay: checked })}
        />
      </label>

      {/* Add a meal */}
      <div>
        <label htmlFor="food-eaten" className="block text-sm font-medium text-gray-700">Enter meal</label>
        <div className="mt-1 grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_auto] gap-2 items-start">
          <div className="relative">
            <input
              type="text"
              id="food-eaten"
              placeholder="Food eaten"
              autoComplete="off"
              className="p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
              value={foodName}
              onChange={(e) => { setFoodName(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMeal(); } }}
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {suggestions.map((meal) => (
                  <li key={meal.id}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm"
                      onClick={() => applySuggestion(meal)}
                    >
                      {meal.foodName}
                      <span className="ml-2 text-xs text-gray-500">
                        {meal.minCalorie}–{meal.maxCalorie} kcal
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <input
            type="number"
            placeholder="Min kcal"
            className="p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            value={minCalorie}
            onChange={(e) => setMinCalorie(e.target.value === "" ? "" : Number(e.target.value))}
          />
          <input
            type="number"
            placeholder="Max kcal"
            className="p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            value={maxCalorie}
            onChange={(e) => setMaxCalorie(e.target.value === "" ? "" : Number(e.target.value))}
          />
          <Button type="button" onClick={addMeal} className="shrink-0">Add</Button>
        </div>

        <label htmlFor="save-this-meal" className="flex items-center gap-2 mt-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            id="save-this-meal"
            className="form-checkbox rounded text-blue-600 focus:ring-blue-500 focus:ring-2 h-4 w-4"
            checked={saveThisMeal}
            onChange={(e) => setSaveThisMeal(e.target.checked)}
          />
          Save this meal for reuse
        </label>
      </div>

      {/* Today's meals */}
      {record.meals.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">Eaten today</p>
          <div className="space-y-1">
            {record.meals.map((meal, index) => (
              <div key={index} className="flex items-center justify-between bg-white/70 rounded-lg px-3 py-2">
                <span className="text-sm text-gray-800">{meal.foodName}</span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-gray-600">{meal.minCalorie}–{meal.maxCalorie} kcal</span>
                  <button
                    type="button"
                    onClick={() => removeMeal(index)}
                    className="text-gray-400 hover:text-red-600 focus:outline-none"
                    aria-label={`Remove ${meal.foodName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saved meals management */}
      {savedMeals.length > 0 && (
        <details className="bg-white/60 rounded-lg p-3">
          <summary className="text-sm font-medium text-gray-700 cursor-pointer">
            Saved meals ({savedMeals.length})
          </summary>
          <p className="text-xs text-gray-500 mt-1 mb-2">
            Editing calories here changes what gets suggested next time. Days already recorded keep the calories you entered then.
          </p>
          <div className="space-y-1">
            {savedMeals.map((meal) => (
              <div key={meal.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-white">
                <span className="text-sm text-gray-800 truncate">{meal.foodName}</span>
                {editingMealId === meal.id ? (
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      className="w-20 p-1 border border-gray-300 rounded text-sm"
                      value={editMin}
                      onChange={(e) => setEditMin(e.target.value === "" ? "" : Number(e.target.value))}
                    />
                    <input
                      type="number"
                      className="w-20 p-1 border border-gray-300 rounded text-sm"
                      value={editMax}
                      onChange={(e) => setEditMax(e.target.value === "" ? "" : Number(e.target.value))}
                    />
                    <button type="button" onClick={() => saveEditedMeal(meal)} className="text-green-600 hover:text-green-800" aria-label="Save">
                      <Check className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => setEditingMealId(null)} className="text-gray-400 hover:text-gray-600" aria-label="Cancel">
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                ) : (
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-600">{meal.minCalorie}–{meal.maxCalorie}</span>
                    <button type="button" onClick={() => startEditSavedMeal(meal)} className="text-gray-400 hover:text-blue-600" aria-label={`Edit ${meal.foodName}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => deleteSavedMeal(meal)} className="text-gray-400 hover:text-red-600 font-bold" aria-label={`Delete ${meal.foodName}`}>
                      &times;
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Calories burned */}
      <div>
        <label htmlFor="calories-burned" className="block text-sm font-medium text-gray-700">
          Lost any calorie due to exercise/walking?
        </label>
        <input
          type="number"
          id="calories-burned"
          placeholder="0"
          className="mt-1 p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
          value={record.caloriesBurned === 0 ? "" : record.caloriesBurned}
          onChange={(e) => onChange({ ...record, caloriesBurned: e.target.value === "" ? 0 : Number(e.target.value) })}
        />
        <p className="text-xs text-gray-500 mt-1">Subtracted from both the min and max totals.</p>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-green-100 border border-green-300">
          <p className="text-xs font-medium text-green-800">Approx. min</p>
          <p className="text-2xl font-bold text-green-700">{Math.round(totals.min)}</p>
        </div>
        <div className="p-3 rounded-lg bg-red-100 border border-red-300">
          <p className="text-xs font-medium text-red-800">Approx. max</p>
          <p className="text-2xl font-bold text-red-700">{Math.round(totals.max)}</p>
        </div>
      </div>

      {record.meals.length > 0 && (
        <p className="text-xs text-gray-600 -mt-2">
          Average of {Math.round(totals.average)} kcal is what the levels below are judged on.
          This week: {weekUsage.targetDays}/{WEEKLY_TARGET_ALLOWANCE} target days,
          {" "}{weekUsage.maintainingDays}/{WEEKLY_MAINTAINING_ALLOWANCE} maintaining days.
        </p>
      )}

      {warnings.map((warning, index) => (
        <div
          key={index}
          className={`p-2 rounded-md text-sm ${
            warning.tone === 'error' ? 'bg-red-100 text-red-800 border border-red-300'
              : warning.tone === 'ok' ? 'bg-green-100 text-green-800 border border-green-300'
                : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
          }`}
        >
          {warning.text}
        </div>
      ))}

      {/* Weight */}
      <div className="pt-3 border-t border-emerald-200">
        <label htmlFor="weight-checked" className="flex items-center justify-between gap-4 cursor-pointer">
          <span className="flex-grow text-sm font-medium text-gray-800">Did you check your weight today?</span>
          <Switch
            id="weight-checked"
            checked={record.weightChecked}
            onCheckedChange={(checked) => onChange({
              ...record,
              weightChecked: checked,
              weight: checked ? record.weight : null,
            })}
          />
        </label>
        {record.weightChecked && (
          <input
            type="number"
            step="0.1"
            placeholder="Weight (kg)"
            className="mt-2 p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            value={record.weight ?? ""}
            onChange={(e) => onChange({ ...record, weight: e.target.value === "" ? null : Number(e.target.value) })}
          />
        )}
      </div>
    </div>
  );
};

export default HealthCard;
