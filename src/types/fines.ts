export type FineRewardType = "fine" | "reward";

export interface FineRewardEntry {
  id: string; // Unique ID from Supabase
  type: FineRewardType;
  amount: number; // Always a positive number; sign is derived from `type`
  description: string;
  habitId: string | null; // null when not tied to a specific habit
  habitName: string | null;
  date: string; // yyyy-MM-dd, the date the fine/reward applies to
  created_at: string;
  isAuto?: boolean; // Created by a habit condition rather than entered by hand
}
