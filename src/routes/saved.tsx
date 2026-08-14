// The Library — saved cards and past readings. A quiet shelf, not a store.
// (The deck's meanings tab is gone: an encyclopedia of unmet cards killed the
// mystery and nobody browsed it — a card explains itself when you open it.)

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getSaved, type SavedCard } from "@/lib/store";
import { api } from "@/lib/api";
import { fromApiCard, type Card } from "@/lib/cards";
import { OracleCardView } from "@/components/OracleCard";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "Library — Dawnhalo" },
      { name: "description", content: "Your saved cards and past readings." },
    ],
  }),
  component: LibraryPage,
});

type Tab = "saved" | "readings";

// The side the card took, worn as a small badge on history rows.
const LEAN_LABELS: Record<string, string> = {
  forward: "leans forward",
  steady: "holds steady",
  caution: "a caution",
};

function LibraryPage() {
  const [tab, setTab] = useState<Tab>("saved");
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [readings, setReadings] = useState<Card[]>([]);
  const [open, setOpen] = useState<Card | null>(null);

  useEffect(() => {
    let alive = true;
    getSaved().then((list) => alive && setCards(list));
    api
      .history()
      .then(({ history }) => alive && setReadings(history.map(fromApiCard).slice(0, 60)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const TABS: { id: Tab; label: string }[] = [
    { id: "saved", label: "Saved" },
    { id: "readings", label: "Past readings" },
  ];

  return (
    <div className="min-h-screen bg-dawn-sky text-dawn-ink">
      <main className="max-w-md mx-auto px-6 pt-12 pb-32">
        <header className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-50 mb-1">Your shelf</p>
          <h1 className="text-3xl font-serif font-light tracking-tight italic">Library.</h1>
        </header>

        {open ? (
          <div>
            <button
              onClick={() => setOpen(null)}
              className="mb-6 text-[10px] uppercase tracking-[0.18em] text-dawn-ink/60 hover:text-dawn-ink transition-colors"
            >
              ← Back to the library
            </button>
            <OracleCardView card={open} readOnly />
          </div>
        ) : (
          <>
            <div className="mb-6 flex gap-2">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={
                    "text-[11px] px-4 py-2 rounded-full border transition-colors " +
                    (tab === t.id
                      ? "bg-dawn-rose/15 border-dawn-rose/40 text-dawn-ink"
                      : "border-dawn-haze/20 text-dawn-ink/70 hover:bg-dawn-haze/10")
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "saved" &&
              (cards.length === 0 ? (
                <div className="p-8 border border-dashed border-dawn-haze/15 rounded-2xl text-center">
                  <p className="font-serif italic text-lg text-dawn-ink/70">Your saved cards are quiet for now.</p>
                  <p className="mt-2 text-sm text-dawn-ink/50">
                    Tap <span className="font-medium">Save</span> on a card to keep it here.
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {cards.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => setOpen(c)}
                        className="w-full flex items-center gap-4 p-3 bg-dawn-surface/70 border border-dawn-haze/15 rounded-xl text-left hover:bg-dawn-haze/10 transition-colors backdrop-blur-md"
                      >
                        <img src={c.illustration} alt="" width={64} height={80} className="size-16 rounded-md object-cover ring-1 ring-dawn-haze/15" loading="lazy" />
                        <div className="min-w-0 flex-1">
                          <p className="font-serif text-lg leading-tight text-dawn-ink">{c.title}</p>
                          <p className="text-xs text-dawn-ink/60 truncate">{c.keepLine ?? c.message}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ))}

            {tab === "readings" &&
              (readings.length === 0 ? (
                <p className="p-5 border border-dashed border-dawn-haze/15 rounded-xl text-sm italic opacity-60">
                  Your past readings will gather here.
                </p>
              ) : (
                <ul className="space-y-3">
                  {readings.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => setOpen(c)}
                        className="w-full flex items-center gap-4 p-3 bg-dawn-surface/70 border border-dawn-haze/15 rounded-xl text-left hover:bg-dawn-haze/10 transition-colors"
                      >
                        <img src={c.illustration} alt="" width={56} height={70} className="size-14 rounded-md object-cover ring-1 ring-dawn-haze/15" loading="lazy" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <p className="font-serif text-base leading-tight text-dawn-ink truncate">{c.title}</p>
                            {c.lean && LEAN_LABELS[c.lean] && (
                              <span className="shrink-0 text-[9px] uppercase tracking-[0.14em] text-dawn-rose/80">
                                {LEAN_LABELS[c.lean]}
                              </span>
                            )}
                          </div>
                          {/* The keep-line doubles as the row's summary — the
                              reading's own one-line memory of that day. */}
                          {c.keepLine && (
                            <p className="mt-0.5 text-xs font-serif italic text-dawn-ink/70 truncate">{c.keepLine}</p>
                          )}
                          <p className="mt-0.5 text-[10px] uppercase tracking-widest text-dawn-ink/40">
                            {c.createdAt
                              ? new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                              : ""}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ))}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
