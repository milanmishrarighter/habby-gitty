import { supabase } from "@/lib/supabase";
import { Habit } from "@/types/habit";
import { isSentinelTracking, TEMP_HOLD } from "@/utils/trackingSentinels";
import { sendAlertEmail } from "@/utils/alertEmail";
import { HolidayRange, isHoliday, countHolidayDaysBetween, datesBetween } from "@/utils/holidays";
import { format } from "date-fns";
import {
  HabitCondition,
  periodRangeFor,
  previousPeriodRangeFor,
  isSettledEarly,
  resolveConditionAmount,
  resolveConditionRecipients,
  evaluateOperator,
  describeCondition,
  renderTemplate,
  FREQUENCY_LABELS,
  DEFAULT_ALERT_SUBJECT,
  DEFAULT_ALERT_BODY,
} from "@/utils/habitConditions";

const AUTO_PREFIX = "AUTO";

export interface ConditionOutcomeSummary {
  habitName: string;
  outcome: "fine" | "reward";
  amount: number;
  description: string;
  emailedTo: string[];
}

/** Stable key for one habit+condition+period, so re-evaluation never duplicates. */
const autoKey = (habitId: string, conditionIndex: number, periodKey: string) =>
  `${AUTO_PREFIX}:${habitId}:${conditionIndex}:${periodKey}`;

type TrackingRow = { date: string; tracked_values: string[] };

/** Every tracking record for this habit in a date window. */
const fetchTrackingsInRange = async (habitId: string, start: string, end: string): Promise<TrackingRow[]> => {
  const { data, error } = await supabase
    .from('daily_habit_tracking')
    .select('date, tracked_values')
    .eq('habit_id', habitId)
    .gte('date', start)
    .lte('date', end);

  if (error) {
    console.error("Error counting trackings for condition:", error);
    return [];
  }
  return (data || []).map((row: any) => ({ date: String(row.date).slice(0, 10), tracked_values: row.tracked_values || [] }));
};

/** How many times `trackingValue` was recorded across these rows. */
const countValue = (rows: TrackingRow[], trackingValue: string): number =>
  rows.reduce((total, record) => {
    // Week offs and temporary holds are deliberate skips — never counted.
    if (isSentinelTracking(record.tracked_values)) return total;
    return total + record.tracked_values.filter(v => v === trackingValue).length;
  }, 0);

interface HolidayVerdict {
  isMet: boolean;
  /** Appended to the fine's description when the holiday changed the judgement. */
  note?: string;
  /** The count the fine was actually judged on, when it differs from the raw one. */
  judgedCount?: number;
}

/**
 * Re-judges a met fine condition for a period that contains holiday days.
 * Holidays never produce a fine, and they shouldn't make one more likely either:
 *  - a period made up entirely of holidays is never fined;
 *  - "too many" fines (>, >=) ignore whatever was tracked on holiday days;
 *  - "not enough" fines (<, <=) scale the required count down to the share of
 *    the period that wasn't a holiday, rounded in your favour;
 *  - "exactly" fines can't be scaled sensibly, so the period is exempted.
 */
const judgeFineOverHolidays = (
  condition: HabitCondition,
  rows: TrackingRow[],
  holidays: HolidayRange[],
  period: { start: string; end: string },
  rawCount: number,
): HolidayVerdict => {
  const holidayDays = countHolidayDaysBetween(holidays, period.start, period.end);
  if (holidayDays === 0) return { isMet: true };

  const totalDays = datesBetween(period.start, period.end).length;
  const workingDays = totalDays - holidayDays;
  if (workingDays <= 0) return { isMet: false };
  if (condition.operator === '==') return { isMet: false };

  if (isSettledEarly(condition.operator)) {
    const count = countValue(rows.filter(row => !isHoliday(holidays, row.date)), condition.trackingValue);
    return {
      isMet: evaluateOperator(count, condition.operator, condition.count),
      judgedCount: count,
      note: `${holidayDays} holiday day${holidayDays === 1 ? '' : 's'} not counted.`,
    };
  }

  const required = condition.operator === '<' ? condition.count : condition.count + 1;
  const scaledRequired = Math.floor((required * workingDays) / totalDays);
  return {
    isMet: rawCount < scaledRequired,
    note: `needed ${scaledRequired} instead of ${required} because of ${holidayDays} holiday day${holidayDays === 1 ? '' : 's'}.`,
  };
};

