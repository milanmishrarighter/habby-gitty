import { supabase } from "@/lib/supabase";
import { Habit } from "@/types/habit";
import { isSentinelTracking } from "@/utils/dayType";
import {
  HabitCondition,
  periodRangeFor,
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

/** How many times `trackingValue` was recorded for this habit in a date window. */
const countTrackingsInRange = async (
  habitId: string,
  trackingValue: string,
  start: string,
  end: string,
): Promise<number> => {
  const { data, error } = await supabase
    .from('daily_habit_tracking')
    .select('tracked_values')
    .eq('habit_id', habitId)
    .gte('date', start)
    .lte('date', end);

  if (error) {
    console.error("Error counting trackings for condition:", error);
    return 0;
  }

  return (data || []).reduce((total, record: { tracked_values: string[] }) => {
    // Week offs and temporary holds are deliberate skips — never counted.
    if (isSentinelTracking(record.tracked_values)) return total;
    return total + (record.tracked_values || []).filter(v => v === trackingValue).length;
  }, 0);
};

const sendAccountabilityEmail = async (
  habit: Habit,
  vars: Record<string, string | number>,
  alertKey: string,
  periodKey: string,
): Promise<string[]> => {
  const recipients = (habit.alertEmails || []).filter(Boolean);
  if (recipients.length === 0) return [];

  // The log is the source of truth for "already sent", so deleting or
  // re-evaluating a fine can never email the same person about it twice.
  const { data: existing, error: logReadError } = await supabase
    .from('habit_alert_log')
    .select('alert_key')
    .eq('alert_key', alertKey)
    .maybeSingle();

  if (logReadError) {
    console.error("Error reading alert log:", logReadError);
    return [];
  }
  if (existing) return [];

  const subject = renderTemplate(habit.alertSubject?.trim() || DEFAULT_ALERT_SUBJECT, vars);
  const body = renderTemplate(habit.alertBody?.trim() || DEFAULT_ALERT_BODY, vars);

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.error("Cannot send accountability email: no active session.");
    return [];
  }

  try {
    const response = await fetch('/api/send-accountability-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ to: recipients, subject, body }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("Accountability email failed:", response.status, detail);
      return [];
    }
  } catch (err) {
    console.error("Accountability email request failed:", err);
    return [];
  }

  // Only claim the alert once the send actually succeeded, so a transient
  // failure can be retried on the next evaluation.
  const { error: logWriteError } = await supabase
    .from('habit_alert_log')
    .insert([{
      alert_key: alertKey,
      habit_id: habit.id,
      period_key: periodKey,
      recipients,
      subject,
    }]);

  if (logWriteError) {
    console.error("Error writing alert log:", logWriteError);
  }

  return recipients;
};

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
): Promise<ConditionOutcomeSummary[]> => {
  // Tracker-only habits are recorded but never judged.
  if (habit.isTrackerOnly) return [];

  const results: ConditionOutcomeSummary[] = [];
  const conditions: HabitCondition[] = habit.frequencyConditions || [];

  for (let index = 0; index < conditions.length; index++) {
    const condition = conditions[index];
    if (!condition.trackingValue) continue;

    const period = periodRangeFor(date, condition.frequency);
    const key = autoKey(habit.id, index, period.key);
    const actualCount = await countTrackingsInRange(
      habit.id, condition.trackingValue, period.start, period.end,
    );
    const isMet = evaluateOperator(actualCount, condition.operator, condition.count);

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
    const amount = isFine ? (habit.fineAmount || 0) : (habit.rewardAmount || 0);
    const description =
      `${isFine ? 'Fine' : 'Reward'}: '${habit.name}' — ${condition.trackingValue} ` +
      `${condition.operator} ${condition.count} (${FREQUENCY_LABELS[condition.frequency].toLowerCase()}), ` +
      `actual ${actualCount}, for ${period.label}.`;

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
      emailedTo = await sendAccountabilityEmail(habit, {
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

  results.push(...await runOutOfControlMissForHabit(habit, date));
  return results;
};

/**
 * An out-of-control miss on a habit configured for it carries its own fine and
 * its own email, one per habit per date.
 */
const runOutOfControlMissForHabit = async (
  habit: Habit,
  date: string,
): Promise<ConditionOutcomeSummary[]> => {
  if (habit.isTrackerOnly || !habit.oocMissTriggersEmail) return [];

  const key = `${AUTO_PREFIX}:${habit.id}:OOC:${date}`;

  const { data: tracking } = await supabase
    .from('daily_habit_tracking')
    .select('is_out_of_control_miss')
    .eq('habit_id', habit.id)
    .eq('date', date)
    .maybeSingle();

  const isMiss = tracking?.is_out_of_control_miss === true;

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

  const emailedTo = await sendAccountabilityEmail(habit, {
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
): Promise<ConditionOutcomeSummary[]> => {
  const all: ConditionOutcomeSummary[] = [];
  for (const habit of habits) {
    for (const date of dates) {
      all.push(...await runConditionsForHabit(habit, date));
    }
  }
  return all;
};
