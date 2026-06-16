import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  drawDailyCard, drawRandomCard, askOracle, recordHistory, loadHistory,
  computeStreak, REMINDERS, bumpDrawCount, getDrawCount, FREE_DRAWS,
  type OracleCard,
} from "@/lib/dawnhalo";
import { OracleCardView } from "@/components/OracleCard";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Today — Dawnhalo" },
      { name: "description", content: "Your daily oracle card and a quiet moment of clarity." },
    ],
  }),
  component: TodayPage,
});

function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function TodayPage() {
  const navigate = useNavigate();
  const [today] = useState(() => new Date());
  const [activeCard, setActiveCard] = useState<OracleCard>(() => drawDailyCard(today));
  const [streak, setStreak] = useState(0);
  const [reminders] = useState(() => {
    const a = Math.floor(Math.random() * REMINDERS.length);
    let b = Math.floor(Math.random() * REMINDERS.length);
    if (b === a) b = (b + 1) % REMINDERS.length;
    return [REMINDERS[a], REMINDERS[b]];
  });
  const [input, setInput] = useState("");
  const [drawCount, setDrawCount] = useState(0);

  useEffect(() => {
    recordHistory(drawDailyCard(today));
    setStreak(computeStreak(loadHistory()));
    setDrawCount(getDrawCount());
  }, [today]);

  const remaining = useMemo(() => Math.max(0, FREE_DRAWS - drawCount), [drawCount]);

  const handleNewCard = (card: OracleCard) => {
    recordHistory(card);
    bumpDrawCount();
    setDrawCount(getDrawCount());
    setActiveCard(card);
  };

  const submitInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    if (remaining <= 0) { navigate({ to: "/paywall" }); return; }
    const r = askOracle(input);
    if (r.kind === "crisis") { navigate({ to: "/support" }); return; }
    handleNewCard(r.card);
    setInput("");
  };

  const drawAgain = () => {
    if (remaining <= 0) { navigate({ to: "/paywall" }); return; }
    handleNewCard(drawRandomCard());
  };

  return (
    <div className="min-h-screen bg-dawn-sky text-dawn-ink selection:bg-dawn-rose/10">
      <main className="max-w-md mx-auto px-6 pt-12 pb-32">
        <header className="mb-10 flex justify-between items-end">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-50 mb-1">{formatDate(today)}</p>
            <h1 className="text-3xl font-serif font-light tracking-tight italic">Good morning.</h1>
          </div>
          <div className="text-right">
            <span className="block text-2xl font-serif italic">{String(streak).padStart(2, "0")}</span>
            <span className="text-[8px] uppercase tracking-widest opacity-40">Day streak</span>
          </div>
        </header>

        <OracleCardView key={activeCard.id} card={activeCard} onDrawAgain={drawAgain} />

        <section className="mt-12">
          <form onSubmit={submitInput} className="relative">
            <label className="block text-[10px] uppercase tracking-[0.2em] font-medium opacity-50 mb-3 ml-1">Ask the oracle</label>
            <textarea value={input} onChange={(e) => setInput(e.target.value)}
              rows={3}
              placeholder="What's on your mind?"
              className="w-full bg-white border border-dawn-ink/5 rounded-2xl p-5 pr-16 text-sm leading-relaxed focus:outline-none focus:ring-1 ring-dawn-rose/20 min-h-[120px] shadow-sm resize-none" />
            <button type="submit" aria-label="Draw a card from your prompt"
              className="absolute bottom-4 right-4 size-11 bg-dawn-glow border border-dawn-haze/40 rounded-full flex items-center justify-center text-dawn-ink hover:bg-dawn-rose hover:text-white transition-colors">
              <svg viewBox="0 0 24 24" fill="none" className="size-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          </form>
          <p className="mt-2 ml-1 text-[10px] uppercase tracking-[0.18em] opacity-40">
            {remaining > 0 ? `${remaining} free draw${remaining === 1 ? "" : "s"} left today` : "Free draws used — open a plan to keep drawing"}
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <p className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-50 ml-1">Reminders for today</p>
          {reminders.map((r, i) => (
            <div key={i} className="flex items-start gap-4 p-5 bg-dawn-glow/60 border border-dawn-haze/20 rounded-xl">
              <div className="mt-1.5 size-1.5 rounded-full bg-dawn-rose shrink-0" />
              <p className="text-sm leading-relaxed italic font-serif">{r}</p>
            </div>
          ))}
        </section>

        <div className="mt-16 pt-8 border-t border-dawn-ink/5 text-center">
          <p className="text-[10px] uppercase tracking-widest opacity-30">In need of immediate support?</p>
          <div className="mt-3 flex justify-center gap-6">
            <a href="tel:988" className="text-[11px] font-medium border-b border-dawn-ink/10">US — call or text 988</a>
            <a href="tel:116123" className="text-[11px] font-medium border-b border-dawn-ink/10">UK — Samaritans 116 123</a>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
