import React from "react";
import type { Session } from "@supabase/supabase-js";
import { App as NativeApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { supabase } from "./lib/supabase";
import { Day, FoodItem, SavedFood, emptyDay, loadDays, loadSavedFoods, rememberFood, saveItems, saveMeasurements } from "./lib/data";
import { DEFAULT_SETTINGS, LoserSettings, loadSettings, updateSettings } from "./lib/settings";
import { currentFines, settleFines } from "./lib/fineRunner";
import { rupees } from "./lib/format";
import { todayIso } from "./lib/dates";
import Toasts, { useToasts } from "./components/Toast";
import LoginScreen from "./screens/LoginScreen";
import FoodScreen from "./screens/FoodScreen";
import HistoryScreen from "./screens/HistoryScreen";
import BodyScreen from "./screens/BodyScreen";
import SettingsScreen from "./screens/SettingsScreen";

type Tab = "food" | "history" | "body";

const TABS: { id: Tab; label: string }[] = [
  { id: "food", label: "Food" },
  { id: "history", label: "History" },
  { id: "body", label: "Body" },
];

const App: React.FC = () => {
  const [session, setSession] = React.useState<Session | null>(null);
  const [authReady, setAuthReady] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [days, setDays] = React.useState<Record<string, Day>>({});
  const [savedFoods, setSavedFoods] = React.useState<SavedFood[]>([]);
  const [settings, setSettings] = React.useState<LoserSettings>(DEFAULT_SETTINGS);
  const [habbyEmails, setHabbyEmails] = React.useState<string[]>([]);
  const [tab, setTab] = React.useState<Tab>("food");
  const [showSettings, setShowSettings] = React.useState(false);
  const [date, setDate] = React.useState(todayIso());
  const { toasts, show } = useToasts();

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const load = React.useCallback(async () => {
    setLoadError(null);
    try {
      const [loadedDays, foods, bundle] = await Promise.all([loadDays(), loadSavedFoods(), loadSettings()]);
      setDays(loadedDays);
      setSavedFoods(foods);
      setSettings(bundle.settings);
      setHabbyEmails(bundle.habbyEmails);
      setLoaded(true);

      // Record and email any month whose recovery window has closed.
      const result = await settleFines(loadedDays, bundle.settings);
      setSettings(result.settings);
      result.emailed.forEach(entry => show(`${rupees(entry.owed)} fine emailed to ${entry.emailedTo.join(", ")}`, "error"));
      result.errors.forEach(message => show(message, "error"));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, [show]);

  React.useEffect(() => {
    if (session) load();
  }, [session?.user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Android back button: close settings first, then leave the app.
  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = NativeApp.addListener("backButton", () => {
      if (showSettings) setShowSettings(false);
      else if (tab !== "food") setTab("food");
      else NativeApp.exitApp();
    });
    return () => { handle.then(h => h.remove()); };
  }, [showSettings, tab]);

  const handleSaveItems = async (day: string, items: FoodItem[]) => {
    const previous = days[day];
    setDays(prev => ({ ...prev, [day]: { ...(prev[day] ?? emptyDay(day)), items } }));
    try {
      await saveItems(day, items);
      return true;
    } catch (err) {
      setDays(prev => ({ ...prev, [day]: previous ?? emptyDay(day) }));
      show(err instanceof Error ? err.message : "Couldn't save.", "error");
      return false;
    }
  };

  const handleRememberFood = (name: string, calories: number) => {
    rememberFood(savedFoods, name, calories)
      .then(setSavedFoods)
      .catch(err => show(`Couldn't save the food: ${err instanceof Error ? err.message : err}`, "error"));
  };

  const handleSaveBody = async (day: string, weight: number | null, waist: number | null) => {
    try {
      await saveMeasurements(day, weight, waist);
      setDays(prev => ({ ...prev, [day]: { ...(prev[day] ?? emptyDay(day)), weight, waist } }));
      return true;
    } catch (err) {
      show(err instanceof Error ? err.message : "Couldn't save.", "error");
      return false;
    }
  };

  const handleSaveSettings = async (next: LoserSettings) => {
    try {
      // The ledger is only ever changed by the fine runner.
      const saved = await updateSettings(stored => ({ ...next, ledger: stored.ledger }));
      setSettings(saved);
      return true;
    } catch (err) {
      show(err instanceof Error ? err.message : "Couldn't save settings.", "error");
      return false;
    }
  };

  if (!authReady) return <div className="min-h-screen" />;
  if (!session) return <><LoginScreen /><Toasts toasts={toasts} /></>;

  const { pending } = currentFines(days, settings);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="safe-top px-5 pb-4 flex items-center justify-between sticky top-0 z-30 bg-bg/90 backdrop-blur">
        <span className="w-10" />
        <h1 className="text-sm tracking-[0.2em] lowercase">{showSettings ? "settings" : "loser tracker"}</h1>
        <button
          onClick={() => setShowSettings(open => !open)}
          className="w-10 h-10 rounded-full flex items-center justify-center active:bg-card transition"
          aria-label={showSettings ? "Close settings" : "Settings"}
        >
          {showSettings ? <span className="text-xl">×</span> : <GearIcon />}
        </button>
      </header>

      <main className="flex-1 pb-28">
        {loadError ? (
          <div className="px-5 pt-10 text-center space-y-4">
            <p className="text-over text-sm">{loadError}</p>
            <button className="btn-ghost" onClick={load}>Try again</button>
          </div>
        ) : !loaded ? (
          <div className="flex justify-center pt-24"><div className="w-24 h-24 rounded-full bg-card anim-blink" /></div>
        ) : showSettings ? (
          <SettingsScreen
            settings={settings}
            habbyEmails={habbyEmails}
            userEmail={session.user.email ?? ""}
            onSave={handleSaveSettings}
            onClose={() => setShowSettings(false)}
            onSignOut={() => { supabase.auth.signOut(); setShowSettings(false); setLoaded(false); }}
            notify={show}
          />
        ) : (
          <div key={tab}>
            {tab === "food" && (
              <FoodScreen
                date={date}
                onDateChange={setDate}
                days={days}
                onSaveItems={handleSaveItems}
                savedFoods={savedFoods}
                onRememberFood={handleRememberFood}
                settings={settings}
                pending={pending}
                notify={show}
                onOpenSettings={() => setShowSettings(true)}
              />
            )}
            {tab === "history" && (
              <HistoryScreen days={days} settings={settings} pending={pending} onOpenDate={d => { setDate(d); setTab("food"); }} />
            )}
            {tab === "body" && <BodyScreen days={days} onSave={handleSaveBody} notify={show} />}
          </div>
        )}
      </main>

      {!showSettings && loaded && (
        <nav className="fixed bottom-0 inset-x-0 z-30 safe-bottom px-5 pt-3 bg-gradient-to-t from-bg via-bg to-bg/0">
          <div className="relative grid grid-cols-3 rounded-full bg-card border border-line p-1.5">
            <span
              className="absolute top-1.5 bottom-1.5 rounded-full bg-ink transition-all duration-300 ease-out"
              style={{ width: `calc((100% - 12px) / 3)`, left: `calc(6px + ${TABS.findIndex(t => t.id === tab)} * (100% - 12px) / 3)` }}
            />
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative z-10 py-3 text-xs tracking-[0.15em] uppercase transition-colors duration-300 ${tab === t.id ? "text-bg" : "text-mute"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      )}

      <Toasts toasts={toasts} />
    </div>
  );
};

const GearIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);

export default App;
