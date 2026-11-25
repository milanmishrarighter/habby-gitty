import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { supabase } from "./supabase";

// Habby's public deployment. Its email route sends through Brevo and only
// accepts signed-in users of the same Supabase project.
export const EMAIL_API_URL = "https://habby-gitty.vercel.app/api/send-accountability-email";

/**
 * Sends one email, at most once per `alertKey` (logged in Habby's
 * habit_alert_log). Returns who it went to; empty if nothing was sent.
 */
export const sendOnce = async (input: {
  alertKey: string; periodKey: string; recipients: string[]; subject: string; body: string;
}): Promise<string[]> => {
  const recipients = input.recipients.filter(Boolean);
  if (recipients.length === 0) return [];

  const { data: logged, error: logError } = await supabase
    .from("habit_alert_log").select("alert_key").eq("alert_key", input.alertKey).maybeSingle();
  if (logError) throw new Error(logError.message);
  if (logged) return recipients; // Already sent on an earlier run.

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in.");

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` };
  const payload = { to: recipients, subject: input.subject, body: input.body };

  // On the phone the request goes out natively, which side-steps the browser's
  // cross-origin rules that would otherwise block a call to another site.
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.post({ url: EMAIL_API_URL, headers, data: payload });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Email failed (${response.status}): ${JSON.stringify(response.data)}`);
    }
  } else {
    const response = await fetch(EMAIL_API_URL, { method: "POST", headers, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error(`Email failed (${response.status}): ${await response.text()}`);
  }

  const { error } = await supabase.from("habit_alert_log").insert([{
    alert_key: input.alertKey,
    habit_id: "LOSER_TRACKER",
    period_key: input.periodKey,
    recipients,
    subject: input.subject,
  }]);
  if (error) console.error("Couldn't log the sent email:", error);
  return recipients;
};

export const render = (template: string, vars: Record<string, string | number>) =>
  template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