/** Whether the habit was on temporary hold on any day in the window. */
const hasHoldInRange = async (habitId: string, start: string, end: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('daily_habit_tracking')
    .select('tracked_values')
    .eq('habit_id', habitId)
    .gte('date', start)
    .lte('date', end);

  if (error) {
    console.error("Error checking temporary holds:", error);
    return false;
  }

  return (data || []).some((record: { tracked_values: string[] }) =>
    (record.tracked_values || []).includes(TEMP_HOLD)
  );
};

const sendAccountabilityEmail = async (
  habit: Habit,
  recipientList: string[],
  vars: Record<string, string | number>,
  alertKey: string,
  periodKey: string,
): Promise<string[]> =>
  sendAlertEmail({
    recipients: recipientList,
    subject: renderTemplate(habit.alertSubject?.trim() || DEFAULT_ALERT_SUBJECT, vars),
    body: renderTemplate(habit.alertBody?.trim() || DEFAULT_ALERT_BODY, vars),
    alertKey,
    sourceId: habit.id,
    periodKey,
  });

/**
 * Evaluates every condition on a habit for the period(s) covering `date`.
 *
 * A met condition writes one row into fines_status; an unmet one removes any
 * row it wrote earlier, so correcting a tracking value cleans up after itself.
 * Fines additionally email the habit's accountability recipients, exactly once.
 */
export const runConditionsForHabit = async (
  habit: Habit,
  date: string,
  holidays: HolidayRange[] = [],
): Promise<ConditionOutcomeSummary[]> => {
  // Tracker-only habits are recorded but never judged, and a retired habit
  // stops accruing anything from the moment it is deactivated.
  if (habit.isTrackerOnly || habit.isDeactivated) return [];

  const results: ConditionOutcomeSummary[] = [];
  const conditions: HabitCondition[] = habit.frequencyConditions || [];

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  for (let index = 0; index < conditions.length; index++) {
    const condition = conditions[index];
    if (!condition.trackingValue) continue;

    // Judge the period this date falls in, and also the one that just closed —
    // otherwise a period that ended before the next entry was written would
    // never be judged at all.
    const candidatePeriods = [
      periodRangeFor(date, condition.frequency),
      previousPeriodRangeFor(date, condition.frequency),
    ].filter((period, i, all) => all.findIndex(p => p.key === period.key) === i);

    for (const period of candidatePeriods) {
    const key = autoKey(habit.id, index, period.key);
    const periodIsOver = period.end < todayStr;
    const periodRows = await fetchTrackingsInRange(habit.id, period.start, period.end);
    let actualCount = countValue(periodRows, condition.trackingValue);
    let isMet = evaluateOperator(actualCount, condition.operator, condition.count);
    let holidayNote: string | undefined;

    // "Fewer than / at most / exactly" can only be judged once the period has
    // finished — the count can still rise. Judging mid-period would fine you on
    // the 1st of the month for not having done something 4 times yet.
    if (!isSettledEarly(condition.operator) && !periodIsOver) {
      const { data: prematureRow } = await supabase
        .from('fines_status')
        .select('id')
        .eq('tracking_value', key)
        .maybeSingle();
      if (prematureRow) {
        await supabase.from('fines_status').delete().eq('id', prematureRow.id);
      }
      continue;
    }

    // A temporary hold can never produce a fine. Held days are already left out
    // of the count, but on a "not enough" condition (<, <=, ==) that lowered
    // count is exactly what trips the fine — so exempt the period outright.
    // Rewards are unaffected.
    if (isMet && condition.outcome === 'fine' && await hasHoldInRange(habit.id, period.start, period.end)) {
      isMet = false;
    }

    // No fine is ever calculated for a holiday. See judgeFineOverHolidays.
    if (isMet && condition.outcome === 'fine') {
      const verdict = judgeFineOverHolidays(condition, periodRows, holidays, period, actualCount);
      isMet = verdict.isMet;
      holidayNote = verdict.note;
      if (verdict.judgedCount !== undefined) actualCount = verdict.judgedCount;
    }

    const { data: existingRow } = await supabase
      .from('fines_status')
      .select('id')
      .eq('tracking_value', key)
      .maybeSingle();

    if (!isMet) {
      // Condition no longer holds — withdraw the automatic entry.
      if (existingRow) {
        await supabase.from('fines_status').delete().eq('id', existingRow.id);
      }
      continue;
    }

    const isFine = condition.outcome === 'fine';
    const amount = resolveConditionAmount(condition, habit.fineAmount, habit.rewardAmount);
    const description =
      `${isFine ? 'Fine' : 'Reward'}: '${habit.name}' — ${condition.trackingValue} ` +
      `${condition.operator} ${condition.count} (${FREQUENCY_LABELS[condition.frequency].toLowerCase()}), ` +
      `actual ${actualCount}, for ${period.label}.` +
      (holidayNote ? ` Holiday: ${holidayNote}` : '');

    if (!existingRow) {
      const { error } = await supabase.from('fines_status').insert([{
        type: condition.outcome,
        fine_amount: amount,
        cause: description,
        habit_id: habit.id,
        entry_date: period.end,
        status: 'unpaid',
        period_key: period.key,
        tracking_value: key,
        condition_count: condition.count,
        actual_count: actualCount,
        is_auto: true,
      }]);

      if (error) {
        console.error("Error recording automatic fine/reward:", error);
        continue;
      }
    } else {
      // Keep the recorded counts current if tracking changed but it still holds.
      await supabase
        .from('fines_status')
        .update({ fine_amount: amount, cause: description, actual_count: actualCount })
        .eq('id', existingRow.id);
    }

    let emailedTo: string[] = [];
    if (isFine) {
      emailedTo = await sendAccountabilityEmail(habit, resolveConditionRecipients(condition, habit.alertEmails || []), {
        habit_name: habit.name,
        fine_amount: amount,
        tracking_value: condition.trackingValue,
        operator: condition.operator,
        condition_count: condition.count,
        actual_count: actualCount,
        frequency: FREQUENCY_LABELS[condition.frequency].toLowerCase(),
        period: period.label,
        date,
        condition: describeCondition(condition),
      }, key, period.key);
    }

    results.push({
      habitName: habit.name,
      outcome: condition.outcome,
      amount,
      description,
      emailedTo,
    });
    }
  }

  results.push(...await runOutOfControlMissForHabit(habit, date, holidays));
  return results;
};

