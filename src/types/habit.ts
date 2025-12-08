export interface Habit {
  id: string;
  name: string;
  color: string;
  type: 'tracking' | 'text_field'; // New field: 'tracking' for values/frequency, 'text_field' for free text
  trackingValues?: string[]; // Made optional
  frequencyConditions?: { trackingValue: string; frequency: "weekly" | "monthly"; count: number }[]; // Made optional
  fineAmount?: number; // Made optional
  yearlyGoal?: { // Made optional
    count: number;
    contributingValues: string[];
  };
  allowedOutOfControlMisses?: number; // Made optional
  hintText?: string; // New field for hint text
  created_at: string; // Changed to match Supabase's default column name and type
}