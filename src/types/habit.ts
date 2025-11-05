export interface Habit {
  id: string;
  name: string;
  color: string;
  trackingValues: string[];
  frequencyConditions: { trackingValue: string; frequency: "weekly" | "monthly"; count: number }[];
  fineAmount: number;
  yearlyGoal: {
    count: number;
    contributingValues: string[];
  };
  allowedOutOfControlMisses: number; // New field for yearly allowed misses
  hintText?: string; // New field for hint text
  created_at: string; // Changed to match Supabase's default column name and type
  sortOrder: number; // New field for manual sorting
}