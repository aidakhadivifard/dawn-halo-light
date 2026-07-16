import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getSettings, saveSettings } from "@/lib/store";
import type { Settings } from "@/lib/dawnhalo";
import { BottomNav } from "@/components/BottomNav";
import { syncDailyReminder, reminderSupported } from "@/lib/notifications";
import { getGoalStatus, updateGoal } from "@/lib/goalStore";
import type { GoalStatus, RitualType } from "@/lib/api";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Dawnhalo" }, { name: "description", content: "Reminders and preferences." }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const [s, setS] = useState<Settings>({ reminderTime: "07:30", notificationsOn: true });
  const [savedMsg, setSavedMsg] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isNative, setIsNative] = useState(false);

  const [goal, setGoal] = useState<GoalStatus | null>(null);

  useEffect(() => {
    let alive = true;
    getSettings().then((loaded) => alive && setS(loaded));
    getGoalStatus().then((g) => alive && setGoal(g));
    setIsNative(reminderSupported());
    return () => {
      alive = false;
    };
  }, []);

  const switchRitual = async (ritual: RitualType) => {
    if (!goal || goal.goal.ritual === ritual) return;
    setGoal({ ...goal, goal: { ...goal.goal, ritual } }); // optimistic
    const next = await updateGoal({ ritual });
    if (next) setGoal(next);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 1200);
  };

  const update = (next: Settings) => {
    setS(next);
    void saveSettings(next);
    void syncDailyReminder(next, { prompt: true }).then((r) => setPermissionDenied(r === "denied"));
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
        {permissionDenied && (
          <p className="mt-4 text-center text-xs text-dawn-rose/90 leading-relaxed">
            Notifications are blocked for Dawnhalo — allow them in your phone's settings to get
            your daily reminder.
          </p>
        )}
        {!isNative && s.notificationsOn && (
          <p className="mt-4 text-center text-xs opacity-50 leading-relaxed">
            Reminders arrive through the Dawnhalo mobile app.
          </p>
        )}

        {/* What you're holding on for — quiet entry point + ritual switch */}
        <div className="mt-10 bg-dawn-surface/80 border border-dawn-haze/15 rounded-2xl divide-y divide-dawn-haze/10 backdrop-blur-md">
          <Link to="/goal" className="block p-5">
            <p className="font-serif text-lg text-dawn-ink">What you're holding on for</p>
            <p className="text-xs text-dawn-ink/50">
              {goal ? `Day ${goal.day} · ${goal.goal.title}` : "Name one goal and check in daily."}
            </p>
          </Link>
          {goal && (
            <div className="p-5">
              <p className="font-serif text-lg text-dawn-ink mb-1">Daily ritual</p>
              <p className="text-xs text-dawn-ink/50 mb-3">What helps you keep going.</p>
              <div className="flex gap-2">
                {(
                  [
                    { id: "card", label: "Pull a card" },
                    { id: "writing", label: "Write it out" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => switchRitual(opt.id)}
                    className={
                      "px-4 py-2 text-[12px] rounded-full border transition-colors " +
                      (goal.goal.ritual === opt.id
                        ? "bg-dawn-rose/15 border-dawn-rose/40 text-dawn-ink"
                        : "border-dawn-haze/20 text-dawn-ink/75 hover:bg-dawn-haze/10")
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 bg-dawn-surface/80 border border-dawn-haze/15 rounded-2xl divide-y divide-dawn-haze/10 backdrop-blur-md">
          <Link to="/privacy" className="block p-5">
            <p className="font-serif text-lg text-dawn-ink">Privacy</p>
            <p className="text-xs text-dawn-ink/50">What we store, and what we never collect.</p>
          </Link>
          <Link to="/support" className="block p-5">
            <p className="font-serif text-lg text-dawn-ink">Support</p>
            <p className="text-xs text-dawn-ink/50">If today feels heavy, help is here.</p>
          </Link>
        </div>

        <p className="mt-12 text-center text-[10px] uppercase tracking-[0.2em] opacity-30">Dawnhalo · a little light for your next step</p>
      </main>
      <BottomNav />
    </div>
  );
}
