import { Habit } from "@/types/habit";
import { supabase } from "@/lib/supabase"; // Import supabase client

export const mapSupabaseHabitToHabit = (supabaseHabit: any): Habit => {
  const habitType = supabaseHabit.type || 'tracking'; // Default to 'tracking'

  return {
    id: supabaseHabit.id,
    name: supabaseHabit.name, // Corrected
    color: supabaseHabit.color, // Corrected
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
        contributingValues: supabaseHabit.yearly_goal?.contributingValues || [], // Corrected
      },
      allowedOutOfControlMisses: supabaseHabit.allowed_out_of_control_misses || 0, // Corrected
    }),
    hintText: supabaseHabit.hint_text || '', // Corrected
    created_at: supabaseHabit.created_at,
    userId: supabaseHabit.user_id, // Map user_id
  };
};