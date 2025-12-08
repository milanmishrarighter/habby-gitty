import { Habit } from "@/types/habit";

export const mapSupabaseHabitToHabit = (supabaseHabit: any): Habit => {
  const habitType = supabaseHabit.type || 'tracking'; // Default to 'tracking'

  return {
    id: supabaseHabit.id,
    name: supabase.habit.name,
    color: supabase.habit.color,
    type: habitType,
    // Only include trackingValues and frequencyConditions if type is 'tracking'
    ...(habitType === 'tracking' && {
      trackingValues: supabaseHabit.tracking_values || [],
      frequencyConditions: (supabaseHabit.frequency_conditions || []).map((cond: any) => ({
        trackingValue: cond.trackingValue,
        frequency: cond.frequency,
        count: cond.count,
      })),
      fineAmount: supabaseHabit.fine_amount || 0,
      yearlyGoal: {
        count: supabaseHabit.yearly_goal?.count || 0,
        contributingValues: supabase.habit.yearly_goal?.contributingValues || [],
      },
      allowedOutOfControlMisses: supabase.habit.allowed_out_of_control_misses || 0,
    }),
    hintText: supabase.habit.hint_text || '',
    created_at: supabase.habit.created_at,
  };
};