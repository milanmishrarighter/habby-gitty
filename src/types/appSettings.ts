export interface AppSettings {
  id: string;
  settings_data: {
    yearly_week_offs_allowed?: number; // Retired: replaced by holidays
    yearly_holidays_allowed?: number;
    holiday_ranges?: { id: string; start: string; end: string }[];
    [key: string]: any; // Allows for future additional settings
  };
  created_at: string;
  updated_at: string;
}