import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { getCalendar } from "@/lib/store";
import type { Card } from "@/lib/cards";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/calendar")({
  head: () => ({ meta: [{ title: "Calendar — Dawnhalo" }, { name: "description", content: "Your daily practice over time." }] }),
  component: CalendarPage,
});

// Local YYYY-MM-DD key, matching the backend's local_date keys.
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function CalendarPage() {
  const today = new Date();
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [byDay, setByDay] = useState<Record<string, Card[]>>({});
  const [streak, setStreak] = useState(0);
  const [selected, setSelected] = useState<Date | null>(today);

  useEffect(() => {
    let alive = true;
    getCalendar().then(({ byDay, streak }) => {
      if (!alive) return;
      setByDay(byDay);
      setStreak(streak);
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

  return (
    <div className="min-h-screen bg-dawn-sky">
      <main className="max-w-md mx-auto px-6 pt-12 pb-32">
        <header className="mb-8 flex justify-between items-end">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-50 mb-1">Your practice</p>
            <h1 className="text-3xl font-serif font-light tracking-tight italic">Calendar.</h1>
          </div>
          <div className="text-right">
            <span className="block text-2xl font-serif italic">{String(streak).padStart(2, "0")}</span>
            <span className="text-[8px] uppercase tracking-widest opacity-40">Day streak</span>
          </div>
        </header>

        <div className="bg-white border border-dawn-ink/5 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              className="size-8 rounded-full hover:bg-dawn-glow text-dawn-ink/60">‹</button>
            <p className="font-serif text-lg">{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              className="size-8 rounded-full hover:bg-dawn-glow text-dawn-ink/60">›</button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {["S","M","T","W","T","F","S"].map((d, i) => (
              <span key={i} className="text-[9px] uppercase tracking-widest opacity-40">{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((c, i) => {
              if (!c) return <span key={i} className="aspect-square" />;
              const has = !!byDay[ymd(c)];
              const isToday = ymd(c) === ymd(today);
              const isSel = !!selected && ymd(c) === ymd(selected);
              return (
                <button key={i} onClick={() => setSelected(c)}
                  className={
                    "aspect-square rounded-full flex items-center justify-center text-sm relative transition-colors " +
                    (isSel ? "bg-dawn-ink text-white" : has ? "bg-dawn-glow text-dawn-ink" : "hover:bg-dawn-glow/50") +
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
          <section className="mt-8">
            <p className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-50 mb-3 ml-1">
              {selected.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
            {dayCards.length === 0 ? (
              <p className="p-5 border border-dashed border-dawn-ink/15 rounded-xl text-sm italic opacity-60">No card on this day.</p>
            ) : (
              <ul className="space-y-3">
                {dayCards.map((c) => (
                  <li key={c.id} className="flex items-start gap-4 p-4 bg-white border border-dawn-ink/5 rounded-xl">
                    <img src={c.illustration} alt="" width={56} height={70} className="size-14 rounded-md object-cover ring-1 ring-dawn-ink/5" loading="lazy" />
                    <div className="min-w-0">
                      <p className="font-serif text-lg leading-tight">{c.title}</p>
                      <p className="text-xs opacity-60 line-clamp-2">{c.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