/**
 * An out-of-control miss on a habit configured for it carries its own fine and
 * its own email, one per habit per date.
 */
const runOutOfControlMissForHabit = async (
  habit: Habit,
  date: string,
  holidays: HolidayRange[],
): Promise<ConditionOutcomeSummary[]> => {
  if (habit.isTrackerOnly || habit.isDeactivated || !habit.oocMissTriggersEmail) return [];

  const key = `${AUTO_PREFIX}:${habit.id}:OOC:${date}`;

  const { data: tracking } = await supabase
    .from('daily_habit_tracking')
    .select('is_out_of_control_miss, tracked_values')
    .eq('habit_id', habit.id)
    .eq('date', date)
    .maybeSingle();

  // A held day is never fined, so it can't be an out-of-control miss either.
  // Neither is a holiday, which is never fined at all.
  const isHeld = (tracking?.tracked_values || []).includes(TEMP_HOLD);
  const isMiss = !isHeld && !isHoliday(holidays, date) && tracking?.is_out_of_control_miss === true;

  const { data: existingRow } = await supabase
    .from('fines_status')
    .select('id')
    .eq('tracking_value', key)
    .maybeSingle();

  if (!isMiss) {
    // The miss was undone — withdraw the automatic fine.
    if (existingRow) {
      await supabase.from('fines_status').delete().eq('id', existingRow.id);
    }
    return [];
  }

  const amount = habit.oocMissFineAmount || 0;
  const description = `Fine: '${habit.name}' — out-of-control miss on ${date}.`;

  if (!existingRow) {
    const { error } = await supabase.from('fines_status').insert([{
      type: 'fine',
      fine_amount: amount,
      cause: description,
      habit_id: habit.id,
      entry_date: date,
      status: 'unpaid',
      period_key: date,
      tracking_value: key,
      condition_count: 0,
      actual_count: 1,
      is_auto: true,
    }]);

    if (error) {
      console.error("Error recording out-of-control miss fine:", error);
      return [];
    }
  } else {
    await supabase
      .from('fines_status')
      .update({ fine_amount: amount, cause: description })
      .eq('id', existingRow.id);
  }

  const emailedTo = await sendAccountabilityEmail(habit, habit.alertEmails || [], {
    habit_name: habit.name,
    fine_amount: amount,
    tracking_value: "out-of-control miss",
    operator: "",
    condition_count: 0,
    actual_count: 1,
    frequency: "daily",
    period: date,
    date,
    condition: "an out-of-control miss was recorded",
  }, key, date);

  return [{ habitName: habit.name, outcome: 'fine', amount, description, emailedTo }];
};

export const runConditionsForHabits = async (
  habits: Habit[],
  dates: string[],
  holidays: HolidayRange[] = [],
): Promise<ConditionOutcomeSummary[]> => {
  const all: ConditionOutcomeSummary[] = [];
  for (const habit of habits) {
    for (const date of dates) {
      all.push(...await runConditionsForHabit(habit, date, holidays));
    }
  }
  return all;
};
