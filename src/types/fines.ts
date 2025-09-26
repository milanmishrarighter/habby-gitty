export interface FineDetail {
  habitId: string;
  habitName: string;
  fineAmount: number;
  cause: string;
  status: 'paid' | 'unpaid';
  trackingValue: string; // The specific tracking value that caused the fine
  conditionCount: number; // The count from the frequency condition
  actualCount: number; // The actual count observed
}

export interface FinesPeriodData {
  [periodKey: string]: { // e.g., "2025-W39", "2025-09"
    [habitId: string]: FineDetail[]; // Array of fines for this habit in this period
  };
}