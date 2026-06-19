import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getSaved, type SavedCard } from "@/lib/store";
import { OracleCardView } from "@/components/OracleCard";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/saved")({
  head: () => ({ meta: [{ title: "Saved — Dawnhalo" }, { name: "description", content: "Your collected cards." }] }),
  component: SavedPage,
});

function SavedPage() {
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [open, setOpen] = useState<SavedCard | null>(null);

  useEffect(() => {
    let alive = true;
    getSaved().then((list) => alive && setCards(list));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-dawn-sky text-dawn-ink">
      <main className="max-w-md mx-auto px-6 pt-12 pb-32">
        <header className="mb-10">
          <p className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-50 mb-1">Your saved cards</p>
          <h1 className="text-3xl font-serif font-light tracking-tight italic">Saved cards.</h1>
        </header>

        {open ? (
          <div>
            <button onClick={() => setOpen(null)} className="mb-6 text-[10px] uppercase tracking-[0.18em] text-dawn-ink/60 hover:text-dawn-ink transition-colors">← Back to saved cards</button>
            <OracleCardView card={open} readOnly />
          </div>
        ) : cards.length === 0 ? (
          <div className="p-8 border border-dashed border-dawn-haze/15 rounded-2xl text-center">
            <p className="font-serif italic text-lg text-dawn-ink/70">Your saved cards are quiet for now.</p>
            <p className="mt-2 text-sm text-dawn-ink/50">Tap <span className="font-medium">Save</span> on a card to keep it here.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {cards.map((c) => (
              <li key={c.id}>
                <button onClick={() => setOpen(c)} className="w-full flex items-center gap-4 p-3 bg-dawn-surface/70 border border-dawn-haze/15 rounded-xl text-left hover:bg-dawn-haze/10 transition-colors backdrop-blur-md">
                  <img src={c.illustration} alt="" width={64} height={80} className="size-16 rounded-md object-cover ring-1 ring-dawn-haze/15" loading="lazy" />
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-lg leading-tight text-dawn-ink">{c.title}</p>
                    <p className="text-xs text-dawn-ink/60 truncate">{c.message}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-widest text-dawn-ink/40">
                      Saved {new Date(c.savedAt ?? c.createdAt ?? Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
