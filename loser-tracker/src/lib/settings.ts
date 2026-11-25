import { supabase } from "./supabase";
import { Limits } from "./cycles";

/** A fine whose recovery month has ended, recorded once and never re-judged. */
export interface LedgerEntry {
  month: number;   // the month that went over (0-based)
  start: string;   // that month's dates, for the email and the History tab
  end: string;
  over: number;
  fine: number;
  recovered: number;
  owed: number;
  resolvedAt: string;
  emailedTo: string[];
  emailedAt: string | null;
}

export interface LoserSettings extends Limits {
  cycleStart: string;      // a Monday; month 1 starts here
  finePerCalorie: number;  // ₹ per calorie over the monthly limit
  fineEmails: string[];
  emailSubject: string;
  emailBody: string;
  ledger: Record<string, LedgerEntry>;
}

// Stored in Habby's app_settings row, under its own key.
const KEY = "loser_tracker";

export const EMAIL_TAGS = ["{{owed}}", "{{fine}}", "{{over}}", "{{recovered}}", "{{period}}", "{{limit}}"];

export const DEFAULT_SETTINGS: LoserSettings = {
  weekdayLimit: 0,
  saturdayLimit: 0,
  sundayLimit: 0,
  weeklyLimit: 0,
  monthlyLimit: 0,
  cycleStart: "2026-11-30",
  finePerCalorie: 10,
  fineEmails: [],
  emailSubject: "Milan blew his calorie budget. He owes you ₹{{owed}}",
  emailBody:
    "Milan went over his monthly calorie limit of {{limit}} by {{over}} calories ({{period}}).\n" +
    "That's a ₹{{fine}} fine. He had the next month to win it back and only recovered ₹{{recovered}}.\n\n" +
    "He owes you ₹{{owed}}.\n\n" +
    "Make sure he pays up. You are his assigned accountability partner!",
  ledger: {},
};

export interface SettingsBundle {
  settings: LoserSettings;
  /** Habby's accountability emails, offered as quick picks. */
  habbyEmails: string[];
}

const merge = (raw: any): LoserSettings => ({
  ...DEFAULT_SETTINGS,
  ...(raw && typeof raw === "object" ? raw : {}),
  ledger: { ...(raw?.ledger || {}) },
  fineEmails: Array.isArray(raw?.fineEmails) ? raw.fineEmails : [],
});

export const loadSettings = async (): Promise<SettingsBundle> => {
  const { data, error } = await supabase.from("app_settings").select("settings_data").limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  const all = data?.settings_data || {};
  return {
    settings: merge(all[KEY]),
    habbyEmails: Array.isArray(all.accountability_emails) ? all.accountability_emails : [],
  };
};

/**
 * Applies `change` to the stored settings and saves them. The row is read
 * fresh first so Habby's own settings in the same row are never overwritten.
 */
export const updateSettings = async (change: (current: LoserSettings) => LoserSettings): Promise<LoserSettings> => {
  const { data, error } = await supabase.from("app_settings").select("id, settings_data").limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  const all = data?.settings_data || {};
  const next = change(merge(all[KEY]));
  const updated = { ...all, [KEY]: next };
  const { error: writeError } = data
    ? await supabase.from("app_settings").update({ settings_data: updated }).eq("id", data.id)
    : await supabase.from("app_settings").insert([{ settings_data: updated }]);
  if (writeError) throw new Error(writeError.message);
  return next;
};
