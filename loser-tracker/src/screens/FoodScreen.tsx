import React from "react";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";
import AnimatedNumber from "../components/AnimatedNumber";
import Ring from "../components/Ring";
import { Day, FoodItem, SavedFood, dayTotal, emptyDay, guessOf, itemCalories, makeItem } from "../lib/data";
import { dayLimit, monthOf, standing, weekOf } from "../lib/cycles";
import { LoserSettings } from "../lib/settings";
import { PendingFine } from "../lib/fines";
import { kcal, rupees, signed, STANDING_COLOR, STANDING_TEXT } from "../lib/format";
import { pretty, shift, todayIso } from "../lib/dates";
import { parseBestMatch, ParsedCommand } from "../lib/voice";
import { useVoice } from "../lib/useVoice";

interface FoodScreenProps {
  date: string;
  onDateChange: (date: string) => void;
  days: Record<string, Day>;
  onSaveItems: (date: string, items: FoodItem[]) => Promise<boolean>;
  savedFoods: SavedFood[];
  onRememberFood: (name: string, calories: number) => void;
  settings: LoserSettings;
  pending: PendingFine | null;
  notify: (text: string, tone?: "ok" | "error") => void;
  onOpenSettings: () => void;
}

const tap = () => { if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined); };

const FoodScreen: React.FC<FoodScreenProps> = ({
  date, onDateChange, days, onSaveItems, savedFoods, onRememberFood, settings, pending, notify, onOpenSettings,
}) => {
  const day = days[date] ?? emptyDay(date);
  const guess = guessOf(day);
  const total = dayTotal(day);
  const limit = dayLimit(settings, date);

  const week = weekOf(settings.cycleStart, date);
  const month = monthOf(settings.cycleStart, date);
  const weekUsed = week.dates.reduce((sum, d) => sum + dayTotal(days[d]), 0);
  const monthUsed = month.dates.reduce((sum, d) => sum + dayTotal(days[d]), 0);
  const weekLeft = settings.weeklyLimit - weekUsed;
  const monthLeft = settings.monthlyLimit - monthUsed;
  const dayStanding = standing(total, limit);
  const limitsSet = settings.weekdayLimit > 0 && settings.weeklyLimit > 0 && settings.monthlyLimit > 0;

  // Composer
  const [sign, setSign] = React.useState<1 | -1>(1);
  const [calories, setCalories] = React.useState("");
  const [food, setFood] = React.useState("");
  const [saveFood, setSaveFood] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [heard, setHeard] = React.useState<{ parsed: ParsedCommand | null; text: string } | null>(null);
  const [guessInput, setGuessInput] = React.useState("");
  const { listening, listen, cancel } = useVoice();
  // Collapsed unless the day is already marked missed, so that switch stays reachable.
  const [showExtras, setShowExtras] = React.useState(!!guess);

  // How many times each food has been logged, so the usual ones come first.
  const frequency = React.useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(days).forEach(d => d.items.forEach(item => {
      if (item.guess) return;
      const key = item.foodName.trim().toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    }));
    return counts;
  }, [days]);

  React.useEffect(() => {
    setHeard(null);
    setGuessInput(guess ? String(Math.round(itemCalories(guess))) : "");
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  const suggestions = React.useMemo(() => {
    const q = food.trim().toLowerCase();
    const list = (q ? savedFoods.filter(f => f.name.toLowerCase().includes(q)) : savedFoods)
      .slice()
      .sort((a, b) => (frequency[b.name.toLowerCase()] || 0) - (frequency[a.name.toLowerCase()] || 0) || a.name.localeCompare(b.name));
    return list.slice(0, q ? 6 : 15);
  }, [food, savedFoods, frequency]);

  const addItem = async (name: string, amount: number, remember: boolean) => {
    setBusy(true);
    const ok = await onSaveItems(date, [...day.items.filter(i => !i.guess), makeItem(name, amount)]);
    setBusy(false);
    if (!ok) return false;
    tap();
    if (remember) onRememberFood(name, Math.abs(amount));
    return true;
  };

  const handleManualAdd = async () => {
    const amount = Number(calories);
    if (!food.trim()) return notify("What was it?", "error");
    if (!amount || amount <= 0) return notify("Enter the calories.", "error");
    if (await addItem(food.trim(), sign * Math.round(amount), saveFood)) {
      setFood("");
      setCalories("");
      setSign(1);
    }
  };

  const handleMic = async () => {
    if (listening) return cancel();
    setHeard(null);
    try {
      const matches = await listen();
      if (matches.length === 0) return notify("Didn't hear anything. Try again.", "error");
      setHeard({ parsed: parseBestMatch(matches), text: matches[0] });
    } catch (err) {
      notify(err instanceof Error ? err.message : "Voice failed.", "error");
    }
  };

  const confirmHeard = async () => {
    if (!heard?.parsed) return;
    if (await addItem(heard.parsed.food, heard.parsed.calories, true)) setHeard(null);
  };

  const editHeard = () => {
    if (!heard?.parsed) return;
    setSign(heard.parsed.calories < 0 ? -1 : 1);
    setCalories(String(Math.abs(heard.parsed.calories)));
    setFood(heard.parsed.food);
    setHeard(null);
  };

  const removeItem = async (id: string) => {
    tap();
    await onSaveItems(date, day.items.filter(i => i.id !== id));
  };

  const toggleMissed = async (on: boolean) => {
    if (on) {
      const real = day.items.filter(i => !i.guess);
      if (real.length > 0 && !window.confirm(`Marking this as missed replaces the ${real.length} item${real.length === 1 ? "" : "s"} logged for it with one guessed total. Continue?`)) return;
      const value = Math.round(Number(guessInput) || limit || 0);
      setGuessInput(String(value));
      await onSaveItems(date, [makeItem("Missed day — guessed total", value, true)]);
    } else {
      await onSaveItems(date, []);
      setGuessInput("");
    }
    tap();
  };

  const saveGuess = async () => {
    const value = Math.round(Number(guessInput));
    if (!value || value < 0) return notify("Enter your best guess.", "error");
    await onSaveItems(date, [makeItem("Missed day — guessed total", value, true)]);
    notify("Guess saved");
  };

  const isToday = date === todayIso();
  const realItems = day.items.filter(i => !i.guess);

  return (
    <div className="px-5 pb-8 space-y-5">
      {/* Day, week and month at a glance */}
      <div className="grid grid-cols-[auto_1fr] gap-4 items-center anim-fade-up">
        <Ring size={176} stroke={6} progress={limit ? total / limit : 0} color={STANDING_COLOR[dayStanding]}>
          <div className="w-[150px] h-[150px] rounded-full bg-ink text-bg flex flex-col items-center justify-center">
            <span className="text-[40px] leading-none font-light tracking-tight">
              <AnimatedNumber value={total} />
            </span>
            <span className="mt-2 text-[11px] tracking-wide">
              {limit ? `of ${kcal(limit)} kcal` : "kcal"}
            </span>
          </div>
        </Ring>
        <div className="space-y-3">
          <LeftPill label="Week left" value={weekLeft} limit={settings.weeklyLimit} used={weekUsed} />
          <LeftPill label="Month left" value={monthLeft} limit={settings.monthlyLimit} used={monthUsed} />
        </div>
      </div>

      {!limitsSet && (
        <button onClick={onOpenSettings} className="w-full card p-4 text-left text-sm text-close anim-fade-up">
          Set your daily, weekly and monthly limits in Settings to see what's left. →
        </button>
      )}

      {pending && (
        <div className="card p-4 border-over/40 anim-fade-up">
          <p className="label text-over">Fine pending</p>
          <p className="mt-1 text-sm">
            {rupees(pending.fine)} from last month ({kcal(pending.over)} kcal over). Finish this month at or
            under <span className="text-ink font-medium">{kcal(Math.max(0, settings.monthlyLimit - pending.fine / settings.finePerCalorie))}</span> kcal
            to clear it. Every calorie under the limit wipes {rupees(settings.finePerCalorie)} off.
          </p>
        </div>
      )}

      <div className="h-px bg-line" />

      {/* Date */}
      <div className="flex items-center justify-between">
        <button onClick={() => onDateChange(shift(date, -1))} className="w-11 h-11 rounded-full bg-card border border-line text-lg active:scale-95 transition" aria-label="Previous day">‹</button>
        <label className="relative flex flex-col items-center cursor-pointer">
          <span className="text-base">{pretty(date, "EEE, d MMM")}</span>
          <span className={`label mt-0.5 ${isToday ? "text-good" : ""}`}>{isToday ? "Today" : pretty(date, "yyyy")}</span>
          <input type="date" value={date} max={todayIso()} onChange={e => e.target.value && onDateChange(e.target.value)} className="absolute inset-0 opacity-0" />
        </label>
        <button onClick={() => onDateChange(shift(date, 1))} disabled={isToday} className="w-11 h-11 rounded-full bg-card border border-line text-lg active:scale-95 transition disabled:opacity-30" aria-label="Next day">›</button>
      </div>

      {!guess && (
        <>
          {/* Manual */}
          <div className="card p-4 space-y-3">
            <div className="flex gap-2">
              <div className="flex shrink-0 rounded-2xl bg-card2 border border-line p-1">
                {([1, -1] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setSign(s)}
                    className={`w-11 rounded-xl text-lg transition ${sign === s ? "bg-ink text-bg" : "text-mute"}`}
                    aria-label={s === 1 ? "Add" : "Minus"}
                  >
                    {s === 1 ? "+" : "−"}
                  </button>
                ))}
              </div>
              <input className="field" inputMode="numeric" type="number" placeholder="kcal" value={calories} onChange={e => setCalories(e.target.value)} />
            </div>
            <div className="relative">
              <input
                className="field"
                placeholder={sign === 1 ? "What did you eat?" : "What burned it?"}
                value={food}
                onChange={e => { setFood(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onKeyDown={e => { if (e.key === "Enter") handleManualAdd(); }}
              />
              {showSuggestions && food.trim() && suggestions.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-2 bg-card2 border border-line rounded-2xl overflow-hidden anim-pop">
                  {suggestions.map(s => (
                    <button
                      key={s.id}
                      className="w-full flex justify-between px-4 py-3 text-sm text-left active:bg-line"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => { setFood(s.name); setCalories(String(s.calories)); setShowSuggestions(false); }}
                    >
                      <span className="truncate">{s.name}</span>
                      <span className="text-mute shrink-0 ml-3">{kcal(s.calories)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-mute">
                <input type="checkbox" checked={saveFood} onChange={e => setSaveFood(e.target.checked)} className="accent-[#ececec] w-4 h-4" />
                Save food for later
              </label>
              <button className="btn-ink px-7" onClick={handleManualAdd} disabled={busy}>Add</button>
            </div>
          </div>

          {/* Saved foods, one tap to fill */}
          {savedFoods.length > 0 && !food.trim() && (
            <div className="-mx-5 px-5 flex gap-2 overflow-x-auto no-scrollbar">
              {suggestions.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setFood(s.name); setCalories(String(s.calories)); }}
                  className="shrink-0 rounded-full border border-line bg-card px-4 py-2 text-xs active:scale-95 transition"
                >
                  {s.name} · {kcal(s.calories)}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* The day's items */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <p className="label">{guess ? "Guessed day" : `${realItems.length} item${realItems.length === 1 ? "" : "s"}`}</p>
          <p className={`text-xs ${STANDING_TEXT[dayStanding]}`}>
            {limit ? (total > limit ? `${kcal(total - limit)} over today` : `${kcal(limit - total)} left today`) : ""}
          </p>
        </div>
        {day.items.length === 0 ? (
          <p className="text-sm text-mute text-center py-6">Nothing logged yet.</p>
        ) : (
          <ul className="space-y-2">
            {day.items.map((item, i) => (
              <li key={item.id} className="card px-4 py-3 flex items-center gap-3 anim-slide-in" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                <span className="flex-1 min-w-0 truncate text-sm">{item.foodName}</span>
                <span className={`text-sm ${itemCalories(item) < 0 ? "text-good" : ""}`}>{signed(Math.round(itemCalories(item)))}</span>
                {!item.guess && (
                  <button onClick={() => removeItem(item.id)} className="w-8 h-8 -mr-1 rounded-full text-mute active:bg-line" aria-label={`Remove ${item.foodName}`}>×</button>
                )}
              </li>
            ))}
            {day.burned > 0 && (
              <li className="card px-4 py-3 flex justify-between text-sm text-mute"><span>Burned (from Habby)</span><span>{signed(-day.burned)}</span></li>
            )}
          </ul>
        )}
      </div>

      {/* Rarely used: voice and missed day */}
      <div className="card overflow-hidden">
        <button
          onClick={() => setShowExtras(open => !open)}
          className="w-full flex items-center justify-between px-5 py-4 text-sm"
          aria-expanded={showExtras}
        >
          <span className="label">Extra options</span>
          <span className={`text-mute transition-transform duration-300 ${showExtras ? "rotate-180" : ""}`}>⌄</span>
        </button>
        {showExtras && (
          <div className="px-3 pb-3 space-y-3 anim-fade-up">
            {/* Missed day */}
            <div className="rounded-[22px] bg-card2 p-4">
              <label className="flex items-center justify-between gap-3">
                <span>
                  <span className="block text-sm">Missed this day</span>
                  <span className="block text-xs text-mute">Log one guessed total instead of items</span>
                </span>
                <Toggle checked={!!guess} onChange={toggleMissed} />
              </label>
              {guess && (
                <div className="mt-3 flex gap-2 anim-fade-up">
                  <input className="field" inputMode="numeric" type="number" placeholder="Guessed kcal" value={guessInput} onChange={e => setGuessInput(e.target.value)} />
                  <button className="btn-ink shrink-0" onClick={saveGuess}>Save</button>
                </div>
              )}
            </div>


            {!guess && (
              <>
                {/* Voice */}
                <div className="rounded-[22px] bg-card2 p-5 flex items-center gap-5">
                  <button
                    onClick={handleMic}
                    className={`relative shrink-0 w-[72px] h-[72px] rounded-full flex items-center justify-center transition active:scale-95 ${listening ? "bg-over" : "bg-ink"}`}
                    aria-label={listening ? "Stop listening" : "Add by voice"}
                  >
                    {listening && <span className="absolute inset-0 rounded-full bg-over ripple" />}
                    <MicIcon className={`relative w-7 h-7 ${listening ? "text-ink" : "text-bg"}`} />
                  </button>
                  <div className="min-w-0">
                    <p className="text-sm">{listening ? <span className="anim-blink">Listening…</span> : "Tap and say"}</p>
                    <p className="text-xs text-mute mt-1 leading-relaxed">“add 300 calories for dosa”<br />“minus 200 calories for walk”</p>
                  </div>
                </div>

                {heard && (
                  <div className="rounded-[22px] bg-card2 p-4 anim-pop">
                    {heard.parsed ? (
                      <>
                        <p className="label">Heard</p>
                        <div className="mt-2 flex items-baseline justify-between gap-3">
                          <span className="text-lg truncate">{heard.parsed.food}</span>
                          <span className={`text-lg ${heard.parsed.calories < 0 ? "text-good" : ""}`}>{signed(heard.parsed.calories)}</span>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-2">
                          <button className="btn-ghost" onClick={() => setHeard(null)}>Cancel</button>
                          <button className="btn-ghost" onClick={editHeard}>Edit</button>
                          <button className="btn-ink" onClick={confirmHeard} disabled={busy}>Add</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="label text-over">Couldn't read that</p>
                        <p className="mt-2 text-sm">“{heard.text}”</p>
                        <p className="mt-1 text-xs text-mute">Say “add &lt;number&gt; calories for &lt;food&gt;”.</p>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button className="btn-ghost" onClick={() => setHeard(null)}>Dismiss</button>
                          <button className="btn-ink" onClick={handleMic}>Try again</button>
                        </div>
                      </>
                    )}
                  </div>
                )}

              </>
            )}
          </div>
        )}
      </div>

    </div>
  );
};

const LeftPill: React.FC<{ label: string; value: number; limit: number; used: number }> = ({ label, value, limit, used }) => {
  const s = standing(used, limit);
  return (
    <div className="card px-4 py-3.5 relative overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 opacity-[0.12] transition-all duration-700"
        style={{ width: `${limit ? Math.min(100, (used / limit) * 100) : 0}%`, background: STANDING_COLOR[s] }}
      />
      <p className="label relative">{label}</p>
      <p className={`relative text-xl mt-1 ${STANDING_TEXT[s]}`}>
        {limit ? <AnimatedNumber value={value} /> : "—"}
      </p>
    </div>
  );
};

export const Toggle: React.FC<{ checked: boolean; onChange: (on: boolean) => void }> = ({ checked, onChange }) => (
  <button
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative w-12 h-7 rounded-full shrink-0 transition-colors ${checked ? "bg-ink" : "bg-line"}`}
  >
    <span className={`absolute top-1 left-1 w-5 h-5 rounded-full transition-transform duration-300 ${checked ? "translate-x-5 bg-bg" : "bg-mute"}`} />
  </button>
);

const MicIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className={className}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
  </svg>
);

export default FoodScreen;
