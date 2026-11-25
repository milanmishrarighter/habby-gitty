import React from "react";
import Ring from "../components/Ring";
import AnimatedNumber from "../components/AnimatedNumber";
import { Day, dayTotal, guessOf } from "../lib/data";
import { dayLimit, monthAt, monthIndexOf, standing, WEEKS_PER_MONTH, DAYS_PER_WEEK } from "../lib/cycles";
import { LoserSettings } from "../lib/settings";
import { PendingFine } from "../lib/fines";
import { kcal, rupees, STANDING_COLOR, STANDING_TEXT } from "../lib/format";
import { pretty, todayIso } from "../lib/dates";

interface HistoryScreenProps {
  days: Record<string, Day>;
  settings: LoserSettings;
  pending: PendingFine | null;
  onOpenDate: (date: string) => void;
}

const HistoryScreen: React.FC<HistoryScreenProps> = ({ days, settings, pending, onOpenDate }) => {
  const today = todayIso();
  const currentIndex = monthIndexOf(settings.cycleStart, today);
  const [index, setIndex] = React.useState(currentIndex);
  const month = monthAt(settings.cycleStart, index);
  const total = month.dates.reduce((sum, d) => sum + dayTotal(days[d]), 0);
  const s = standing(total, settings.monthlyLimit);
  const ledger = Object.values(settings.ledger).sort((a, b) => b.month - a.month);
  // Months before the start date still show, for the days Habby logged.
  const earliest = Object.keys(days).sort()[0];
  const minIndex = Math.min(0, earliest ? monthIndexOf(settings.cycleStart, earliest) : 0);

  return (
    <div className="px-5 pb-8 space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={() => setIndex(i => i - 1)} disabled={index <= minIndex} className="w-11 h-11 rounded-full bg-card border border-line disabled:opacity-30" aria-label="Previous month">‹</button>
        <div className="text-center">
          <p className="text-base">{index >= 0 ? `Month ${index + 1}` : "Before tracking"}</p>
          <p className="label mt-0.5">{pretty(month.start, "d MMM")} – {pretty(month.end, "d MMM yyyy")}</p>
        </div>
        <button onClick={() => setIndex(i => i + 1)} disabled={index >= currentIndex} className="w-11 h-11 rounded-full bg-card border border-line disabled:opacity-30" aria-label="Next month">›</button>
      </div>

      <div key={index} className="card p-5 flex items-center gap-5 anim-fade-up">
        <Ring size={112} stroke={5} progress={settings.monthlyLimit ? total / settings.monthlyLimit : 0} color={STANDING_COLOR[s]}>
          <span className="text-xs text-mute">{settings.monthlyLimit ? `${Math.round((total / settings.monthlyLimit) * 100)}%` : "—"}</span>
        </Ring>
        <div>
          <p className="label">Eaten</p>
          <p className="text-2xl mt-1"><AnimatedNumber value={total} /></p>
          <p className={`text-xs mt-1 ${STANDING_TEXT[s]}`}>
            {settings.monthlyLimit
              ? total > settings.monthlyLimit
                ? `${kcal(total - settings.monthlyLimit)} over ${kcal(settings.monthlyLimit)}`
                : `${kcal(settings.monthlyLimit - total)} under ${kcal(settings.monthlyLimit)}`
              : "No monthly limit set"}
          </p>
        </div>
      </div>

      {Array.from({ length: WEEKS_PER_MONTH }, (_, w) => {
        const dates = month.dates.slice(w * DAYS_PER_WEEK, (w + 1) * DAYS_PER_WEEK);
        const weekTotal = dates.reduce((sum, d) => sum + dayTotal(days[d]), 0);
        const ws = standing(weekTotal, settings.weeklyLimit);
        return (
          <div key={`${index}-${w}`} className="card p-4 anim-fade-up" style={{ animationDelay: `${w * 60}ms` }}>
            <div className="flex items-baseline justify-between">
              <p className="label">Week {w + 1}</p>
              <p className={`text-sm ${STANDING_TEXT[ws]}`}>
                {kcal(weekTotal)}{settings.weeklyLimit ? <span className="text-mute"> / {kcal(settings.weeklyLimit)}</span> : null}
              </p>
            </div>
            <div className="mt-3 grid grid-cols-7 gap-1.5">
              {dates.map(d => {
                const t = dayTotal(days[d]);
                const lim = dayLimit(settings, d);
                const ds = standing(t, lim);
                const future = d > today;
                const logged = (days[d]?.items.length ?? 0) > 0;
                return (
                  <button key={d} onClick={() => !future && onOpenDate(d)} disabled={future} className="flex flex-col items-center gap-1.5 disabled:opacity-30">
                    <div className="w-full h-16 rounded-lg bg-card2 flex items-end overflow-hidden">
                      <div
                        className="w-full rounded-lg transition-all duration-700"
                        style={{ height: `${lim ? Math.min(100, (t / lim) * 100) : logged ? 50 : 0}%`, background: STANDING_COLOR[ds] }}
                      />
                    </div>
                    <span className={`text-[10px] ${d === today ? "text-ink" : "text-mute"}`}>{pretty(d, "EEEEE")}</span>
                    <span className="text-[9px] text-mute">{logged ? (guessOf(days[d]) ? `~${kcal(t)}` : kcal(t)) : "·"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="pt-2">
        <p className="label mb-3">Fines</p>
        {pending && (
          <div className="card p-4 mb-2 border-close/40">
            <div className="flex justify-between text-sm"><span>Month {pending.month + 1}</span><span className="text-close">{rupees(pending.fine)} pending</span></div>
            <p className="text-xs text-mute mt-1">{kcal(pending.over)} kcal over. Recovering this month.</p>
          </div>
        )}
        {ledger.length === 0 && !pending && <p className="text-sm text-mute">No fines. Keep it that way.</p>}
        {ledger.map(entry => (
          <div key={entry.month} className="card p-4 mb-2">
            <div className="flex justify-between text-sm">
              <span>Month {entry.month + 1}</span>
              <span className={entry.owed > 0 ? "text-over" : "text-good"}>{entry.owed > 0 ? `${rupees(entry.owed)} owed` : "Recovered"}</span>
            </div>
            <p className="text-xs text-mute mt-1">
              {kcal(entry.over)} kcal over · fine {rupees(entry.fine)} · recovered {rupees(entry.recovered)}
            </p>
            {entry.owed > 0 && (
              <p className="text-xs text-mute mt-1">
                {entry.emailedAt ? `Emailed ${entry.emailedTo.join(", ")}` : "Not emailed yet. Add fine emails in Settings."}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryScreen;
