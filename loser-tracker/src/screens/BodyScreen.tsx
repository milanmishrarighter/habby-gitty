import React from "react";
import LineChart from "../components/LineChart";
import { Day } from "../lib/data";
import { pretty, todayIso } from "../lib/dates";

interface BodyScreenProps {
  days: Record<string, Day>;
  onSave: (date: string, weight: number | null, waist: number | null) => Promise<boolean>;
  notify: (text: string, tone?: "ok" | "error") => void;
}

const BodyScreen: React.FC<BodyScreenProps> = ({ days, onSave, notify }) => {
  const [date, setDate] = React.useState(todayIso());
  const [weight, setWeight] = React.useState("");
  const [waist, setWaist] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setWeight(days[date]?.weight != null ? String(days[date].weight) : "");
    setWaist(days[date]?.waist != null ? String(days[date].waist) : "");
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  const series = (pick: (d: Day) => number | null) =>
    Object.values(days)
      .filter(d => pick(d) !== null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({ date: d.date, value: pick(d) as number }));
  const weights = series(d => d.weight);
  const waists = series(d => d.waist);

  const save = async () => {
    const w = weight.trim() === "" ? null : Number(weight);
    const ws = waist.trim() === "" ? null : Number(waist);
    if ((w !== null && !(w > 0)) || (ws !== null && !(ws > 0))) return notify("Enter valid numbers.", "error");
    setBusy(true);
    if (await onSave(date, w, ws)) notify("Saved");
    setBusy(false);
  };

  return (
    <div className="px-5 pb-8 space-y-5">
      <div className="card p-5 space-y-4 anim-fade-up">
        <div>
          <p className="label mb-2">Date</p>
          <input type="date" className="field" value={date} max={todayIso()} onChange={e => e.target.value && setDate(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="label mb-2">Weight · kg</p>
            <input className="field" type="number" inputMode="decimal" step="0.1" placeholder="—" value={weight} onChange={e => setWeight(e.target.value)} />
          </div>
          <div>
            <p className="label mb-2">Waist · cm</p>
            <input className="field" type="number" inputMode="decimal" step="0.1" placeholder="—" value={waist} onChange={e => setWaist(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-mute">Fill in either or both. Leave one blank to clear it for this date.</p>
        <button className="btn-ink w-full" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </div>

      <Trend title="Weight" unit="kg" points={weights} />
      <Trend title="Waist" unit="cm" points={waists} />
    </div>
  );
};

const Trend: React.FC<{ title: string; unit: string; points: { date: string; value: number }[] }> = ({ title, unit, points }) => {
  const latest = points[points.length - 1];
  const first = points[0];
  const change = latest && first ? latest.value - first.value : 0;
  return (
    <div className="card p-5 anim-fade-up">
      <div className="flex items-baseline justify-between">
        <p className="label">{title}</p>
        {latest && (
          <p className="text-sm">
            {latest.value} {unit}
            {points.length > 1 && (
              <span className={`ml-2 text-xs ${change <= 0 ? "text-good" : "text-over"}`}>
                {change > 0 ? "+" : ""}{change.toFixed(1)} since {pretty(first.date, "d MMM")}
              </span>
            )}
          </p>
        )}
      </div>
      <div className="mt-3"><LineChart points={points} unit={unit} /></div>
    </div>
  );
};

export default BodyScreen;
