export interface DailyEntry {
  id: string; // Unique ID from Supabase
  date: string;
  text: string;
  mood: string;
  newLearningText?: string; // New field: What's something new you learned today
  timestamp: string;
}