import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  getDailyWithEntitlement,
  drawCardEx,
  offlineDailyCard,
  type Card,
  type Entitlement,
} from "@/lib/cards";
import { getCalendar } from "@/lib/store";
import { REMINDERS } from "@/lib/dawnhalo";
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
  const [activeCard, setActiveCard] = useState<Card>(() => offlineDailyCard(today));
  const [streak, setStreak] = useState(0);
  const [reminders, setReminders] = useState<[string, string]>([REMINDERS[0], REMINDERS[1]]);
  const [input, setInput] = useState("");
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [dateLabel, setDateLabel] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getDailyWithEntitlement().then(({ card, entitlement }) => {
      if (!alive) return;
      setActiveCard(card);
      if (entitlement) setEntitlement(entitlement);
    });
    getCalendar().then(({ streak }) => alive && setStreak(streak));
    setDateLabel(formatDate(today));
    const a = Math.floor(Math.random() * REMINDERS.length);
    let b = Math.floor(Math.random() * REMINDERS.length);
    if (b === a) b = (b + 1) % REMINDERS.length;
    setReminders([REMINDERS[a], REMINDERS[b]]);
    return () => {
      alive = false;
    };
  }, [today]);

  const remaining = entitlement?.freeDrawsRemaining ?? null; // -1 unlimited, null unknown
  const unlimited = entitlement?.subscribed || remaining === -1;

  const handleOutcome = (out: Awaited<ReturnType<typeof drawCardEx>>) => {
    if (out.kind === "crisis") {
      navigate({ to: "/support" });
      return false;
    }
    if (out.kind === "paywall") {
      navigate({ to: "/paywall" });
      return false;
    }
    setActiveCard(out.card);
    if (out.entitlement) setEntitlement(out.entitlement);
    return true;
  };

  const submitInput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || busy) return;
    setBusy(true);
    try {
      const out = await drawCardEx({ intent: "ask", text: input });
      if (handleOutcome(out)) setInput("");
    } finally {
      setBusy(false);
    }
  };

  const drawAgain = async () => {
    if (busy) return;
    setBusy(true);
    try {
      handleOutcome(await drawCardEx({ intent: "ask", text: "" }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-dawn-sky text-dawn-ink selection:bg-dawn-haze/20 overflow-hidden">
      {/* Ambient warm horizon glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full blur-[120px] opacity-60"
        style={{
          background:
            "radial-gradient(circle, rgba(245,207,138,0.35) 0%, rgba(244,163,122,0.18) 35%, rgba(189,92,120,0.10) 60%, transparent 75%)",
        }}
      />
      <main className="relative max-w-md mx-auto px-6 pt-12 pb-32">
        <header className="mb-10 flex justify-between items-end">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-50 mb-1">{dateLabel}</p>
            <h1 className="text-3xl font-serif font-light tracking-tight italic">Good morning.</h1>
          </div>
          <div className="text-right">
            <span className="block text-2xl font-serif italic text-dawn-haze">{String(streak).padStart(2, "0")}</span>
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
              className="w-full bg-dawn-surface/70 backdrop-blur-md text-dawn-ink placeholder:text-dawn-ink/30 border border-dawn-haze/15 rounded-2xl p-5 pr-16 text-sm leading-relaxed focus:outline-none focus:ring-1 ring-dawn-rose/30 min-h-[120px] shadow-[0_20px_60px_-30px_rgba(245,180,120,0.25)] resize-none" />
            <button type="submit" aria-label="Draw a card from your prompt" disabled={busy}
              className="absolute bottom-4 right-4 size-11 bg-dawn-rose text-dawn-sky border border-dawn-haze/40 rounded-full flex items-center justify-center hover:bg-dawn-haze transition-colors disabled:opacity-50">
              <svg viewBox="0 0 24 24" fill="none" className="size-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          </form>
          <p className="mt-2 ml-1 text-[10px] uppercase tracking-[0.18em] opacity-40">
            {unlimited
              ? "Unlimited draws"
              : remaining === null
                ? " "
                : remaining > 0
                  ? `${remaining} free draw${remaining === 1 ? "" : "s"} left today`
                  : "Free draws used — open a plan to keep drawing"}
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <p className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-50 ml-1">Reminders for today</p>
          {reminders.map((r, i) => (
            <div key={i} className="flex items-start gap-4 p-5 bg-dawn-surface/60 backdrop-blur-md border border-dawn-haze/15 rounded-xl">
              <div className="mt-1.5 size-1.5 rounded-full bg-dawn-rose shrink-0" />
              <p className="text-sm leading-relaxed italic font-serif text-dawn-ink/85">{r}</p>
            </div>
          ))}
        </section>

        <div className="mt-16 pt-8 border-t border-dawn-haze/10 text-center">
          <p className="text-[10px] uppercase tracking-widest opacity-30">In need of immediate support?</p>
          <div className="mt-3 flex justify-center gap-6">
            <a href="tel:988" className="text-[11px] font-medium border-b border-dawn-haze/20">US — call or text 988</a>
            <a href="tel:116123" className="text-[11px] font-medium border-b border-dawn-haze/20">UK — Samaritans 116 123</a>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
