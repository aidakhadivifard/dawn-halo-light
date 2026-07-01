import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getCalendar } from "@/lib/store";
import type { Card } from "@/lib/cards";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/calendar")({
  head: () => ({ meta: [{ title: "History — Dawnhalo" }, { name: "description", content: "Your past cards and streak." }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    let alive = true;
    getCalendar().then(({ byDay, streak }) => {
      if (!alive) return;
      const all: Card[] = [];
      const sortedDays = Object.keys(byDay).sort((a, b) => b.localeCompare(a));
      for (const day of sortedDays) all.push(...byDay[day]);
      setCards(all);
      setStreak(streak);
    });
    return () => { alive = false; };
  }, []);

  return (
    <div className="min-h-screen bg-dawn-sky text-dawn-ink">
      <main className="max-w-md mx-auto px-6 pt-12 pb-32">
        <header className="mb-8 flex justify-between items-end">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-50 mb-1">Your cards</p>
            <h1 className="text-3xl font-serif font-light tracking-tight italic">History.</h1>
          </div>
          <div className="text-right">
            <span className="block text-2xl font-serif italic text-dawn-haze">{String(streak).padStart(2, "0")}</span>
            <span className="text-[8px] uppercase tracking-widest opacity-40">Day streak</span>
          </div>
        </header>

        {cards.length === 0 ? (
          <p className="p-5 border border-dashed border-dawn-haze/15 rounded-xl text-sm italic opacity-60">No cards drawn yet.</p>
        ) : (
          <ul className="space-y-3">
            {cards.map((c) => (
              <li key={c.id} className="flex items-start gap-4 p-4 bg-dawn-surface/70 border border-dawn-haze/15 rounded-xl backdrop-blur-md">
                <img src={c.illustration} alt="" width={56} height={70} className="size-14 rounded-md object-cover ring-1 ring-dawn-haze/15 shrink-0" loading="lazy" />
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-lg leading-tight text-dawn-ink">{c.title}</p>
                  <p className="text-xs text-dawn-ink/60 line-clamp-2 mt-0.5">{c.message}</p>
                  {c.createdAt && (
                    <p className="text-[10px] text-dawn-ink/35 mt-1">
                      {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
