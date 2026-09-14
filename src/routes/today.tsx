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
import { REMINDERS } from "@/lib/dawnhalo";
import { OracleCardView } from "@/components/OracleCard";
import { BottomNav } from "@/components/BottomNav";
import { VowOnboarding, VowPanel } from "@/components/Vow";
import { getHome, setHorizon, type Home } from "@/lib/vow";
import { HorizonSketch } from "@/components/HorizonSketch";

export const Route = createFileRoute("/today")({
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
  const [reminders, setReminders] = useState<[string, string]>([REMINDERS[0], REMINDERS[1]]);
  const [input, setInput] = useState("");
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [dateLabel, setDateLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [ritual, setRitual] = useState<RitualState>("arrival");
  const [hasDrawnToday, setHasDrawnToday] = useState(false);
  const [intention, setIntention] = useState("");
  const [showOther, setShowOther] = useState(false);
  // Horizon & Roads: undefined = loading; then the horizon (never measured)
  // and up to two roads (vows). `activeRoad` is which road the panel shows;
  // `adding` opens the onboarding for a second road beside an existing one.
  const [home, setHome] = useState<Home | undefined>(undefined);
  const [activeRoad, setActiveRoad] = useState(0);
  const [adding, setAdding] = useState(false);
  const [editingHorizon, setEditingHorizon] = useState(false);
  const [horizonDraft, setHorizonDraft] = useState("");
  // Onboarding stays mounted until it says it is done — background refreshes
  // (the sketch being drawn) must never yank the person out of the ritual.
  const [onboarding, setOnboarding] = useState(false);
  const roads = home?.roads ?? [];
  const current = home === undefined ? undefined : (roads[activeRoad] ?? roads[0] ?? null);
  // The vow the page is about: undefined = loading, null = onboarding, Vow = a road.
  const vow = adding || onboarding ? null : current;
  useEffect(() => {
    if (home && home.roads.length === 0) setOnboarding(true);
  }, [home]);
  // The daily oracle reading is subordinate to the vow: folded behind a quiet
  // link so the vow card keeps its scarcity as the page's one card.
  const [showDaily, setShowDaily] = useState(false);

  const reloadHome = useCallback(async (focusId?: string) => {
    const h = await getHome();
    setHome(h);
    if (focusId) {
      const idx = h.roads.findIndex((r) => r.id === focusId);
      setActiveRoad(idx >= 0 ? idx : 0);
    } else {
      setActiveRoad((i) => Math.min(i, Math.max(0, h.roads.length - 1)));
    }
    setAdding(false);
  }, []);

  /** Re-read home without touching which road is shown or an onboarding in progress. */
  const refreshHome = useCallback(async () => {
    const h = await getHome();
    setHome(h);
  }, []);

  // While the horizon is being drawn, look again every few seconds.
  useEffect(() => {
    if (home?.sketch.status !== "pending") return;
    const t = setInterval(() => void refreshHome(), 4000);
    return () => clearInterval(t);
  }, [home?.sketch.status, refreshHome]);

  const saveHorizon = async () => {
    if (!horizonDraft.trim()) return;
    const out = await setHorizon(horizonDraft.trim());
    if (out.kind === "crisis") {
      navigate({ to: "/support" });
      return;
    }
    setEditingHorizon(false);
    await refreshHome(); // the server may have begun redrawing
  };

  const INTENTIONS = ["I need clarity", "I need calm", "I need courage"];

  useEffect(() => {
    let alive = true;
    getHome().then((h) => {
      if (!alive) return;
      setHome(h);
      setActiveRoad(0);
    });
    getDailyWithEntitlement().then(({ card, entitlement }) => {
      if (!alive) return;
      setActiveCard(card);
      if (entitlement) setEntitlement(entitlement);
      setHasDrawnToday(true);
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
    <div className="relative min-h-screen bg-dawn-sky text-dawn-ink selection:bg-dawn-haze/20 overflow-clip">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full blur-[120px] opacity-75"
        style={{
          background:
            "radial-gradient(circle, rgba(245,207,138,0.35) 0%, rgba(244,163,122,0.18) 35%, rgba(189,92,120,0.10) 60%, transparent 75%)",
        }}
      />
      <main className="relative max-w-md mx-auto px-6 pt-12 pb-32">
        <header className="mb-10 flex justify-between items-end">
          <div>
            <p className="text-[12px] uppercase tracking-[0.2em] font-medium opacity-70 mb-1">{dateLabel}</p>
            <h1 className="text-3xl font-serif font-light tracking-tight italic">{greeting}</h1>
          </div>
          <div className="text-right">
            <span className="block text-2xl font-serif italic text-dawn-haze">{String(streak).padStart(2, "0")}</span>
            <span className="text-[12px] uppercase tracking-widest opacity-60">Day streak</span>
          </div>
        </header>

        {/* THE HORIZON — the far thing. It has no number and no end. Drawn once
            in thin lines; the staying brings its color back. */}
        {home !== undefined && home.horizon && !adding && (
          <section className="mb-8">
            <div className="flex items-baseline justify-between mb-2 px-1">
              <p className="text-[12px] uppercase tracking-[0.2em] font-medium text-dawn-muted">Your horizon</p>
              {!editingHorizon && (
                <button
                  onClick={() => {
                    setHorizonDraft(home.horizon ?? "");
                    setEditingHorizon(true);
                  }}
                  className="text-[12px] uppercase tracking-[0.14em] text-dawn-ink/60 hover:text-dawn-ink/80 transition-colors"
                >
                  Reword
                </button>
              )}
            </div>
            {editingHorizon ? (
              <div className="flex flex-col items-center rounded-2xl border border-dawn-haze/15 bg-dawn-surface/80 p-5">
                <textarea
                  autoFocus
                  value={horizonDraft}
                  onChange={(e) => setHorizonDraft(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full bg-dawn-sky/60 text-dawn-ink border border-dawn-haze/15 rounded-2xl p-4 text-base leading-relaxed focus:outline-none focus:ring-1 ring-dawn-rose/30 resize-none"
                />
                <p className="mt-2 text-[13px] text-dawn-muted text-center">
                  Your words stay exactly as you write them. If they change, the drawing is made again.
                </p>
                <div className="mt-3 flex items-center gap-4">
                  <button
                    onClick={saveHorizon}
                    disabled={!horizonDraft.trim()}
                    className="px-6 py-2.5 bg-dawn-rose text-dawn-sky text-[12px] uppercase tracking-[0.12em] font-bold rounded-full hover:bg-dawn-haze transition-colors disabled:opacity-60"
                  >
                    Keep this
                  </button>
                  <button
                    onClick={() => setEditingHorizon(false)}
                    className="text-[12px] uppercase tracking-[0.14em] text-dawn-ink/60 hover:text-dawn-ink/80 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <HorizonSketch sketch={home.sketch} words={home.horizon} />
            )}
          </section>
        )}

        {/* THE ROADS — up to two vows toward the horizon. */}
        {vow && roads.length > 1 && (
          <div className="mb-4 flex justify-center gap-2">
            {roads.map((r, i) => (
              <button
                key={r.id}
                onClick={() => setActiveRoad(i)}
                className={
                  "text-[13px] uppercase tracking-[0.18em] font-medium px-4 py-2 rounded-full border transition-colors " +
                  (i === activeRoad
                    ? "bg-dawn-rose text-dawn-sky border-dawn-rose"
                    : "border-dawn-haze/25 text-dawn-ink/75 hover:bg-dawn-haze/10")
                }
              >
                {r.label ?? r.card.title} · {r.dayNumber}
              </button>
            ))}
          </div>
        )}

        {/* No road yet (or opening a second) -> the vow is the front door. */}
        {vow === null && (
          <VowOnboarding
            horizon={home?.horizon ?? null}
            onHorizon={() => void refreshHome()}
            roadsOpen={roads.length}
            onCancel={roads.length > 0 ? () => setAdding(false) : undefined}
            onCreated={(v) => {
              setOnboarding(false);
              void reloadHome(v.id);
            }}
          />
        )}
        {vow && (
          <VowPanel key={vow.id} vow={vow} onEnded={() => void reloadHome()} onWitnessed={() => void refreshHome()} />
        )}

        {/* A second road — offered quietly, never pushed. Two is the limit. */}
        {vow && home && roads.length < home.maxRoads && (
          <div className="text-center -mt-4 mb-8">
            <button
              onClick={() => setAdding(true)}
              className="text-[13px] uppercase tracking-[0.18em] text-dawn-ink/60 hover:text-dawn-ink/80 transition-colors border-b border-dawn-haze/20 pb-0.5"
            >
              Open a second road
            </button>
          </div>
        )}

        {/* The daily reading, folded — one card owns this page: the vow card. */}
        {vow && !showDaily && (
          <div className="text-center mb-6">
            <button
              onClick={() => setShowDaily(true)}
              className="text-[13px] uppercase tracking-[0.18em] text-dawn-ink/65 hover:text-dawn-ink/75 transition-colors border-b border-dawn-haze/20 pb-0.5"
            >
              Today's reading from the oracle
            </button>
          </div>
        )}

        {/* STATE 1: Arrival / Intention — what brought you here today? */}
        {vow !== null && (vow === undefined || showDaily) && ritual === "arrival" && (
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
            <p className="mt-3 text-dawn-ink/70 text-base leading-relaxed max-w-[30ch]">
              You can type it, choose a feeling, or simply hold it in your mind.
            </p>

            <div className="mt-7 flex flex-wrap justify-center gap-2 max-w-sm">
              {INTENTIONS.map((label) => (
                <button key={label}
                  onClick={() => { setIntention(label); setShowOther(false); }}
                  className={
                    "text-[14px] px-4 py-2.5 rounded-full border transition-colors " +
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
                  "text-[14px] px-4 py-2.5 rounded-full border transition-colors " +
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
                className="mt-4 w-full max-w-sm bg-dawn-surface/70 text-dawn-ink placeholder:text-dawn-ink/45 border border-dawn-haze/15 rounded-xl px-5 py-3.5 text-base text-center focus:outline-none focus:ring-1 ring-dawn-rose/30"
              />
            )}

            <button
              onClick={() => drawMyCard(intention)}
              disabled={busy}
              className="mt-8 px-10 py-4 bg-dawn-rose text-dawn-sky text-[14px] uppercase tracking-[0.16em] font-bold rounded-full shadow-[0_12px_40px_-12px_rgba(244,163,122,0.5)] hover:shadow-[0_16px_50px_-12px_rgba(244,163,122,0.6)] hover:bg-dawn-haze transition-all disabled:opacity-70"
            >
              Draw My Card
            </button>
            <button
              onClick={() => drawMyCard("")}
              disabled={busy}
              className="mt-4 text-[13px] uppercase tracking-[0.18em] text-dawn-ink/60 hover:text-dawn-ink/70 transition-colors disabled:opacity-70"
            >
              I'll skip for now
            </button>
          </section>
        )}

        {/* STATE 2: Ritual — take a slow breath */}
        {vow !== null && (vow === undefined || showDaily) && ritual === "drawing" && (
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
            <p className="mt-4 text-[13px] uppercase tracking-[0.2em] text-dawn-haze/70 animate-card-rise">
              Drawing your card…
            </p>
          </section>
        )}

        {/* STATE 3: Reveal — card visible but message hidden */}
        {vow !== null && (vow === undefined || showDaily) && ritual === "reveal" && activeCard && (
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
                <div className="w-full aspect-[4/5] mb-7 rounded-lg overflow-hidden ring-1 ring-dawn-haze/15 bg-dawn-ink/10">
                  <img src={activeCard.illustration} alt={activeCard.title} width={768} height={1152} className="h-full w-full object-cover" loading="lazy" />
                </div>

                <p className="text-[12px] uppercase tracking-[0.2em] font-medium opacity-60 mb-2">Today's Card</p>
                <h2 className="text-3xl font-serif font-light tracking-tight text-balance text-dawn-ink">{activeCard.title}</h2>

                <button
                  onClick={revealMessage}
                  className="mt-8 w-full py-4 bg-dawn-rose/15 border border-dawn-rose/30 text-dawn-rose text-base uppercase tracking-[0.2em] font-bold rounded-full hover:bg-dawn-rose/25 transition-colors"
                >
                  Reveal Message
                </button>
                <button
                  onClick={drawAgain}
                  disabled={busy}
                  className="mt-3 w-full py-3 text-[13px] uppercase tracking-[0.18em] text-dawn-ink/65 hover:text-dawn-ink/75 transition-colors disabled:opacity-70"
                >
                  Draw a New Card
                </button>
              </div>
            </article>
          </div>
        )}

        {/* STATE 4: Open — full card with message, actions, follow-up */}
        {vow !== null && (vow === undefined || showDaily) && ritual === "open" && activeCard && (
          <div className="animate-card-rise">
            <OracleCardView key={activeCard.id} card={activeCard} onDrawAgain={drawAgain} />
          </div>
        )}

        {/* Ask the Oracle — visible only when a card has been fully read */}
        {vow !== null && (vow === undefined || showDaily) && ritual === "open" && (
          <section className="mt-12">
            <form onSubmit={submitInput} className="relative">
              <label className="block text-[12px] uppercase tracking-[0.2em] font-medium opacity-70 mb-3 ml-1">Ask the oracle</label>
              <textarea value={input} onChange={(e) => setInput(e.target.value)}
                rows={3}
                placeholder="What's on your mind?"
                className="w-full bg-dawn-surface/70 backdrop-blur-md text-dawn-ink placeholder:text-dawn-ink/45 border border-dawn-haze/15 rounded-2xl p-5 pr-16 text-base leading-relaxed focus:outline-none focus:ring-1 ring-dawn-rose/30 min-h-[120px] shadow-[0_20px_60px_-30px_rgba(245,180,120,0.25)] resize-none" />
              <button type="submit" aria-label="Draw a card from your prompt" disabled={busy}
                className="absolute bottom-4 right-4 size-11 bg-dawn-rose text-dawn-sky border border-dawn-haze/40 rounded-full flex items-center justify-center hover:bg-dawn-haze transition-colors disabled:opacity-70">
                <svg viewBox="0 0 24 24" fill="none" className="size-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            </form>
            <p className="mt-2 ml-1 text-[12px] uppercase tracking-[0.18em] opacity-60">
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

        {/* Reminders — only when card is fully open */}
        {vow !== null && (vow === undefined || showDaily) && ritual === "open" && (
          <section className="mt-10 space-y-3">
            <p className="text-[12px] uppercase tracking-[0.2em] font-medium opacity-70 ml-1">Reminders for today</p>
            {reminders.map((r, i) => (
              <div key={i} className="flex items-start gap-4 p-5 bg-dawn-surface/60 backdrop-blur-md border border-dawn-haze/15 rounded-xl">
                <div className="mt-1.5 size-1.5 rounded-full bg-dawn-rose shrink-0" />
                <p className="text-base leading-relaxed italic font-serif text-dawn-ink/85">{r}</p>
              </div>
            ))}
          </section>
        )}

        {vow !== null && (vow === undefined || showDaily) && ritual === "open" && (
          <div className="mt-16 pt-8 border-t border-dawn-haze/10 text-center">
            <p className="text-[12px] uppercase tracking-widest opacity-55">In need of immediate support?</p>
            <div className="mt-3 flex justify-center gap-6">
              <a href="tel:988" className="text-[13px] font-medium border-b border-dawn-haze/20">US — call or text 988</a>
              <a href="tel:116123" className="text-[13px] font-medium border-b border-dawn-haze/20">UK — Samaritans 116 123</a>
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
