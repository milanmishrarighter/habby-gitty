import { supabase } from "@/lib/supabase";

export interface AlertEmailInput {
  recipients: string[];
  subject: string;
  body: string;
  /** Unique per alert. Once logged as sent it is never sent again. */
  alertKey: string;
  /** What the alert is about: a habit id, or a label such as "HEALTH". */
  sourceId: string;
  periodKey: string;
}

/**
 * Sends one accountability email through /api/send-accountability-email and
 * logs it in habit_alert_log. Returns who it went to; empty when nothing was
 * sent (no recipients, already sent, or the send failed).
 */
export const sendAlertEmail = async (input: AlertEmailInput): Promise<string[]> => {
  const recipients = (input.recipients || []).filter(Boolean);
  if (recipients.length === 0) return [];

  // The log is the source of truth for "already sent", so deleting or
  // re-evaluating a fine can never email the same person about it twice.
  const { data: existing, error: logReadError } = await supabase
    .from('habit_alert_log')
    .select('alert_key')
    .eq('alert_key', input.alertKey)
    .maybeSingle();

  if (logReadError) {
    console.error("Error reading alert log:", logReadError);
    return [];
  }
  if (existing) return [];

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
      body: JSON.stringify({ to: recipients, subject: input.subject, body: input.body }),
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
      alert_key: input.alertKey,
      habit_id: input.sourceId,
      period_key: input.periodKey,
      recipients,
      subject: input.subject,
    }]);

  if (logWriteError) {
    console.error("Error writing alert log:", logWriteError);
  }

  return recipients;
};
