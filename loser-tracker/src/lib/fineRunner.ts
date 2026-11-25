import { Day, dayTotal } from "./data";
import { monthAt, monthIndexOf } from "./cycles";
import { evaluateFines, monthResult, PendingFine } from "./fines";
import { LoserSettings, LedgerEntry, updateSettings } from "./settings";
import { render, sendOnce } from "./email";
import { pretty, todayIso } from "./dates";

export const monthTotal = (days: Record<string, Day>, start: string, index: number) =>
  monthAt(start, index).dates.reduce((sum, date) => sum + dayTotal(days[date]), 0);

/** Fines as they stand today, without writing anything. */
export const currentFines = (days: Record<string, Day>, settings: LoserSettings) => {
  const current = monthIndexOf(settings.cycleStart, todayIso());
  if (!settings.monthlyLimit || current < 1) return { resolved: [], pending: null as PendingFine | null };
  const finished = Array.from({ length: current }, (_, month) =>
    monthResult(month, monthTotal(days, settings.cycleStart, month), settings.monthlyLimit));
  return evaluateFines(finished, settings.finePerCalorie);
};

/**
 * Records every fine whose recovery month has ended, then emails any that are
 * still owed and haven't gone out. Safe to run on every launch: recorded fines
 * are never re-judged, and each email is only ever sent once.
 */
export const settleFines = async (
  days: Record<string, Day>,
  settings: LoserSettings,
): Promise<{ settings: LoserSettings; emailed: LedgerEntry[]; errors: string[] }> => {
  const { resolved } = currentFines(days, settings);
  const fresh = resolved.filter(fine => !settings.ledger[fine.month]);
  const unsent = (ledger: Record<string, LedgerEntry>) =>
    Object.values(ledger).filter(entry => entry.owed > 0 && !entry.emailedAt);

  let next = settings;
  if (fresh.length > 0) {
    next = await updateSettings(stored => {
      const ledger = { ...stored.ledger };
      fresh.forEach(fine => {
        if (ledger[fine.month]) return;
        const month = monthAt(stored.cycleStart, fine.month);
        ledger[fine.month] = {
          ...fine, start: month.start, end: month.end,
          resolvedAt: new Date().toISOString(), emailedTo: [], emailedAt: null,
        };
      });
      return { ...stored, ledger };
    });
  }

  const emailed: LedgerEntry[] = [];
  const errors: string[] = [];
  if (next.fineEmails.length === 0) return { settings: next, emailed, errors };

  for (const entry of unsent(next.ledger)) {
    const vars = {
      owed: entry.owed.toLocaleString("en-IN"),
      fine: entry.fine.toLocaleString("en-IN"),
      over: entry.over.toLocaleString("en-IN"),
      recovered: entry.recovered.toLocaleString("en-IN"),
      limit: next.monthlyLimit.toLocaleString("en-IN"),
      period: `${pretty(entry.start, "d MMM")} – ${pretty(entry.end, "d MMM yyyy")}`,
    };
    try {
      const to = await sendOnce({
        alertKey: `LOSER_TRACKER:MONTH:${entry.start}`,
        periodKey: entry.start,
        recipients: next.fineEmails,
        subject: render(next.emailSubject, vars),
        body: render(next.emailBody, vars),
      });
      if (to.length === 0) continue;
      next = await updateSettings(stored => ({
        ...stored,
        ledger: {
          ...stored.ledger,
          [entry.month]: { ...stored.ledger[entry.month], emailedTo: to, emailedAt: new Date().toISOString() },
        },
      }));
      emailed.push(next.ledger[entry.month]);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  return { settings: next, emailed, errors };
};
