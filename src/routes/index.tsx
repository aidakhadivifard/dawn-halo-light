// Flow v2 — "Don't remove features. Remove friction."
// The cards come FIRST (two taps to the reading). Every question — intention,
// dream, daily check-in, ritual — happens AFTER value, woven into one
// continuous conversation beneath the card.

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  getDailyWithEntitlement,
  drawCardEx,
  offlineDailyCard,
  fromApiCard,
  type Card,
  type Entitlement,
} from "@/lib/cards";
import { getCalendar } from "@/lib/store";
import { REMINDERS } from "@/lib/dawnhalo";
import { OracleCardView } from "@/components/OracleCard";
import { BottomNav } from "@/components/BottomNav";
import { track } from "@/lib/analytics";
import type { CheckinResult, CheckinState, GoalStatus, RitualType } from "@/lib/api";
import { checkin as postCheckin, doRitual, getGoalPhoto, getGoalStatus } from "@/lib/goalStore";
import { HOLDING_QUESTION, RITUAL_WRITING_PLACEHOLDER, STATE_OPTIONS } from "@/lib/goalCopy";

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

type RitualState = "choose" | "drawing" | "open";

const RITUAL_FLOOR_MS = 1100;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RETENTION_DAYS = [1, 3, 7, 30];

// A face-down card for the pick-a-card spread: dark dawn gradient with the
// halo-and-sun mark. Pure CSS/SVG so no asset is needed.
function CardBack({ tilt, delay, onPick }: { tilt: number; delay: number; onPick: () => void }) {
  return (
    <div className="w-[27%]" style={{ transform: `rotate(${tilt}deg)` }}>
      <button
        onClick={onPick}
        aria-label="Pick this card"
        className="relative w-full aspect-[3/4] rounded-xl border border-dawn-gold/25 shadow-[0_18px_40px_-18px_rgba(45,42,46,0.45)] transition-transform duration-200 hover:-translate-y-2 focus:-translate-y-2 focus:outline-none animate-card-rise"
        style={{
          animationDelay: `${delay}ms`,
          background: "linear-gradient(165deg, #3a1626 0%, #221018 55%, #180a14 100%)",
        }}
      >
        <svg viewBox="0 0 100 125" className="absolute inset-0 h-full w-full" aria-hidden>
          <circle cx="50" cy="58" r="26" fill="none" stroke="rgba(245,207,138,0.55)" strokeWidth="3" />
          <circle cx="50" cy="70" r="11" fill="rgba(244,163,122,0.65)" />
          <circle cx="50" cy="16" r="1.6" fill="rgba(245,207,138,0.5)" />
          <circle cx="18" cy="104" r="1.3" fill="rgba(245,207,138,0.4)" />
          <circle cx="82" cy="100" r="1.3" fill="rgba(245,207,138,0.4)" />
        </svg>
      </button>
    </div>
  );
}

// One honest, sourced line a day beneath the card — never a stat without a source.
function BenchmarkFooter({
  text,
  sourceName,
  sourceUrl,
  benchmarkId,
}: {
  text: string;
  sourceName: string;
  sourceUrl: string;
  benchmarkId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 px-2 text-center">
      <p className="text-sm font-serif italic text-dawn-ink/65 leading-relaxed">{text}</p>
      <button
        onClick={() => {
          setOpen((v) => !v);
          if (!open) track("benchmark_viewed", { id: benchmarkId, source: "card_footer" });
        }}
        className="mt-1 text-[10px] uppercase tracking-[0.18em] text-dawn-ink/35 hover:text-dawn-ink/60 border-b border-dawn-haze/20"
      >
        source
      </button>
      {open && (
        <p className="mt-2 text-xs text-dawn-ink/50">
          {sourceName} ·{" "}
          <a href={sourceUrl} target="_blank" rel="noreferrer" className="underline decoration-dawn-haze/40 break-all">
            {sourceUrl}
          </a>
        </p>
      )}
    </div>
  );
}

