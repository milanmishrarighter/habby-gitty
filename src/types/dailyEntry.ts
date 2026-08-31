import { DayType } from "@/utils/dayType";

export interface DailyEntry {
  id: string; // Unique ID from Supabase
  date: string;
  text: string;
  mood: string;
  newLearningText?: string; // New field: What's something new you learned today
  timestamp: string;
  // New field: Misc. text tracking
  miscTextTracking?: string;
  dayType?: DayType; // Which kind of day this entry was recorded as
}