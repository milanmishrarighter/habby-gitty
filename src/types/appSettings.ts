export interface AppSettings {
  id: string;
  settings_data: {
    yearly_week_offs_allowed: number;
    yearly_nothings_allowed: number; // New field
    [key: string]: any; // Allows for future additional settings
  };
  created_at: string;
  updated_at: string;
}