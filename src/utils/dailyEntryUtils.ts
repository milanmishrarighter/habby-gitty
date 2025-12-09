import { DailyEntry } from "@/types/dailyEntry";

export const mapSupabaseEntryToDailyEntry = (supabaseEntry: any): DailyEntry => {
  const trimmedNewLearningText = supabaseEntry.new_learning_text ? String(supabaseEntry.new_learning_text).trim() : '';
  const trimmedMiscText = supabaseEntry.misc_text_tracking ? String(supabaseEntry.misc_text_tracking).trim() : '';
  return {
    id: supabaseEntry.id,
    date: supabaseEntry.date,
    text: supabaseEntry.text,
    mood: supabaseEntry.mood,
    newLearningText: trimmedNewLearningText === '' ? undefined : trimmedNewLearningText, // Map snake_case to camelCase, ensure undefined for empty
    timestamp: supabaseEntry.timestamp,
    miscTextTracking: trimmedMiscText === '' ? undefined : trimmedMiscText,
  };
};