function TodayPage() {
  const navigate = useNavigate();
  const [today] = useState(() => new Date());
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [streak, setStreak] = useState(0);
  const [reminders, setReminders] = useState<[string, string]>([REMINDERS[0], REMINDERS[1]]);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [dateLabel, setDateLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [ritual, setRitual] = useState<RitualState>("choose");

  // Post-reading conversation: intention chips + free text / dream.
  const [intentInput, setIntentInput] = useState("");
  const [showOther, setShowOther] = useState(false);
  const [showDream, setShowDream] = useState(false);

  // The goal layer, woven in AFTER the reading.
  const [goal, setGoal] = useState<GoalStatus | null>(null);
  const [goalPhoto, setGoalPhotoState] = useState<string | null>(null);
  const [checkinResult, setCheckinResult] = useState<CheckinResult | null>(null);
  const [ritualCard, setRitualCard] = useState<Card | null>(null);
  const [reflection, setReflection] = useState<string | null>(null);
  const [writingOpen, setWritingOpen] = useState(false);
  const [writingText, setWritingText] = useState("");
  const [offlineNote, setOfflineNote] = useState(false);

  const INTENTIONS = ["I need clarity", "I need calm", "I need courage"];

  useEffect(() => {
    let alive = true;
    getCalendar().then(({ streak }) => alive && setStreak(streak));
    getGoalStatus().then((g) => {
      if (!alive) return;
      setGoal(g);
      if (g) setGoalPhotoState(getGoalPhoto());
    });
    setDateLabel(formatDate(today));
    if (new URLSearchParams(window.location.search).get("checkout") === "success") {
      track("checkout_completed");
      track("subscription_started");
      window.history.replaceState(null, "", window.location.pathname);
    }
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

  const handleOutcome = (out: Awaited<ReturnType<typeof drawCardEx>>, mode: string) => {
    if (out.kind === "crisis") {
      track("support_redirect", { source: mode });
      navigate({ to: "/support" });
      return false;
    }
    if (out.kind === "paywall") {
      track("paywall_hit", { source: mode });
      navigate({ to: "/paywall" });
      return false;
    }
    track("card_drawn", { mode });
    setActiveCard(out.card);
    if (out.entitlement) setEntitlement(out.entitlement);
    return true;
  };

  // Two taps to the reading: pick a card → today's card opens fully.
  const pickCard = useCallback(
    async (position: number) => {
      if (busy) return;
      track("card_picked", { position });
      setRitual("drawing");
      setBusy(true);
      const started = Date.now();
      try {
        const { card, entitlement } = await getDailyWithEntitlement();
        setActiveCard(card);
        if (entitlement) setEntitlement(entitlement);
        track("card_drawn", { mode: "daily" });
      } catch {
        setActiveCard(offlineDailyCard(today));
      } finally {
        await sleep(Math.max(0, RITUAL_FLOOR_MS - (Date.now() - started)));
        track("card_revealed");
        setRitual("open");
        setBusy(false);
      }
    },
    [busy, today],
  );

  // Post-reading personalization: an intention/dream draws a new reading.
  const askWith = async (text: string, mode: string) => {
    if (!text.trim() || busy) return;
    setRitual("drawing");
    setBusy(true);
    const started = Date.now();
    try {
      const out = await drawCardEx({ intent: "ask", text });
      if (handleOutcome(out, mode)) {
        setIntentInput("");
        setShowOther(false);
        setShowDream(false);
        await sleep(Math.max(0, RITUAL_FLOOR_MS - (Date.now() - started)));
        setRitual("open");
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
      if (handleOutcome(out, "again")) {
        await sleep(Math.max(0, RITUAL_FLOOR_MS - (Date.now() - started)));
        setRitual("open");
      }
    } finally {
      setBusy(false);
    }
  };

  // The daily check-in, after the reading.
  const submitCheckin = async (state: CheckinState) => {
    if (busy) return;
    setBusy(true);
    setOfflineNote(false);
    const res = await postCheckin({ state });
    setBusy(false);
    if (res.kind === "offline") {
      setOfflineNote(true);
      return;
    }
    if (res.kind === "crisis") {
      navigate({ to: "/support" });
      return;
    }
    const c = res.checkin;
    track("checkin_completed", { state: c.state, day: c.day, source: "today" });
    if (!c.already && RETENTION_DAYS.includes(c.day)) track("dN_retention", { day: c.day });
    setCheckinResult(c);
    if (goal) {
      setGoal({ ...goal, checkedInToday: true, todayState: c.state, day: c.day, streak: c.streak });
    }
  };

  // The ritual, inline — pull a contextual card or write it out.
  const runRitual = async (type: RitualType) => {
    if (busy) return;
    if (type === "writing" && !writingText.trim()) return;
    setBusy(true);
    setOfflineNote(false);
    const res = await doRitual({ type, text: type === "writing" ? writingText : undefined });
    setBusy(false);
    if (res.kind === "offline") {
      setOfflineNote(true);
      return;
    }
    if (res.kind === "crisis") {
      navigate({ to: "/support" });
      return;
    }
    if (res.kind === "paywall") {
      track("paywall_hit", { source: "goal_ritual" });
      navigate({ to: "/paywall" });
      return;
    }
    track("ritual_completed", { type });
    if (res.kind === "card") setRitualCard(fromApiCard(res.card));
    else setReflection(res.reflection);
    if (goal) setGoal({ ...goal, ritualDoneToday: true });
  };

  const greetingHour = today.getHours();
  const greeting =
    greetingHour < 12 ? "Good morning." : greetingHour < 17 ? "Good afternoon." : "Good evening.";

  const checked = !!goal && (goal.checkedInToday || !!checkinResult);
  const todayState = checkinResult?.state ?? goal?.todayState ?? null;
  const gentle = todayState === "cant";
  const benchmark = checkinResult ? checkinResult.benchmark : gentle ? null : goal?.benchmark ?? null;
  const showRitualOffer =
    !!goal && checked && !goal.ritualDoneToday && !ritualCard && !reflection;
  const honestyDue = checkinResult?.honestyDue ?? goal?.honestyDue ?? false;

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
        <header className="mb-8 flex justify-between items-end">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-50 mb-1">{dateLabel}</p>
            <h1 className="text-3xl font-serif font-light tracking-tight italic">{greeting}</h1>
          </div>
          <div className="text-right">
            <span className="block text-2xl font-serif italic text-dawn-haze">{String(streak).padStart(2, "0")}</span>
            <span className="text-[8px] uppercase tracking-widest opacity-40">Day streak</span>
          </div>
        </header>

        {/* The goal, always present, never in the way — details live behind it. */}
        {goal && (
          <Link
            to="/goal"
            className="mb-6 block p-3 bg-dawn-surface/60 border border-dawn-haze/15 rounded-2xl hover:bg-dawn-haze/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              {goalPhoto ? (
                <img src={goalPhoto} alt="" className="size-10 rounded-lg object-cover ring-1 ring-dawn-haze/20" />
              ) : (
                <span className="flex size-10 items-center justify-center rounded-lg bg-dawn-rose/15 font-serif italic text-dawn-rose">
                  {goal.day}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] uppercase tracking-[0.18em] opacity-45">
                  Day {goal.day} · holding on for
                </span>
                <span className="block truncate text-sm font-serif italic text-dawn-ink/85">
                  {goal.goal.title}
                </span>
              </span>
            </div>
            <div className="mt-2 h-1 w-full rounded-full bg-dawn-ink/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-dawn-gold to-dawn-rose"
                style={{ width: `${Math.round(goal.progress * 100)}%` }}
              />
            </div>
          </Link>
        )}

        {/* STATE 1: The cards come first. */}
        {ritual === "choose" && (
          <section className="flex flex-col items-center text-center py-10">
            <h2 className="text-2xl font-serif font-light tracking-tight text-balance text-dawn-ink animate-card-rise">
              The cards have been waiting.
            </h2>
            <p className="mt-3 text-dawn-ink/50 text-sm leading-relaxed max-w-[30ch] animate-card-rise">
              Don't think — take the one that pulls you.
            </p>
            <div className="mt-10 flex w-full max-w-sm items-center justify-center gap-4">
              {[-8, 0, 8].map((tilt, i) => (
                <CardBack key={i} tilt={tilt} delay={i * 140} onPick={() => void pickCard(i)} />
              ))}
            </div>
            <p className="mt-12 text-[10px] uppercase tracking-[0.3em] text-dawn-ink/25">Dawnhalo</p>
          </section>
        )}

        {/* STATE 2: Drawing */}
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
            <p className="mt-14 text-[10px] uppercase tracking-[0.3em] text-dawn-ink/25">Dawnhalo</p>
          </section>
        )}

        {/* STATE 3: The reading, open immediately — then the conversation. */}
        {ritual === "open" && activeCard && (
          <div className="animate-card-rise">
            <OracleCardView key={activeCard.id} card={activeCard} onDrawAgain={drawAgain} />

            {benchmark && (
              <BenchmarkFooter
                text={benchmark.text}
                sourceName={benchmark.sourceName}
                sourceUrl={benchmark.sourceUrl}
                benchmarkId={benchmark.id}
              />
            )}
          </div>
        )}

        {/* What brought you here today? — now it deepens, never blocks. */}
        {ritual === "open" && (
          <section className="mt-10">
            <p className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-50 mb-3 ml-1">
              Go deeper — what brought you here today?
            </p>
            <div className="flex flex-wrap gap-2">
              {INTENTIONS.map((label) => (
                <button
                  key={label}
                  onClick={() => void askWith(label, "intention")}
                  disabled={busy}
                  className="text-[12px] px-4 py-2.5 rounded-full border border-dawn-haze/20 text-dawn-ink/75 hover:bg-dawn-haze/10 transition-colors disabled:opacity-50"
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => {
                  setShowDream(true);
                  setShowOther(false);
                }}
                className={
                  "text-[12px] px-4 py-2.5 rounded-full border transition-colors " +
                  (showDream
                    ? "bg-dawn-rose/15 border-dawn-rose/40 text-dawn-ink"
                    : "border-dawn-haze/20 text-dawn-ink/75 hover:bg-dawn-haze/10")
                }
              >
                I had a dream…
              </button>
              <button
                onClick={() => {
                  setShowOther(true);
                  setShowDream(false);
                }}
                className={
                  "text-[12px] px-4 py-2.5 rounded-full border transition-colors " +
                  (showOther
                    ? "bg-dawn-rose/15 border-dawn-rose/40 text-dawn-ink"
                    : "border-dawn-haze/20 text-dawn-ink/75 hover:bg-dawn-haze/10")
                }
              >
                Something else…
              </button>
            </div>
            {(showOther || showDream) && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void askWith(showDream ? `I had a dream: ${intentInput}` : intentInput, showDream ? "dream" : "ask");
                }}
                className="relative mt-4"
              >
                <input
                  autoFocus
                  value={intentInput}
                  onChange={(e) => setIntentInput(e.target.value)}
                  placeholder={showDream ? "Tell me what you dreamed…" : "What's on your mind?"}
                  className="w-full bg-dawn-surface/70 text-dawn-ink placeholder:text-dawn-ink/30 border border-dawn-haze/15 rounded-xl px-5 py-3.5 pr-14 text-sm focus:outline-none focus:ring-1 ring-dawn-rose/30"
                />
                <button
                  type="submit"
                  aria-label="Ask"
                  disabled={busy || !intentInput.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 size-9 bg-dawn-rose text-dawn-sky rounded-full flex items-center justify-center hover:bg-dawn-haze transition-colors disabled:opacity-50"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="size-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </button>
              </form>
            )}
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

        {/* The daily check-in — after the reading, where it feels natural. */}
        {ritual === "open" && goal && !checked && (
          <section className="mt-10 space-y-3">
            <p className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-50 ml-1">
              {HOLDING_QUESTION}
            </p>
            {STATE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => void submitCheckin(opt.id)}
                disabled={busy}
                className="w-full p-4 text-left bg-dawn-surface/60 border border-dawn-haze/15 rounded-2xl hover:bg-dawn-haze/10 transition-colors disabled:opacity-50"
              >
                <p className="font-serif text-base">{opt.label}</p>
              </button>
            ))}
          </section>
        )}

        {/* Adaptive response + ritual, inline — one conversation. */}
        {ritual === "open" && checkinResult && (
          <section className="mt-6 space-y-4">
            <div className="p-5 bg-dawn-surface/80 border border-dawn-haze/15 rounded-2xl animate-card-rise">
              <p className="font-serif text-lg italic leading-snug">{checkinResult.ack}</p>
              {checkinResult.milestone && (
                <p className="mt-3 font-serif italic text-dawn-haze leading-snug">
                  {checkinResult.milestone.message}
                </p>
              )}
              {checkinResult.honestyOffer && (
                <Link
                  to="/goal"
                  className="mt-3 block text-xs text-dawn-ink/55 underline decoration-dawn-haze/40"
                >
                  {checkinResult.honestyOffer}
                </Link>
              )}
            </div>
          </section>
        )}

        {ritual === "open" && honestyDue && checked && !checkinResult?.honestyOffer && (
          <Link
            to="/goal"
            className="mt-4 block p-4 bg-dawn-rose/10 border border-dawn-rose/30 rounded-2xl text-sm font-serif"
          >
            {goal?.honestyPrompt ?? "Is the reward still worth the price?"}
          </Link>
        )}

        {ritual === "open" && showRitualOffer && (
          <section className="mt-4 p-5 bg-dawn-surface/60 border border-dawn-haze/15 rounded-2xl">
            <p className="text-[10px] uppercase tracking-[0.2em] opacity-50 mb-3">
              {gentle ? "Write it out." : "A ritual for what you're holding."}
            </p>
            {gentle || writingOpen || (checkinResult?.suggestedRitual ?? goal?.goal.ritual) === "writing" ? (
              <div>
                <textarea
                  value={writingText}
                  onChange={(e) => setWritingText(e.target.value)}
                  rows={3}
                  placeholder={RITUAL_WRITING_PLACEHOLDER}
                  className="w-full bg-dawn-night/40 border border-dawn-haze/15 rounded-xl p-4 text-sm leading-relaxed focus:outline-none focus:ring-1 ring-dawn-rose/30 resize-none placeholder:text-dawn-ink/30"
                />
                <button
                  onClick={() => void runRitual("writing")}
                  disabled={busy || !writingText.trim()}
                  className="mt-3 w-full py-3.5 bg-dawn-rose/15 border border-dawn-rose/30 text-dawn-rose text-xs uppercase tracking-[0.2em] font-bold rounded-full disabled:opacity-40"
                >
                  Reflect
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => void runRitual("card")}
                  disabled={busy}
                  className="w-full py-3.5 bg-dawn-rose/15 border border-dawn-rose/30 text-dawn-rose text-xs uppercase tracking-[0.2em] font-bold rounded-full disabled:opacity-50"
                >
                  Pull a card for it
                </button>
                <button
                  onClick={() => setWritingOpen(true)}
                  className="w-full py-2 text-[11px] uppercase tracking-[0.18em] text-dawn-ink/40 hover:text-dawn-ink/70"
                >
                  Write instead
                </button>
              </div>
            )}
          </section>
        )}

        {ritual === "open" && ritualCard && (
          <article className="mt-4 p-6 bg-dawn-surface/80 border border-dawn-haze/15 rounded-2xl animate-card-rise">
            <div className="w-full aspect-[4/5] mb-5 rounded-lg overflow-hidden ring-1 ring-dawn-haze/15 bg-black/30">
              <img src={ritualCard.illustration} alt={ritualCard.title} className="h-full w-full object-cover" />
            </div>
            {ritualCard.opener && (
              <p className="text-sm italic font-serif text-dawn-ink/60 mb-2">{ritualCard.opener}</p>
            )}
            <h2 className="text-2xl font-serif font-light">{ritualCard.title}</h2>
            <div className="mt-3 space-y-3">
              {ritualCard.message.split(/\n{2,}/).map((p, i) => (
                <p key={i} className="text-sm leading-relaxed text-dawn-ink/85">{p}</p>
              ))}
            </div>
            {ritualCard.reflection && (
              <p className="mt-4 text-sm italic font-serif text-dawn-ink/60">{ritualCard.reflection}</p>
            )}
          </article>
        )}

        {ritual === "open" && reflection && (
          <div className="mt-4 p-6 bg-dawn-surface/80 border border-dawn-haze/15 rounded-2xl animate-card-rise">
            <p className="text-[10px] uppercase tracking-[0.2em] opacity-50 mb-2">Reflection</p>
            <p className="font-serif italic text-lg leading-relaxed">{reflection}</p>
          </div>
        )}

        {ritual === "open" && offlineNote && (
          <p className="mt-4 text-center text-xs text-dawn-rose/90">
            Can't reach Dawnhalo right now — your day count is safe; try again in a moment.
          </p>
        )}

        {/* Reminders — the quiet end of the conversation. */}
        {ritual === "open" && (
          <section className="mt-10 space-y-3">
            <p className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-50 ml-1">Reminders for today</p>
            {reminders.map((r, i) => (
              <div key={i} className="flex items-start gap-4 p-5 bg-dawn-surface/60 backdrop-blur-md border border-dawn-haze/15 rounded-xl">
                <div className="mt-1.5 size-1.5 rounded-full bg-dawn-rose shrink-0" />
                <p className="text-sm leading-relaxed italic font-serif text-dawn-ink/85">{r}</p>
              </div>
            ))}
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
