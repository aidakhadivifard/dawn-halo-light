import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  getDailyWithEntitlement,
  drawCardEx,
  offlineDailyCard,
  type Card,
  type Entitlement,
} from "@/lib/cards";
import { getCalendar } from "@/lib/store";
import { todayReminder } from "@/lib/dawnhalo";
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

type RitualState = "arrival" | "drawing" | "reveal" | "open";

// A gentle floor on the ritual so the draw never feels instant — but we don't
// pile extra time on top of slow network latency. Total ≈ max(latency, floor).
const RITUAL_FLOOR_MS = 1100;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function TodayPage() {
  const navigate = useNavigate();
  const [today] = useState(() => new Date());
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [streak, setStreak] = useState(0);
  const [reminder, setReminder] = useState("");
  const [input, setInput] = useState("");
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [dateLabel, setDateLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [ritual, setRitual] = useState<RitualState>("arrival");
  const [hasDrawnToday, setHasDrawnToday] = useState(false);
  const [intention, setIntention] = useState("");
  const [showOther, setShowOther] = useState(false);

  const INTENTIONS = ["I need clarity", "I need calm", "I need courage"];

  useEffect(() => {
    let alive = true;
    getDailyWithEntitlement().then(({ card, entitlement }) => {
      if (!alive) return;
      setActiveCard(card);
      if (entitlement) setEntitlement(entitlement);
      setHasDrawnToday(true);
      setReminder(todayReminder({ title: card.title, theme: card.theme }));
    });
    getCalendar().then(({ streak }) => alive && setStreak(streak));
    setDateLabel(formatDate(today));
    setReminder(todayReminder());
    return () => {
      alive = false;
    };
  }, [today]);

  const remaining = entitlement?.freeDrawsRemaining ?? null;
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
    setReminder(todayReminder({ title: out.card.title, theme: out.card.theme }));
    return true;
  };

  // Draw the card. If the user set an intention, the card responds to it;
  // otherwise it's the gentle daily reading.
  const drawMyCard = useCallback(
    async (withIntention: string) => {
      setRitual("drawing");
      setBusy(true);
      const started = Date.now();
      try {
        if (withIntention.trim()) {
          const out = await drawCardEx({ intent: "ask", text: withIntention });
          if (!handleOutcome(out)) return;
        } else {
          const { card, entitlement } = await getDailyWithEntitlement();
          setActiveCard(card);
          if (entitlement) setEntitlement(entitlement);
        }
        setHasDrawnToday(true);
        await sleep(Math.max(0, RITUAL_FLOOR_MS - (Date.now() - started)));
        setRitual("reveal");
      } catch {
        setActiveCard(offlineDailyCard(today));
        setHasDrawnToday(true);
        await sleep(Math.max(0, RITUAL_FLOOR_MS - (Date.now() - started)));
        setRitual("reveal");
      } finally {
        setBusy(false);
      }
    },
    [today],
  );

  const submitInput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || busy) return;
    setRitual("drawing");
    setBusy(true);
    const started = Date.now();
    try {
      const out = await drawCardEx({ intent: "ask", text: input });
      if (handleOutcome(out)) {
        setInput("");
        await sleep(Math.max(0, RITUAL_FLOOR_MS - (Date.now() - started)));
        setRitual("reveal");
      }
    } finally {
      setBusy(false);
    }
  };

  const drawAgain = async () => {
    if (busy) return;
    setRitual("drawing");
    setBusy(true);
    const started = Date.now();
    try {
      const out = await drawCardEx({ intent: "ask", text: "" });
      if (handleOutcome(out)) {
        await sleep(Math.max(0, RITUAL_FLOOR_MS - (Date.now() - started)));
        setRitual("reveal");
      }
    } finally {
      setBusy(false);
    }
  };

  const revealMessage = () => setRitual("open");

  const greetingHour = today.getHours();
  const greeting =
    greetingHour < 12 ? "Good morning." : greetingHour < 17 ? "Good afternoon." : "Good evening.";

  return (
    <div className="relative min-h-screen bg-dawn-sky text-dawn-ink selection:bg-dawn-haze/20 overflow-hidden">
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
            <h1 className="text-3xl font-serif font-light tracking-tight italic">{greeting}</h1>
          </div>
          <div className="text-right">
            <span className="block text-2xl font-serif italic text-dawn-haze">{String(streak).padStart(2, "0")}</span>
            <span className="text-[8px] uppercase tracking-widest opacity-40">Day streak</span>
          </div>
        </header>

        {/* STATE 1: Arrival / Intention — what brought you here today? */}
        {ritual === "arrival" && (
          <section className="flex flex-col items-center text-center py-10 animate-card-rise">
            <div className="relative w-40 h-40 mb-6">
              <div
                aria-hidden
                className="absolute inset-0 rounded-full blur-[60px] opacity-70 animate-halo"
                style={{ background: "radial-gradient(circle, rgba(245,207,138,0.5) 0%, rgba(244,163,122,0.25) 50%, transparent 75%)" }}
              />
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="absolute size-1.5 rounded-full bg-dawn-gold/60 animate-float-drift"
                  style={{ top: `${20 + i * 14}%`, left: `${15 + i * 16}%`, animationDelay: `${i * 1.1}s` }}
                />
              ))}
            </div>

            <h2 className="text-2xl font-serif font-light tracking-tight text-balance text-dawn-ink">
              What brought you here today?
            </h2>
            <p className="mt-3 text-dawn-ink/50 text-sm leading-relaxed max-w-[30ch]">
              You can type it, choose a feeling, or simply hold it in your mind.
            </p>

            <div className="mt-7 flex flex-wrap justify-center gap-2 max-w-sm">
              {INTENTIONS.map((label) => (
                <button key={label}
                  onClick={() => { setIntention(label); setShowOther(false); }}
                  className={
                    "text-[12px] px-4 py-2.5 rounded-full border transition-colors " +
                    (intention === label
                      ? "bg-dawn-rose/15 border-dawn-rose/40 text-dawn-ink"
                      : "border-dawn-haze/20 text-dawn-ink/75 hover:bg-dawn-haze/10")
                  }>
                  {label}
                </button>
              ))}
              <button
                onClick={() => { setShowOther(true); setIntention(""); }}
                className={
                  "text-[12px] px-4 py-2.5 rounded-full border transition-colors " +
                  (showOther
                    ? "bg-dawn-rose/15 border-dawn-rose/40 text-dawn-ink"
                    : "border-dawn-haze/20 text-dawn-ink/75 hover:bg-dawn-haze/10")
                }>
                Something else…
              </button>
            </div>

            {showOther && (
              <input
                autoFocus
                value={intention}
                onChange={(e) => setIntention(e.target.value)}
                placeholder="What's on your mind?"
                className="mt-4 w-full max-w-sm bg-dawn-surface/70 text-dawn-ink placeholder:text-dawn-ink/30 border border-dawn-haze/15 rounded-xl px-5 py-3.5 text-sm text-center focus:outline-none focus:ring-1 ring-dawn-rose/30"
              />
            )}

            <button
              onClick={() => drawMyCard(intention)}
              disabled={busy}
              className="mt-8 px-10 py-4 bg-dawn-rose text-dawn-sky text-sm uppercase tracking-[0.2em] font-bold rounded-full shadow-[0_12px_40px_-12px_rgba(244,163,122,0.5)] hover:shadow-[0_16px_50px_-12px_rgba(244,163,122,0.6)] hover:bg-dawn-haze transition-all disabled:opacity-50"
            >
              Draw My Card
            </button>
            <button
              onClick={() => drawMyCard("")}
              disabled={busy}
              className="mt-4 text-[11px] uppercase tracking-[0.18em] text-dawn-ink/40 hover:text-dawn-ink/70 transition-colors disabled:opacity-50"
            >
              I'll skip for now
            </button>
          </section>
        )}

        {/* STATE 2: Ritual — take a slow breath */}
        {ritual === "drawing" && (
          <section className="flex flex-col items-center text-center py-16">
            <div className="relative w-56 h-56 mb-6">
              <div
                aria-hidden
                className="absolute inset-0 rounded-full blur-[80px] animate-halo-breathe"
                style={{ background: "radial-gradient(circle, rgba(245,207,138,0.6) 0%, rgba(244,163,122,0.35) 40%, transparent 70%)" }}
              />
            </div>
            <p className="font-serif text-lg italic text-dawn-ink/80 animate-card-rise leading-relaxed">
              Take a slow breath.
              <br />
              We're drawing a card just for you.
            </p>
            <p className="mt-4 text-[11px] uppercase tracking-[0.2em] text-dawn-haze/70 animate-card-rise">
              Drawing your card…
            </p>
          </section>
        )}

        {/* STATE 3: Reveal — card visible but message hidden */}
        {ritual === "reveal" && activeCard && (
          <div className="animate-card-draw">
            <article className="relative group">
              <div
                aria-hidden
                className="absolute -inset-12 -z-10 rounded-[3rem] blur-3xl animate-halo opacity-80"
                style={{
                  background:
                    "radial-gradient(60% 55% at 50% 40%, rgba(245,207,138,0.55) 0%, rgba(244,163,122,0.35) 35%, rgba(189,92,120,0.18) 65%, transparent 80%)",
                }}
              />
              <div className="relative rounded-2xl p-7 sm:p-8 border border-dawn-haze/15 bg-dawn-surface/80 backdrop-blur-xl shadow-[0_40px_120px_-30px_rgba(245,180,120,0.35),inset_0_1px_0_rgba(255,220,180,0.08)]">
                <div className="w-full aspect-[4/5] mb-7 rounded-lg overflow-hidden ring-1 ring-dawn-haze/15 bg-black/30">
                  <img src={activeCard.illustration} alt={activeCard.title} width={768} height={1152} className="h-full w-full object-cover" loading="lazy" />
                </div>

                <p className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-40 mb-2">Today's Card</p>
                <h2 className="text-3xl font-serif font-light tracking-tight text-balance text-dawn-ink">{activeCard.title}</h2>

                <button
                  onClick={revealMessage}
                  className="mt-8 w-full py-4 bg-dawn-rose/15 border border-dawn-rose/30 text-dawn-rose text-sm uppercase tracking-[0.2em] font-bold rounded-full hover:bg-dawn-rose/25 transition-colors"
                >
                  Reveal Message
                </button>
                <button
                  onClick={drawAgain}
                  disabled={busy}
                  className="mt-3 w-full py-3 text-[11px] uppercase tracking-[0.18em] text-dawn-ink/45 hover:text-dawn-ink/75 transition-colors disabled:opacity-50"
                >
                  Draw a New Card
                </button>
              </div>
            </article>
          </div>
        )}

        {/* STATE 4: Open — full card with message, actions, follow-up */}
        {ritual === "open" && activeCard && (
          <div className="animate-card-rise">
            <OracleCardView key={activeCard.id} card={activeCard} onDrawAgain={drawAgain} />
          </div>
        )}

        {/* Ask the Oracle — visible only when a card has been fully read */}
        {ritual === "open" && (
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
                  ? " "
                  : remaining > 0
                    ? `${remaining} free draw${remaining === 1 ? "" : "s"} left today`
                    : "Free draws used — open a plan to keep drawing"}
            </p>
          </section>
        )}

        {/* Reminder — one simple daily action */}
        {ritual === "open" && reminder && (
          <section className="mt-10">
            <p className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-50 ml-1 mb-3">Reminder for today</p>
            <div className="flex items-start gap-4 p-5 bg-dawn-surface/60 backdrop-blur-md border border-dawn-haze/15 rounded-xl">
              <div className="mt-1.5 size-1.5 rounded-full bg-dawn-rose shrink-0" />
              <p className="text-sm leading-relaxed text-dawn-ink/85">{reminder}</p>
            </div>
          </section>
        )}

        {ritual === "open" && (
          <div className="mt-16 pt-8 border-t border-dawn-haze/10 text-center">
            <p className="text-[10px] uppercase tracking-widest opacity-30">In need of immediate support?</p>
            <div className="mt-3 flex justify-center gap-6">
              <a href="tel:988" className="text-[11px] font-medium border-b border-dawn-haze/20">US — call or text 988</a>
              <a href="tel:116123" className="text-[11px] font-medium border-b border-dawn-haze/20">UK — Samaritans 116 123</a>
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
