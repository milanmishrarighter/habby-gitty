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

/**
 * Whether a condition can be judged before its period is over.
 *
 * A count only ever grows as a period runs. So "more than N" and "at least N"
 * are settled the moment they become true — no later day can undo them. Every
 * other operator ("fewer than", "at most", "exactly") is only meaningful once
 * the period has finished, because the count still has room to rise.
 */
export const isSettledEarly = (operator: ConditionOperator): boolean =>
  operator === ">" || operator === ">=";

/** The period immediately before the one containing `date`. */
export const previousPeriodRangeFor = (date: string, frequency: ConditionFrequency): PeriodRange => {
  const current = periodRangeFor(date, frequency);
  const dayBefore = new Date(current.start);
  dayBefore.setDate(dayBefore.getDate() - 1);
  return periodRangeFor(format(dayBefore, 'yyyy-MM-dd'), frequency);
};

export const describeCondition = (condition: HabitCondition): string =>
  `'${condition.trackingValue}' ${condition.operator} ${condition.count} (${FREQUENCY_LABELS[condition.frequency].toLowerCase()})`;

// --- Per-value status chips ------------------------------------------------

export interface ValueStatus {
  text: string;
  tone: "reward" | "fine" | "neutral";
}

/**
 * What this tracking value is worth right now: how many more are needed to earn
 * a reward, and how many more can be afforded before a fine. Far more useful on
 * the card than a raw week/month tally.
 *
 * Only weekly and monthly conditions are described, because those are the only
 * counts the card is given.
 */
export const describeValueStatus = (
  conditions: HabitCondition[],
  value: string,
  weeklyCount: number,
  monthlyCount: number,
): ValueStatus[] => {
  const statuses: ValueStatus[] = [];

  conditions.forEach(condition => {
    if (condition.trackingValue !== value) return;
    if (condition.frequency !== 'weekly' && condition.frequency !== 'monthly') return;

    const actual = condition.frequency === 'weekly' ? weeklyCount : monthlyCount;
    const period = condition.frequency === 'weekly' ? 'wk' : 'mo';
    const isReward = condition.outcome === 'reward';
    const tone = isReward ? 'reward' : 'fine';
    const met = evaluateOperator(actual, condition.operator, condition.count);

    switch (condition.operator) {
      case '>=':
      case '>': {
        // Count has to climb to reach the target.
        const target = condition.operator === '>' ? condition.count + 1 : condition.count;
        const remaining = Math.max(0, target - actual);
        if (isReward) {
          statuses.push(remaining === 0
            ? { text: `reward earned this ${period}`, tone: 'reward' }
            : { text: `${remaining} more this ${period} → reward`, tone: 'reward' });
        } else {
          statuses.push(met
            ? { text: `fined this ${period}`, tone: 'fine' }
            : { text: `${remaining - 1} more allowed this ${period}`, tone: 'fine' });
        }
        break;
      }
      case '<':
      case '<=': {
        // Count has to reach a floor by the end of the period to stay safe.
        const floor = condition.operator === '<' ? condition.count : condition.count + 1;
        const remaining = Math.max(0, floor - actual);
        if (isReward) {
          statuses.push(met
            ? { text: `reward if the ${period} ends here`, tone: 'reward' }
            : { text: `too many for the reward this ${period}`, tone: 'neutral' });
        } else {
          statuses.push(remaining === 0
            ? { text: `safe this ${period}`, tone: 'neutral' }
            : { text: `need ${remaining} more this ${period} to avoid fine`, tone: 'fine' });
        }
        break;
      }
      case '==': {
        const label = isReward ? 'reward' : 'fine';
        statuses.push(met
          ? { text: `exactly ${condition.count} → ${label} if the ${period} ends here`, tone }
          : { text: `${actual}/${condition.count} this ${period} for ${label}`, tone: 'neutral' });
        break;
      }
    }
  });

  return statuses;
};

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

export const DEFAULT_ALERT_SUBJECT = "Milan Missed a Habit. He Needs to Pay Up!";

export const DEFAULT_ALERT_BODY =
  `Milan Missed his Habit Name:{{habit_name}}\n` +
  `He Needs to Pay you: {{fine_amount}}\n\n` +
  `Make Sure He Pays Up. You are his assigned Accountability Partner!\n`;

export const renderTemplate = (template: string, vars: Record<string, string | number>): string =>
  template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match
  );
