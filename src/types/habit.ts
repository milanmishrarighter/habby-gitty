import { DayType } from "@/utils/dayType";
import { HabitCondition } from "@/utils/habitConditions";

export interface Habit {
  id: string;
  name: string;
  color: string;
  trackingValues: string[];
  frequencyConditions: HabitCondition[];
  fineAmount: number;
  rewardAmount: number;
  alertEmails: string[]; // Accountability recipients, chosen from Settings
  alertSubject: string;
  alertBody: string;
  yearlyGoal: {
    count: number;
    contributingValues: string[];
  };
  allowedOutOfControlMisses: number; // New field for yearly allowed misses
  hintText?: string; // New field for hint text
  dayType: DayType; // Which day types this habit is required on
  allowTemporaryHold: boolean; // Whether this habit may be put on temporary hold
  isDeactivated: boolean; // Retired: hidden from Daily Entries, history retained
  created_at: string; // Changed to match Supabase's default column name and type
}