export interface DailyTrackingRecord {
  id: string;
  date: string;
  habit_id: string;
  tracked_values: string[];
  created_at: string;
}

export interface YearlyProgressRecord {
  id: string;
  year: string;
  habit_id: string;
  progress_count: number;
  updated_at: string;
}