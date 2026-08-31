import { Habit } from "@/types/habit";
import { DayType } from "@/utils/dayType";
import { normalizeCondition } from "@/utils/habitConditions";

export const mapSupabaseHabitToHabit = (supabaseHabit: any): Habit => {
  return {
    id: supabaseHabit.id,
    name: supabaseHabit.name,
    color: supabaseHabit.color,
    trackingValues: supabaseHabit.tracking_values || [],
    frequencyConditions: (supabaseHabit.frequency_conditions || []).map(normalizeCondition),
    fineAmount: supabaseHabit.fine_amount || 0,
    rewardAmount: supabaseHabit.reward_amount || 0,
    alertEmails: Array.isArray(supabaseHabit.alert_emails) ? supabaseHabit.alert_emails : [],
    alertSubject: supabaseHabit.alert_subject || '',
    alertBody: supabaseHabit.alert_body || '',
    yearlyGoal: {
      count: supabaseHabit.yearly_goal?.count || 0,
      contributingValues: supabaseHabit.yearly_goal?.contributingValues || [],
    },
    allowedOutOfControlMisses: supabaseHabit.allowed_out_of_control_misses || 0, // Map new field
    hintText: supabaseHabit.hint_text || '', // Map new field
    dayType: (supabaseHabit.day_type as DayType) || 'hard',
    allowTemporaryHold: supabaseHabit.allow_temporary_hold ?? false,
    isDeactivated: supabaseHabit.is_deactivated ?? false,
    created_at: supabaseHabit.created_at,
  };
};