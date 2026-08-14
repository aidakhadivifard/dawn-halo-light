// The Journal — memory, not administration. One place for readings,
// reflections, dreams, check-ins and written rituals, searchable.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { getCalendar } from "@/lib/store";
import { api } from "@/lib/api";
import type { CheckinState } from "@/lib/api";
import type { Card } from "@/lib/cards";
import { BottomNav } from "@/components/BottomNav";
import { STATE_OPTIONS } from "@/lib/goalCopy";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Journal — Dawnhalo" },
      { name: "description", content: "What you have carried, learned or dreamed." },
    ],
  }),
  component: JournalPage,
});

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface GoalDay {
  state?: CheckinState;
  note?: string;
  userText?: string;
  aiReflection?: string;
}

function JournalPage() {
  const today = new Date();
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [byDay, setByDay] = useState<Record<string, Card[]>>({});
  const [streak, setStreak] = useState(0);
  const [selected, setSelected] = useState<Date | null>(today);
  const [goalDays, setGoalDays] = useState<Record<string, GoalDay>>({});
  const [journeyLocked, setJourneyLocked] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    getCalendar().then(({ byDay, streak }) => {
      if (!alive) return;
      setByDay(byDay);
      setStreak(streak);
    });
    api
      .goalHistory()
      .then(({ checkins, entries }) => {
        if (!alive) return;
        const merged: Record<string, GoalDay> = {};
        for (const c of checkins) merged[c.date] = { state: c.state, note: c.note };
        for (const e of entries) {
          merged[e.date] = { ...merged[e.date], userText: e.userText, aiReflection: e.aiReflection };
        }
        setGoalDays(merged);
      })
      .catch((e: any) => {
        if (!alive) return;
        if (e?.message === "paywall" || e?.reason) setJourneyLocked(true);
        // no goal / offline → journal simply shows readings
      });
    return () => {
      alive = false;
    };
  }, []);

  const firstWeekday = month.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d));

  const dayCards: Card[] = selected ? byDay[ymd(selected)] || [] : [];
  const dayGoal: GoalDay | undefined = selected ? goalDays[ymd(selected)] : undefined;

  // Search across everything kept.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: { date: string; kind: string; text: string }[] = [];
    for (const [date, cards] of Object.entries(byDay)) {
      for (const c of cards) {
        if (`${c.title} ${c.message}`.toLowerCase().includes(q)) {
          out.push({ date, kind: "Reading", text: `${c.title} — ${c.message.slice(0, 120)}` });
        }
      }
    }
    for (const [date, g] of Object.entries(goalDays)) {
      const blob = `${g.note ?? ""} ${g.userText ?? ""} ${g.aiReflection ?? ""}`.toLowerCase();
      if (blob.trim() && blob.includes(q)) {
        out.push({ date, kind: "Journey", text: (g.userText ?? g.note ?? g.aiReflection ?? "").slice(0, 140) });
      }
    }
    return out.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 30);
  }, [query, byDay, goalDays]);

  const stateLabel = (s?: CheckinState) => STATE_OPTIONS.find((o) => o.id === s)?.label;

  return (
    <div className="min-h-screen bg-dawn-sky text-dawn-ink">
      <main className="max-w-md mx-auto px-6 pt-12 pb-32">
        <header className="mb-6 flex justify-between items-end">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-50 mb-1">Your memory</p>
            <h1 className="text-3xl font-serif font-light tracking-tight italic">Journal.</h1>
          </div>
          {/* The streak is hidden until it exists — "00 STREAK" is shaming
              an empty page (same rule as Today). Never zero-padded. */}
          {streak > 0 && (
            <div className="text-right">
              <span className="block text-2xl font-serif italic text-dawn-haze">{streak}</span>
              <span className="text-[8px] uppercase tracking-widest opacity-40">Day streak</span>
            </div>
          )}
        </header>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search what you have carried, learned or dreamed."
          className="mb-6 w-full bg-dawn-surface/70 border border-dawn-haze/15 rounded-xl px-5 py-3 text-sm focus:outline-none focus:ring-1 ring-dawn-rose/30 placeholder:text-dawn-ink/30"
        />

        {query.trim() ? (
          <section className="space-y-3">
            {results.length === 0 ? (
              <p className="p-5 border border-dashed border-dawn-haze/15 rounded-xl text-sm italic opacity-60">
                Nothing kept matches that yet.
              </p>
            ) : (
              results.map((r, i) => (
                <div key={i} className="p-4 bg-dawn-surface/70 border border-dawn-haze/15 rounded-xl">
                  <p className="text-[10px] uppercase tracking-[0.18em] opacity-40">
                    {r.date} · {r.kind}
                  </p>
                  <p className="mt-1 text-sm text-dawn-ink/80">{r.text}</p>
                </div>
              ))
            )}
          </section>
        ) : (
          <>
            <div className="bg-dawn-surface/80 border border-dawn-haze/15 rounded-2xl p-5 backdrop-blur-md">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                  className="size-8 rounded-full hover:bg-dawn-haze/10 text-dawn-ink/60 transition-colors">‹</button>
                <p className="font-serif text-lg text-dawn-ink">{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
                <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                  className="size-8 rounded-full hover:bg-dawn-haze/10 text-dawn-ink/60 transition-colors">›</button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {["S","M","T","W","T","F","S"].map((d, i) => (
                  <span key={i} className="text-[9px] uppercase tracking-widest text-dawn-ink/40">{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((c, i) => {
                  if (!c) return <span key={i} className="aspect-square" />;
                  const key = ymd(c);
                  const has = !!byDay[key] || !!goalDays[key];
                  const isToday = key === ymd(today);
                  const isSel = !!selected && key === ymd(selected);
                  return (
                    <button key={i} onClick={() => setSelected(c)}
                      className={
                        "aspect-square rounded-full flex items-center justify-center text-sm relative transition-colors " +
                        (isSel ? "bg-dawn-rose text-dawn-sky" : has ? "bg-dawn-haze/15 text-dawn-ink" : "text-dawn-ink/60 hover:bg-dawn-haze/10") +
                        (isToday && !isSel ? " ring-1 ring-dawn-rose" : "")
                      }>
                      {c.getDate()}
                      {has && !isSel && <span className="absolute bottom-1 size-1 rounded-full bg-dawn-rose" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {selected && (
              <section className="mt-8 space-y-3">
                <p className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-50 ml-1">
                  {selected.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </p>

                {dayGoal?.state && (
                  <div className="p-4 bg-dawn-surface/70 border border-dawn-haze/15 rounded-xl">
                    <p className="text-[10px] uppercase tracking-[0.18em] opacity-40">Check-in</p>
                    <p className="mt-1 font-serif text-base">{stateLabel(dayGoal.state)}</p>
                    {dayGoal.note && <p className="mt-1 text-sm text-dawn-ink/70 italic">“{dayGoal.note}”</p>}
                    {dayGoal.userText && (
                      <p className="mt-2 text-sm text-dawn-ink/70 italic">“{dayGoal.userText}”</p>
                    )}
                    {dayGoal.aiReflection && (
                      <p className="mt-1 text-xs text-dawn-ink/50">{dayGoal.aiReflection}</p>
                    )}
                  </div>
                )}

                {dayCards.length === 0 && !dayGoal?.state ? (
                  <p className="p-5 border border-dashed border-dawn-haze/15 rounded-xl text-sm italic opacity-60">
                    Your journal begins with the moments you choose to keep.
                  </p>
                ) : (
                  dayCards.map((c) => (
                    <div key={c.id} className="flex items-start gap-4 p-4 bg-dawn-surface/70 border border-dawn-haze/15 rounded-xl backdrop-blur-md">
                      <img src={c.illustration} alt="" width={56} height={70} className="size-14 rounded-md object-cover ring-1 ring-dawn-haze/15" loading="lazy" />
                      <div className="min-w-0">
                        <p className="font-serif text-lg leading-tight text-dawn-ink">{c.title}</p>
                        <p className="text-xs text-dawn-ink/60 line-clamp-2">{c.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </section>
            )}

            {journeyLocked && (
              <Link to="/paywall" className="mt-6 block p-4 bg-dawn-surface/60 border border-dawn-haze/15 rounded-xl text-center">
                <p className="text-sm font-serif italic text-dawn-ink/70">
                  Keep the full history of your journey with Dawnhalo Premium.
                </p>
              </Link>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
