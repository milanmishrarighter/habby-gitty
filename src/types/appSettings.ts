export interface AppSettings {
  id: string;
  settings_data: {
    yearly_week_offs_allowed: number;
    [key: string]: any; // Allows for future additional settings
  };
  created_at: string;
  updated_at: string;
}