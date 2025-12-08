export interface DailyTrackingRecord {
  id: string;
  date: string;
  habit_id: string;
  tracked_values?: string[]; // Made optional, will be used for 'tracking' type habits
  text_value?: string; // New field for 'text_field' type habits
  is_out_of_control_miss: boolean; // New field
  created_at: string;
}

export interface YearlyProgressRecord {
  id: string;
  year: string;
  habit_id: string;
  progress_count: number;
  updated_at: string;
}

export interface YearlyOutOfControlMissCount {
  id: string;
  habit_id: string;
  year: string;
  used_count: number;
  created_at: string;
}

export interface WeeklyOffRecord {
  id: string;
  year: string;
  week_number: number; // ISO week number (1-53)
  is_off: boolean;
  created_at: string;
}

export interface YearlyNothingsCount {
  id: string;
  user_id: string;
  year: string;
  count: number;
  created_at: string;
  updated_at: string;
}