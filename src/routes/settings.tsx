import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getSettings, saveSettings } from "@/lib/store";
import type { Settings } from "@/lib/dawnhalo";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Dawnhalo" }, { name: "description", content: "Reminders and preferences." }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const [s, setS] = useState<Settings>({ reminderTime: "07:30", notificationsOn: true });
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    let alive = true;
    getSettings().then((loaded) => alive && setS(loaded));
    return () => {
      alive = false;
    };
  }, []);

  const update = (next: Settings) => {
    setS(next);
    void saveSettings(next);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 1200);
  };

  return (
    <div className="min-h-screen bg-dawn-sky text-dawn-ink">
      <main className="max-w-md mx-auto px-6 pt-12 pb-32">
        <header className="mb-10">
          <p className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-50 mb-1">Quiet preferences</p>
          <h1 className="text-3xl font-serif font-light tracking-tight italic">Settings.</h1>
        </header>

        <div className="bg-dawn-surface/80 border border-dawn-haze/15 rounded-2xl divide-y divide-dawn-haze/10 backdrop-blur-md">
          <div className="p-5 flex items-center justify-between">
            <div>
              <p className="font-serif text-lg text-dawn-ink">Daily reminder</p>
              <p className="text-xs text-dawn-ink/50">A gentle nudge each morning.</p>
            </div>
            <button onClick={() => update({ ...s, notificationsOn: !s.notificationsOn })}
              className={"w-11 h-6 rounded-full relative transition-colors " + (s.notificationsOn ? "bg-dawn-rose" : "bg-dawn-ink/20")}>
              <span className={"absolute top-0.5 size-5 rounded-full bg-white shadow transition-all " + (s.notificationsOn ? "left-[22px]" : "left-0.5")} />
            </button>
          </div>
          <div className="p-5 flex items-center justify-between">
            <div>
              <p className="font-serif text-lg text-dawn-ink">Reminder time</p>
              <p className="text-xs text-dawn-ink/50">When the light should reach you.</p>
            </div>
            <input type="time" value={s.reminderTime} onChange={(e) => update({ ...s, reminderTime: e.target.value })}
              className="bg-dawn-night/80 border border-dawn-haze/20 rounded-full px-3 py-1.5 text-sm font-mono text-dawn-ink" />
          </div>
        </div>

        {savedMsg && <p className="mt-6 text-center text-xs italic opacity-60">Saved.</p>}

        <p className="mt-12 text-center text-[10px] uppercase tracking-[0.2em] opacity-30">Dawnhalo · a little light for your next step</p>
      </main>
      <BottomNav />
    </div>
  );
}
