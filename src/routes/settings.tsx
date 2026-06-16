import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { loadSettings, saveSettings, resetDrawCount } from "@/lib/dawnhalo";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Dawnhalo" }, { name: "description", content: "Reminders and preferences." }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const [s, setS] = useState(() => loadSettings());
  const [savedMsg, setSavedMsg] = useState(false);

  const update = (next: typeof s) => { setS(next); saveSettings(next); setSavedMsg(true); setTimeout(() => setSavedMsg(false), 1200); };

  return (
    <div className="min-h-screen bg-dawn-sky">
      <main className="max-w-md mx-auto px-6 pt-12 pb-32">
        <header className="mb-10">
          <p className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-50 mb-1">Quiet preferences</p>
          <h1 className="text-3xl font-serif font-light tracking-tight italic">Settings.</h1>
        </header>

        <div className="bg-white border border-dawn-ink/5 rounded-2xl divide-y divide-dawn-ink/5">
          <div className="p-5 flex items-center justify-between">
            <div>
              <p className="font-serif text-lg">Daily reminder</p>
              <p className="text-xs opacity-60">A gentle nudge each morning.</p>
            </div>
            <button onClick={() => update({ ...s, notificationsOn: !s.notificationsOn })}
              className={"w-11 h-6 rounded-full relative transition-colors " + (s.notificationsOn ? "bg-dawn-rose" : "bg-dawn-ink/15")}>
              <span className={"absolute top-0.5 size-5 rounded-full bg-white shadow transition-all " + (s.notificationsOn ? "left-[22px]" : "left-0.5")} />
            </button>
          </div>
          <div className="p-5 flex items-center justify-between">
            <div>
              <p className="font-serif text-lg">Reminder time</p>
              <p className="text-xs opacity-60">When the light should reach you.</p>
            </div>
            <input type="time" value={s.reminderTime} onChange={(e) => update({ ...s, reminderTime: e.target.value })}
              className="bg-dawn-glow border border-dawn-haze/30 rounded-full px-3 py-1.5 text-sm font-mono" />
          </div>
        </div>

        <div className="mt-8 bg-white border border-dawn-ink/5 rounded-2xl p-5">
          <p className="font-serif text-lg">Free draws today</p>
          <p className="text-xs opacity-60 mt-1">Prototype-only — reset to test the paywall flow.</p>
          <button onClick={() => { resetDrawCount(); setSavedMsg(true); setTimeout(() => setSavedMsg(false), 1200); }}
            className="mt-4 text-[10px] uppercase tracking-[0.18em] font-bold px-4 py-2 border border-dawn-ink/10 rounded-full hover:bg-dawn-glow">
            Reset draw count
          </button>
        </div>

        {savedMsg && <p className="mt-6 text-center text-xs italic opacity-60">Saved.</p>}

        <p className="mt-12 text-center text-[10px] uppercase tracking-[0.2em] opacity-30">Dawnhalo · v0 prototype</p>
      </main>
      <BottomNav />
    </div>
  );
}
