import React from "react";
import { EMAIL_TAGS, LoserSettings } from "../lib/settings";
import { kcal } from "../lib/format";
import { pretty, weekday } from "../lib/dates";

interface SettingsScreenProps {
  settings: LoserSettings;
  habbyEmails: string[];
  userEmail: string;
  onSave: (next: LoserSettings) => Promise<boolean>;
  onClose: () => void;
  onSignOut: () => void;
  notify: (text: string, tone?: "ok" | "error") => void;
}

const LIMIT_FIELDS: [keyof LoserSettings, string][] = [
  ["weekdayLimit", "Weekday (Mon–Fri)"],
  ["saturdayLimit", "Saturday"],
  ["sundayLimit", "Sunday"],
  ["weeklyLimit", "Weekly"],
  ["monthlyLimit", "Monthly (4 weeks)"],
];

const SettingsScreen: React.FC<SettingsScreenProps> = ({ settings, habbyEmails, userEmail, onSave, onClose, onSignOut, notify }) => {
  const [draft, setDraft] = React.useState<LoserSettings>(settings);
  const [newEmail, setNewEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const set = <K extends keyof LoserSettings>(key: K, value: LoserSettings[K]) => setDraft(d => ({ ...d, [key]: value }));

  const weekFromDays = draft.weekdayLimit * 5 + draft.saturdayLimit + draft.sundayLimit;
  const emailChoices = [...new Set([...habbyEmails, ...draft.fineEmails])];
  const monthsStarted = Object.keys(settings.ledger).length > 0;

  const toggleEmail = (email: string) =>
    set("fineEmails", draft.fineEmails.includes(email) ? draft.fineEmails.filter(e => e !== email) : [...draft.fineEmails, email]);

  const addEmail = () => {
    const email = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return notify("That's not an email address.", "error");
    if (!draft.fineEmails.includes(email)) set("fineEmails", [...draft.fineEmails, email]);
    setNewEmail("");
  };

  const save = async () => {
    if (weekday(draft.cycleStart) !== 1) return notify("The start date has to be a Monday.", "error");
    if (!(draft.finePerCalorie >= 0)) return notify("Enter a valid fine per calorie.", "error");
    setBusy(true);
    const ok = await onSave(draft);
    setBusy(false);
    if (ok) { notify("Settings saved"); onClose(); }
  };

  return (
    <div className="px-5 pb-10 space-y-5 anim-fade-up">
      <section className="card p-5 space-y-4">
        <p className="label">Calorie limits</p>
        {LIMIT_FIELDS.map(([key, label]) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <span className="text-sm">{label}</span>
            <input
              className="field w-36 text-right"
              type="number"
              inputMode="numeric"
              value={(draft[key] as number) || ""}
              placeholder="0"
              onChange={e => setDraft(d => ({ ...d, [key]: Number(e.target.value) || 0 }))}
            />
          </div>
        ))}
        <p className="text-xs text-mute">
          Daily and weekly limits are guides only. Your days add up to {kcal(weekFromDays)} a week.
          Only the monthly limit can fine you.
        </p>
      </section>

      <section className="card p-5 space-y-4">
        <p className="label">Fines</p>
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm">₹ per calorie over</span>
          <input className="field w-36 text-right" type="number" inputMode="numeric" value={draft.finePerCalorie} onChange={e => set("finePerCalorie", Number(e.target.value))} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm">Month 1 starts</span>
          <input className="field w-44" type="date" value={draft.cycleStart} disabled={monthsStarted} onChange={e => e.target.value && set("cycleStart", e.target.value)} />
        </div>
        <p className="text-xs text-mute">
          Every 4 weeks from {pretty(draft.cycleStart, "EEE d MMM yyyy")} is one month. A month over the limit owes
          the calories over × ₹{draft.finePerCalorie}. The next month is your chance to win it back: each calorie you
          finish under the limit wipes ₹{draft.finePerCalorie} off. Whatever is left is emailed.
          {monthsStarted ? " The start date is locked now that fines have been recorded." : ""}
        </p>
      </section>

      <section className="card p-5 space-y-4">
        <p className="label">Who gets the fine email</p>
        <div className="flex flex-wrap gap-2">
          {emailChoices.length === 0 && <p className="text-xs text-mute">No emails yet.</p>}
          {emailChoices.map(email => (
            <button
              key={email}
              onClick={() => toggleEmail(email)}
              className={`rounded-full px-3 py-1.5 text-xs border transition ${draft.fineEmails.includes(email) ? "bg-ink text-bg border-ink" : "border-line text-mute"}`}
            >
              {email}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input className="field" type="email" placeholder="add an email" value={newEmail} onChange={e => setNewEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && addEmail()} />
          <button className="btn-ghost shrink-0" onClick={addEmail}>Add</button>
        </div>
        <div>
          <p className="label mb-2">Subject</p>
          <input className="field" value={draft.emailSubject} onChange={e => set("emailSubject", e.target.value)} />
        </div>
        <div>
          <p className="label mb-2">Message</p>
          <textarea className="field min-h-[160px] text-sm" value={draft.emailBody} onChange={e => set("emailBody", e.target.value)} />
          <p className="text-xs text-mute mt-2">Tags: {EMAIL_TAGS.join(" ")}</p>
        </div>
      </section>

      <button className="btn-ink w-full" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>

      <section className="card p-5 flex items-center justify-between gap-3">
        <span className="text-xs text-mute truncate">{userEmail}</span>
        <button className="btn-ghost text-sm shrink-0" onClick={onSignOut}>Sign out</button>
      </section>
      <p className="text-center text-[10px] text-mute">Loser Tracker v{__APP_VERSION__}</p>
    </div>
  );
};

export default SettingsScreen;
