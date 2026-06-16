import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { loadSaved, ART, type OracleCard } from "@/lib/dawnhalo";
import { OracleCardView } from "@/components/OracleCard";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/saved")({
  head: () => ({ meta: [{ title: "Saved — Dawnhalo" }, { name: "description", content: "Your collected cards." }] }),
  component: SavedPage,
});

function SavedPage() {
  const [cards] = useState<OracleCard[]>(() => loadSaved());
  const [open, setOpen] = useState<OracleCard | null>(null);

  return (
    <div className="min-h-screen bg-dawn-sky">
      <main className="max-w-md mx-auto px-6 pt-12 pb-32">
        <header className="mb-10">
          <p className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-50 mb-1">Your saved cards</p>
          <h1 className="text-3xl font-serif font-light tracking-tight italic">Saved cards.</h1>
        </header>

        {open ? (
          <div>
            <button onClick={() => setOpen(null)} className="mb-6 text-[10px] uppercase tracking-[0.18em] opacity-60">← Back to saved cards</button>
            <OracleCardView card={open} readOnly />
          </div>
        ) : cards.length === 0 ? (
          <div className="p-8 border border-dashed border-dawn-ink/15 rounded-2xl text-center">
            <p className="font-serif italic text-lg opacity-70">Your saved cards are quiet for now.</p>
            <p className="mt-2 text-sm opacity-50">Tap <span className="font-medium">Save</span> on a card to keep it here.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {cards.map((c) => (
              <li key={c.id}>
                <button onClick={() => setOpen(c)} className="w-full flex items-center gap-4 p-3 bg-white border border-dawn-ink/5 rounded-xl text-left hover:bg-dawn-glow/50 transition-colors">
                  <img src={artForCard(c)} alt="" width={64} height={80} className="size-16 rounded-md object-cover ring-1 ring-dawn-ink/5" loading="lazy" />
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-lg leading-tight truncate">{c.title}</p>
                    <p className="text-xs opacity-60 truncate">{c.message}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-widest opacity-40">
                      Saved {new Date(c.savedAt ?? c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
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
