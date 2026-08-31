import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear,
  format, getISOWeek,
} from 'date-fns';

export type ConditionOperator = "==" | "<=" | ">=" | "<" | ">";
export type ConditionFrequency = "daily" | "weekly" | "monthly" | "yearly";
export type ConditionOutcome = "fine" | "reward";

export interface HabitCondition {
  trackingValue: string;
  operator: ConditionOperator;
  count: number;
  frequency: ConditionFrequency;
  outcome: ConditionOutcome;
}

export const CONDITION_OPERATORS: ConditionOperator[] = ["==", "<=", ">=", "<", ">"];
export const CONDITION_FREQUENCIES: ConditionFrequency[] = ["daily", "weekly", "monthly", "yearly"];

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  "==": "is exactly (==)",
  "<=": "is at most (<=)",
  ">=": "is at least (>=)",
  "<": "is fewer than (<)",
  ">": "is more than (>)",
};

export const FREQUENCY_LABELS: Record<ConditionFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

// Conditions saved before operators/outcomes existed behaved as "more than N,
// and that's a fine" — keep reading them that way.
export const normalizeCondition = (raw: any): HabitCondition => ({
  trackingValue: raw?.trackingValue ?? "",
  operator: (CONDITION_OPERATORS.includes(raw?.operator) ? raw.operator : ">") as ConditionOperator,
  count: Number(raw?.count) || 0,
  frequency: (CONDITION_FREQUENCIES.includes(raw?.frequency) ? raw.frequency : "weekly") as ConditionFrequency,
  outcome: raw?.outcome === "reward" ? "reward" : "fine",
});

export const evaluateOperator = (actual: number, operator: ConditionOperator, expected: number): boolean => {
  switch (operator) {
    case "==": return actual === expected;
    case "<=": return actual <= expected;
    case ">=": return actual >= expected;
    case "<": return actual < expected;
    case ">": return actual > expected;
    default: return false;
  }
};

export interface PeriodRange {
  start: string; // yyyy-MM-dd
  end: string;   // yyyy-MM-dd
  key: string;   // stable identifier used for de-duplicating fines/rewards
  label: string; // human readable, used in emails
}

export const periodRangeFor = (date: string, frequency: ConditionFrequency): PeriodRange => {
  const d = new Date(date);
  switch (frequency) {
    case "daily":
      return {
        start: format(d, 'yyyy-MM-dd'),
        end: format(d, 'yyyy-MM-dd'),
        key: format(d, 'yyyy-MM-dd'),
        label: format(d, 'd MMM yyyy'),
      };
    case "weekly":
      return {
        start: format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        end: format(endOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        key: `${format(d, 'yyyy')}-W${String(getISOWeek(d)).padStart(2, '0')}`,
        label: `week ${getISOWeek(d)} of ${format(d, 'yyyy')}`,
      };
    case "monthly":
      return {
        start: format(startOfMonth(d), 'yyyy-MM-dd'),
        end: format(endOfMonth(d), 'yyyy-MM-dd'),
        key: format(d, 'yyyy-MM'),
        label: format(d, 'MMMM yyyy'),
      };
    case "yearly":
      return {
        start: format(startOfYear(d), 'yyyy-MM-dd'),
        end: format(endOfYear(d), 'yyyy-MM-dd'),
        key: format(d, 'yyyy'),
        label: format(d, 'yyyy'),
      };
  }
};

export const describeCondition = (condition: HabitCondition): string =>
  `'${condition.trackingValue}' ${condition.operator} ${condition.count} (${FREQUENCY_LABELS[condition.frequency].toLowerCase()})`;

// --- Email templating ------------------------------------------------------

export const EMAIL_TAGS = [
  "{{habit_name}}",
  "{{fine_amount}}",
  "{{tracking_value}}",
  "{{operator}}",
  "{{condition_count}}",
  "{{actual_count}}",
  "{{frequency}}",
  "{{period}}",
  "{{date}}",
  "{{condition}}",
] as const;

export const DEFAULT_ALERT_SUBJECT = "Milan missed: {{habit_name}}";

export const DEFAULT_ALERT_BODY =
  `Hi,\n\n` +
  `This is an automated accountability note.\n\n` +
  `Habit: {{habit_name}}\n` +
  `Condition: {{condition}}\n` +
  `Actual: {{tracking_value}} was tracked {{actual_count}} time(s) in {{period}}\n` +
  `Fine incurred: Rs {{fine_amount}}\n\n` +
  `Please hold me to it.\n`;

export const renderTemplate = (template: string, vars: Record<string, string | number>): string =>
  template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match
  );
