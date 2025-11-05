import { Habit } from "@/types/habit";

export const mapSupabaseHabitToHabit = (supabaseHabit: any): Habit => {
  return {
    id: supabaseHabit.id,
    name: supabaseHabit.name,
    color: supabaseHabit.color,
    trackingValues: supabaseHabit.tracking_values || [],
    frequencyConditions: (supabaseHabit.frequency_conditions || []).map((cond: any) => ({
      trackingValue: cond.trackingValue,
      frequency: cond.frequency,
      count: cond.count,
    })),
    fineAmount: supabaseHabit.fine_amount || 0,
    yearlyGoal: {
      count: supabaseHabit.yearly_goal?.count || 0,
      contributingValues: supabaseHabit.yearly_goal?.contributingValues || [],
    },
    allowedOutOfControlMisses: supabaseHabit.allowed_out_of_control_misses || 0, // Map new field
    hintText: supabaseHabit.hint_text || '', // Map new field
    created_at: supabaseHabit.created_at,
    sortOrder: supabaseHabit.sort_order || 0, // Map new field
  };
};