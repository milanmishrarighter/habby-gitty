export interface DailyEntry {
  id: string; // Unique ID from Supabase
  date: string;
  text: string;
  mood: string;
  timestamp: string;
}