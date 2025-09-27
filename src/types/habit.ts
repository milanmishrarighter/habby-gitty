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
  created_at: string; // Changed to match Supabase's default column name and type
}