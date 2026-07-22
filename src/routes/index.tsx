// Flow v3 — one uninterrupted conversation.
// With a goal: light one-tap check-in → (milestone / honesty when due) →
// cards → reading → personalized endurance response with per-state actions.
// Without a goal: optional intention + cards on one screen, value first.
// At every point: one primary action; the next moment appears only when the
// current one is complete.

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
import { OracleCardView } from "@/components/OracleCard";
import { shareJourneyImage } from "@/lib/shareImage";
import { BottomNav } from "@/components/BottomNav";
import { track } from "@/lib/analytics";
import type { CheckinResult, CheckinState, GoalStatus, RitualType } from "@/lib/api";
import {
  answerHonesty,
  checkin as postCheckin,
  doRitual,
  getGoalPhoto,
  getGoalStatus,
} from "@/lib/goalStore";
import { localDay } from "@/lib/device";
import {
  CALM_FLOW,
  CANT_RESPONSE,
  CLARITY_FLOW,
  DISCOVERY_SOFT,
  EXHAUSTED_LEAD,
  HOLDING_QUESTION,
  HONESTY_CHANGED,
  HONESTY_OPENING,
  HONESTY_OPTIONS,
  HONESTY_QUESTION,
  HONESTY_RESPONSES,
  NOW_LABEL,
  NOW_OPTIONS,
  NOW_QUESTION,
  RETURNED_TIMES,
  RITUAL_CARD_PROMPTS,
  SOFT_TRANSITION,
  STATE_OPTIONS,
  SUPPORT_INTRO,
  SUPPORT_RESOURCES,
  TRUTH_RESPONSE,
  WRITING_PROMPTS,
  smallActionFor,
} from "@/lib/goalCopy";

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

type Phase = "loading" | "checkin" | "transition" | "milestone" | "honesty" | "choose" | "drawing" | "open";

const RITUAL_FLOOR_MS = 1100;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RETENTION_DAYS = [1, 3, 7, 30];
const DISCOVERY_KEY = "dawnhalo:discoveryShown";

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
        View source
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

function Lines({ lines, className }: { lines: readonly string[]; className?: string }) {
  return (
    <div className={className}>
      {lines.map((l, i) => (
        <p key={i} className="font-serif italic text-lg leading-relaxed">
          {l}
        </p>
      ))}
    </div>
  );
}

function TodayPage() {
  const navigate = useNavigate();
  const [today] = useState(() => new Date());
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [streak, setStreak] = useState(0);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [dateLabel, setDateLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<Phase>("loading");

  // Intention brought to the cards (optional, never blocking).
  const [intent, setIntent] = useState("");
  const [freeText, setFreeText] = useState("");
  const [inputMode, setInputMode] = useState<null | "dream" | "ask">(null);

  // Goal layer.
  const [goal, setGoal] = useState<GoalStatus | null>(null);
  const [goalPhoto, setGoalPhotoState] = useState<string | null>(null);
  const [checkinResult, setCheckinResult] = useState<CheckinResult | null>(null);
  const [ritualCard, setRitualCard] = useState<Card | null>(null);
  const [reflection, setReflection] = useState<string | null>(null);
  const [writingOpen, setWritingOpen] = useState(false);
  const [writingText, setWritingText] = useState("");
  const [smallAction, setSmallAction] = useState<string | null>(null);
  const [truthOpen, setTruthOpen] = useState(false);
  const [calmOpen, setCalmOpen] = useState(false);
  const [finished, setFinished] = useState(false);
  const [offlineNote, setOfflineNote] = useState(false);

  // Honesty check state.
  const [honestyAnswer, setHonestyAnswer] = useState<string | null>(null);
  const [honestyNote, setHonestyNote] = useState("");
  const [honestyDone, setHonestyDone] = useState(false);

  // "I need something now" sheet.
  const [nowOpen, setNowOpen] = useState(false);
  const [nowFlow, setNowFlow] = useState<null | "calm" | "clarity" | "support">(null);

  // Soft discovery (no goal).
  const [discovery, setDiscovery] = useState(false);

  useEffect(() => {
    let alive = true;
    getCalendar().then(({ streak }) => alive && setStreak(streak));
    const phaseFallback = setTimeout(() => {
      setPhase((p) => (p === "loading" ? "choose" : p));
    }, 2500);
    getGoalStatus().then((g) => {
      if (!alive) return;
      clearTimeout(phaseFallback);
      setGoal(g);
      if (g) setGoalPhotoState(getGoalPhoto());
      setPhase((p) => {
        if (p !== "loading") return p;
        if (g && !g.checkedInToday) return "checkin";
        if (g && g.honestyDue) return "honesty";
        return "choose";
      });
    });
    setDateLabel(formatDate(today));
    if (new URLSearchParams(window.location.search).get("checkout") === "success") {
      track("checkout_completed");
      track("subscription_started");
      window.history.replaceState(null, "", window.location.pathname);
    }
    return () => {
      alive = false;
      clearTimeout(phaseFallback);
    };
  }, [today]);

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

  const maybeDiscover = () => {
    if (goal) return;
    try {
      const last = localStorage.getItem(DISCOVERY_KEY);
      const today3 = new Date(Date.now() - 3 * 86_400_000).toLocaleDateString("en-CA");
      if (!last || last < today3) {
        setDiscovery(true);
        localStorage.setItem(DISCOVERY_KEY, localDay());
        track("goal_prompt_shown", { source: "soft_discovery" });
      }
    } catch {
      /* ignore */
    }
  };

  const pickCard = useCallback(
    async (position: number) => {
      if (busy) return;
      track("card_picked", { position });
      setPhase("drawing");
      setBusy(true);
      const started = Date.now();
      const brought = inputMode === "dream" && freeText.trim()
        ? `I had a dream: ${freeText}`
        : inputMode === "ask" && freeText.trim()
          ? freeText
          : intent;
      try {
        if (brought.trim()) {
          const out = await drawCardEx({ intent: "ask", text: brought });
          if (!handleOutcome(out, inputMode === "dream" ? "dream" : intent ? "intention" : "ask")) return;
        } else {
          const { card, entitlement } = await getDailyWithEntitlement();
          setActiveCard(card);
          if (entitlement) setEntitlement(entitlement);
          track("card_drawn", { mode: "daily" });
        }
      } catch {
        setActiveCard(offlineDailyCard(today));
      } finally {
        await sleep(Math.max(0, RITUAL_FLOOR_MS - (Date.now() - started)));
        track("card_revealed");
        setPhase("open");
        setBusy(false);
        maybeDiscover();
      }
    },
    [busy, today, intent, freeText, inputMode, goal],
  );

  // One-tap check-in → soft transition → (milestone/honesty) → cards.
  const submitCheckin = async (state: CheckinState) => {
    if (busy) return;
    setBusy(true);
    setOfflineNote(false);
    const res = await postCheckin({ state });
    setBusy(false);
    if (res.kind === "offline") {
      setOfflineNote(true);
      setPhase("choose");
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
      setGoal({
        ...goal,
        checkedInToday: true,
        todayState: c.state,
        day: c.day,
        streak: c.streak,
        checkinCount: (goal.checkinCount ?? 0) + (c.already ? 0 : 1),
      });
    }
    if (c.summary) {
      track("goal_completed", { daysHeld: c.summary.daysHeld });
      navigate({ to: "/goal" });
      return;
    }
    setPhase("transition");
    await sleep(1200);
    if (c.milestone) setPhase("milestone");
    else if (c.honestyDue) setPhase("honesty");
    else setPhase("choose");
  };

  const submitHonesty = async (answer: "continue" | "adjust" | "thinking" | "done") => {
    if (busy) return;
    setBusy(true);
    const res = await answerHonesty(answer, honestyNote);
    setBusy(false);
    if (res.kind === "offline") {
      setOfflineNote(true);
      return;
    }
    track("honesty_check_answered", { answer });
    setHonestyAnswer(answer);
    setHonestyDone(true);
    if (goal) setGoal({ ...goal, honestyDue: false });
    if (answer === "done" && res.summary) {
      track("goal_abandoned", { daysHeld: res.summary.daysHeld });
      setGoal(null);
    }
  };

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

  const shareMilestone = async (message: string) => {
    if (!goal) return;
    try {
      const outcome = await shareJourneyImage({ day: goal.day, card: activeCard, line: message });
      track("card_image_shared", { method: outcome, format: "milestone" });
    } catch {
      /* canvas/share unavailable — quietly do nothing */
    }
  };

  const askWith = async (text: string, mode: string) => {
    if (!text.trim() || busy) return;
    setNowOpen(false);
    setPhase("drawing");
    setBusy(true);
    const started = Date.now();
    try {
      const out = await drawCardEx({ intent: "ask", text });
      if (handleOutcome(out, mode)) {
        await sleep(Math.max(0, RITUAL_FLOOR_MS - (Date.now() - started)));
        setPhase("open");
      }
    } finally {
      setBusy(false);
    }
  };

  const greetingHour = today.getHours();
  const greeting =
    greetingHour < 12 ? "Good morning." : greetingHour < 17 ? "Good afternoon." : "Good evening.";

  const state: CheckinState | null = checkinResult?.state ?? goal?.todayState ?? null;
  const gentle = state === "cant";
  const benchmark =
    !gentle && (checkinResult?.benchmark ?? (state && state !== "strong" ? goal?.benchmark : goal?.benchmark)) || null;
  const showEndurance = phase === "open" && !!goal && !!state && !finished;
  const ritualAvailable = !!goal && !goal.ritualDoneToday && !ritualCard && !reflection;

  const nowRoute = (id: string) => {
    setNowFlow(null);
    switch (id) {
      case "card":
        setNowOpen(false);
        if (phase === "open" && ritualAvailable) void runRitual("card");
        else setPhase("choose");
        break;
      case "clarity":
        setNowFlow("clarity");
        break;
      case "calm":
        setNowFlow("calm");
        break;
      case "support":
        setNowFlow("support");
        break;
      case "courage":
        void askWith("I need courage today", "now_courage");
        break;
      case "motivation":
        void askWith(
          goal ? `I need help holding on for: ${goal.goal.title}` : "I need motivation today",
          "now_motivation",
        );
        break;
      case "goal":
        setNowOpen(false);
        navigate({ to: "/goal" });
        break;
      case "write":
        setNowOpen(false);
        if (goal && phase === "open") setWritingOpen(true);
        else navigate({ to: "/calendar" });
        break;
    }
  };

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
      <main className="relative max-w-md mx-auto px-6 pt-12 pb-36">
        <header className="mb-6 flex justify-between items-start">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-50 mb-1">{dateLabel}</p>
            {!goal && <h1 className="text-3xl font-serif font-light tracking-tight italic">{greeting}</h1>}
          </div>
          {/* The streak is invisible until it exists; never zero-padded. */}
          {streak >= 1 && (
            <div className="text-right">
              <span className="block text-2xl font-serif italic text-dawn-haze">{streak}</span>
              <span className="text-[8px] uppercase tracking-widest opacity-40">Day streak</span>
            </div>
          )}
        </header>

        {/* Goal header — the hero of the app. The Day number is the home; the
            card is the guest. Calm and typographic, like a clock. */}
        {goal && (
          <Link
            to="/goal"
            className="mb-8 block text-center hover:opacity-90 transition-opacity"
          >
            {goalPhoto && (
              <img
                src={goalPhoto}
                alt=""
                className="mx-auto mb-3 size-12 rounded-xl object-cover ring-1 ring-dawn-haze/25"
              />
            )}
            <span className="block text-[10px] uppercase tracking-[0.3em] opacity-45">Day</span>
            <span className="block font-serif font-light italic leading-none text-dawn-ink text-[5.5rem] sm:text-[6.5rem]">
              {goal.day}
            </span>
            <span className="mt-1 block truncate text-sm font-serif italic text-dawn-ink/80 px-4">
              {goal.goal.title}
            </span>
            <span className="mt-1 block text-[11px] uppercase tracking-[0.18em] opacity-45">
              {Math.max(0, goal.totalDays - goal.day)} days remaining
            </span>
            <div className="mx-auto mt-3 h-1 w-40 rounded-full bg-dawn-ink/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-dawn-gold to-dawn-rose"
                style={{ width: `${Math.round(goal.progress * 100)}%` }}
              />
            </div>
            {(goal.checkinCount ?? 0) > 0 && (
              <span className="mt-2 block text-[10px] uppercase tracking-[0.18em] opacity-40">
                {RETURNED_TIMES(goal.checkinCount)}
              </span>
            )}
          </Link>
        )}

        {phase === "loading" && <p className="py-24 text-center text-sm opacity-40">…</p>}

        {/* One-tap check-in, before anything asks for attention. */}
        {phase === "checkin" && (
          <section className="py-6 animate-card-rise">
            <h2 className="text-2xl font-serif font-light italic text-center text-balance">{HOLDING_QUESTION}</h2>
            <div className="mt-6 space-y-3">
              {STATE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => void submitCheckin(opt.id)}
                  disabled={busy}
                  className="w-full p-4 bg-dawn-surface/60 border border-dawn-haze/15 rounded-2xl hover:bg-dawn-haze/10 transition-colors disabled:opacity-50"
                >
                  <p className="font-serif text-base">{opt.label}</p>
                </button>
              ))}
            </div>
            {offlineNote && (
              <p className="mt-4 text-center text-xs text-dawn-rose/90">
                Can't reach Dawnhalo right now — your day count is safe.
              </p>
            )}
          </section>
        )}

        {/* Soft transition — no long response yet. */}
        {phase === "transition" && (
          <section className="py-20 text-center animate-card-rise">
            <Lines lines={SOFT_TRANSITION} className="space-y-2 text-dawn-ink/80" />
          </section>
        )}

        {/* Milestone — rare, weighty, before the card. */}
        {phase === "milestone" && checkinResult?.milestone && (
          <section className="py-14 text-center animate-card-rise">
            <p className="text-[10px] uppercase tracking-[0.25em] opacity-50">Milestone</p>
            <p className="mt-5 text-2xl font-serif font-light italic leading-snug text-balance">
              {checkinResult.milestone.message}
            </p>
            <button
              onClick={() => setPhase(checkinResult.honestyDue ? "honesty" : "choose")}
              className="mt-10 w-full py-4 bg-dawn-rose text-dawn-sky text-sm uppercase tracking-[0.2em] font-bold rounded-full"
            >
              Continue to today's card
            </button>
            <button
              onClick={() => void shareMilestone(checkinResult.milestone!.message)}
              disabled={busy}
              className="mt-3 inline-block text-[11px] uppercase tracking-[0.18em] text-dawn-ink/40 hover:text-dawn-ink/70 disabled:opacity-50"
            >
              Share this milestone
            </button>
          </section>
        )}

        {/* Honesty check — before the card, never rushed. */}
        {phase === "honesty" && (
          <section className="py-8 animate-card-rise">
            {!honestyDone ? (
              <>
                <p className="text-center text-sm text-dawn-ink/60 font-serif italic">{HONESTY_OPENING}</p>
                <h2 className="mt-3 text-2xl font-serif font-light italic text-center text-balance leading-snug">
                  {HONESTY_QUESTION}
                </h2>
                <div className="mt-6 space-y-3">
                  {HONESTY_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => void submitHonesty(opt.id)}
                      disabled={busy}
                      className="w-full p-4 text-left bg-dawn-surface/60 border border-dawn-haze/15 rounded-2xl hover:bg-dawn-haze/10 transition-colors disabled:opacity-50"
                    >
                      <p className="font-serif text-base">{opt.label}</p>
                    </button>
                  ))}
                </div>
                <input
                  value={honestyNote}
                  onChange={(e) => setHonestyNote(e.target.value)}
                  placeholder={HONESTY_CHANGED}
                  className="mt-4 w-full bg-dawn-surface/70 border border-dawn-haze/15 rounded-xl px-5 py-3 text-sm focus:outline-none focus:ring-1 ring-dawn-rose/30 placeholder:text-dawn-ink/30"
                />
              </>
            ) : (
              <div className="text-center">
                <p className="text-lg font-serif italic leading-relaxed text-dawn-ink/85">
                  {HONESTY_RESPONSES[honestyAnswer ?? "continue"]}
                </p>
                {honestyAnswer === "done" ? (
                  <Link
                    to="/goal"
                    className="mt-8 inline-block px-10 py-4 bg-dawn-rose text-dawn-sky text-sm uppercase tracking-[0.2em] font-bold rounded-full"
                  >
                    Close this chapter
                  </Link>
                ) : (
                  <button
                    onClick={() => setPhase("choose")}
                    className="mt-8 w-full py-4 bg-dawn-rose text-dawn-sky text-sm uppercase tracking-[0.2em] font-bold rounded-full"
                  >
                    Draw today's card
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {/* The cards — with an optional, never-blocking intention. */}
        {phase === "choose" && (
          <section className="flex flex-col items-center text-center py-6">
            {!goal && (
              <>
                <h2 className="text-xl font-serif font-light italic text-balance animate-card-rise">
                  What would you like to bring to the cards today?
                </h2>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {["I need clarity", "I need courage", "I need calm"].map((label) => (
                    <button
                      key={label}
                      onClick={() => {
                        setIntent(intent === label ? "" : label);
                        setInputMode(null);
                      }}
                      className={
                        "text-[12px] px-4 py-2.5 rounded-full border transition-colors " +
                        (intent === label
                          ? "bg-dawn-rose/15 border-dawn-rose/40 text-dawn-ink"
                          : "border-dawn-haze/20 text-dawn-ink/75 hover:bg-dawn-haze/10")
                      }
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setInputMode(inputMode === "dream" ? null : "dream");
                      setIntent("");
                    }}
                    className={
                      "text-[12px] px-4 py-2.5 rounded-full border transition-colors " +
                      (inputMode === "dream"
                        ? "bg-dawn-rose/15 border-dawn-rose/40 text-dawn-ink"
                        : "border-dawn-haze/20 text-dawn-ink/75 hover:bg-dawn-haze/10")
                    }
                  >
                    I had a dream
                  </button>
                  <button
                    onClick={() => {
                      setInputMode(inputMode === "ask" ? null : "ask");
                      setIntent("");
                    }}
                    className={
                      "text-[12px] px-4 py-2.5 rounded-full border transition-colors " +
                      (inputMode === "ask"
                        ? "bg-dawn-rose/15 border-dawn-rose/40 text-dawn-ink"
                        : "border-dawn-haze/20 text-dawn-ink/75 hover:bg-dawn-haze/10")
                    }
                  >
                    Ask something else
                  </button>
                </div>
                {inputMode && (
                  <input
                    autoFocus
                    value={freeText}
                    onChange={(e) => setFreeText(e.target.value)}
                    placeholder={
                      inputMode === "dream"
                        ? "A place, a person, a feeling, a strange detail…"
                        : "You can ask plainly. It doesn't need to sound perfect."
                    }
                    className="mt-4 w-full max-w-sm bg-dawn-surface/70 text-dawn-ink placeholder:text-dawn-ink/30 border border-dawn-haze/15 rounded-xl px-5 py-3.5 text-sm text-center focus:outline-none focus:ring-1 ring-dawn-rose/30"
                  />
                )}
              </>
            )}

            <p className={"font-serif italic text-dawn-ink/80 " + (goal ? "text-xl mt-2" : "text-base mt-8")}>
              Take a breath.
            </p>
            <p className="mt-1 text-dawn-ink/50 text-sm">
              {goal ? "Choose the card that meets you here." : "Choose the one you are drawn to."}
            </p>
            <div className="mt-8 flex w-full max-w-sm items-center justify-center gap-4">
              {[-8, 0, 8].map((tilt, i) => (
                <CardBack key={i} tilt={tilt} delay={i * 140} onPick={() => void pickCard(i)} />
              ))}
            </div>
            <p className="mt-10 text-[10px] uppercase tracking-[0.3em] text-dawn-ink/25">Dawnhalo</p>
          </section>
        )}

        {phase === "drawing" && (
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

        {/* The reading. */}
        {phase === "open" && activeCard && (
          <div className="animate-card-rise">
            <OracleCardView key={activeCard.id} card={activeCard} journeyDay={goal?.day} />
          </div>
        )}

        {/* Personalized endurance response — after the reading. */}
        {showEndurance && (
          <section className="mt-8 space-y-4">
            {checkinResult && state === "strong" && (
              <div className="p-5 bg-dawn-surface/80 border border-dawn-haze/15 rounded-2xl animate-card-rise">
                <p className="font-serif text-lg italic leading-snug">{checkinResult.ack}</p>
              </div>
            )}
            {checkinResult && (state === "barely" || state === "exhausted") && (
              <div className="p-5 bg-dawn-surface/80 border border-dawn-haze/15 rounded-2xl animate-card-rise">
                {state === "exhausted" && <Lines lines={EXHAUSTED_LEAD} className="space-y-1 mb-3 text-dawn-ink/80" />}
                <p className="font-serif text-lg italic leading-snug">{checkinResult.ack}</p>
              </div>
            )}
            {state === "cant" && (
              <div className="p-5 bg-dawn-surface/80 border border-dawn-haze/15 rounded-2xl animate-card-rise">
                <Lines lines={CANT_RESPONSE} className="space-y-2 text-dawn-ink/85" />
              </div>
            )}

            {benchmark && state !== "cant" && (
              <BenchmarkFooter
                text={benchmark.text}
                sourceName={benchmark.sourceName}
                sourceUrl={benchmark.sourceUrl}
                benchmarkId={benchmark.id}
              />
            )}

            {/* Per-state actions — one clear next step each. */}
            {!writingOpen && !smallAction && !truthOpen && !calmOpen && ritualAvailable && (
              <div className="space-y-2">
                {state === "strong" && (
                  <button
                    onClick={() => setFinished(true)}
                    className="w-full py-3 text-[11px] uppercase tracking-[0.18em] text-dawn-ink/45 hover:text-dawn-ink/75"
                  >
                    Finish for today
                  </button>
                )}
                {(state === "barely" || state === "exhausted") && (
                  <>
                    <button
                      onClick={() =>
                        (goal?.goal.ritual ?? "card") === "writing" ? setWritingOpen(true) : void runRitual("card")
                      }
                      disabled={busy}
                      className="w-full py-3.5 bg-dawn-rose/15 border border-dawn-rose/30 text-dawn-rose text-xs uppercase tracking-[0.2em] font-bold rounded-full disabled:opacity-50"
                    >
                      Help me through today
                    </button>
                    {state === "exhausted" && (
                      <button
                        onClick={() => setSmallAction(smallActionFor(goal!.goal.title))}
                        className="w-full py-3 text-[11px] uppercase tracking-[0.18em] text-dawn-ink/50 hover:text-dawn-ink/80"
                      >
                        Give me one small action
                      </button>
                    )}
                    <button
                      onClick={() => setWritingOpen(true)}
                      className="w-full py-2 text-[11px] uppercase tracking-[0.18em] text-dawn-ink/40 hover:text-dawn-ink/70"
                    >
                      Write what is heavy
                    </button>
                  </>
                )}
                {state === "cant" && (
                  <>
                    <p className="text-center text-[10px] uppercase tracking-[0.2em] opacity-50">
                      What do you need right now?
                    </p>
                    <button
                      onClick={() => setCalmOpen(true)}
                      className="w-full p-4 text-left bg-dawn-surface/60 border border-dawn-haze/15 rounded-2xl hover:bg-dawn-haze/10 font-serif"
                    >
                      Help me slow down
                    </button>
                    <button
                      onClick={() => setWritingOpen(true)}
                      className="w-full p-4 text-left bg-dawn-surface/60 border border-dawn-haze/15 rounded-2xl hover:bg-dawn-haze/10 font-serif"
                    >
                      Let me write
                    </button>
                    <button
                      onClick={() => setTruthOpen(true)}
                      className="w-full p-4 text-left bg-dawn-surface/60 border border-dawn-haze/15 rounded-2xl hover:bg-dawn-haze/10 font-serif"
                    >
                      Tell me the truth
                    </button>
                    <button
                      onClick={() => {
                        setHonestyDone(false);
                        setHonestyAnswer(null);
                        setPhase("honesty");
                      }}
                      className="w-full p-4 text-left bg-dawn-surface/60 border border-dawn-haze/15 rounded-2xl hover:bg-dawn-haze/10 font-serif"
                    >
                      I may need to stop this goal
                    </button>
                  </>
                )}
              </div>
            )}

            {calmOpen && (
              <div className="p-6 bg-dawn-surface/80 border border-dawn-haze/15 rounded-2xl animate-card-rise">
                <Lines lines={CALM_FLOW} className="space-y-3 text-dawn-ink/85" />
                <button
                  onClick={() => setCalmOpen(false)}
                  className="mt-4 w-full py-2 text-[11px] uppercase tracking-[0.18em] text-dawn-ink/40"
                >
                  I'm back
                </button>
              </div>
            )}

            {truthOpen && (
              <div className="p-6 bg-dawn-surface/80 border border-dawn-haze/15 rounded-2xl animate-card-rise">
                <Lines lines={TRUTH_RESPONSE} className="space-y-3 text-dawn-ink/85" />
                <button
                  onClick={() => {
                    setHonestyDone(false);
                    setHonestyAnswer(null);
                    setPhase("honesty");
                  }}
                  className="mt-4 w-full py-3 text-xs uppercase tracking-[0.18em] font-bold text-dawn-rose border border-dawn-rose/30 rounded-full"
                >
                  Look at it honestly
                </button>
              </div>
            )}

            {smallAction && (
              <div className="p-6 bg-dawn-surface/80 border border-dawn-haze/15 rounded-2xl animate-card-rise">
                <p className="text-[10px] uppercase tracking-[0.2em] opacity-50 mb-2">One small action</p>
                <p className="font-serif italic text-lg leading-relaxed">{smallAction}</p>
              </div>
            )}

            {writingOpen && !reflection && (
              <div className="p-5 bg-dawn-surface/60 border border-dawn-haze/15 rounded-2xl">
                <p className="text-sm font-serif italic text-dawn-ink/70 mb-3">
                  {state ? WRITING_PROMPTS[state] : "Write it out."}
                </p>
                <textarea
                  value={writingText}
                  onChange={(e) => setWritingText(e.target.value)}
                  rows={3}
                  placeholder="Say it plainly…"
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
            )}

            {/* A second, smaller question for the ritual card. */}
            {ritualAvailable && !writingOpen && state !== "cant" && !smallAction && (
              <div className="pt-2">
                <p className="text-[10px] uppercase tracking-[0.2em] opacity-40 mb-2 text-center">
                  Let us ask a smaller question
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {RITUAL_CARD_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => void askWith(p, "ritual_prompt")}
                      disabled={busy}
                      className="text-[12px] px-4 py-2 rounded-full border border-dawn-haze/20 text-dawn-ink/70 hover:bg-dawn-haze/10 disabled:opacity-50"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {ritualCard && (
              <article className="p-6 bg-dawn-surface/80 border border-dawn-haze/15 rounded-2xl animate-card-rise">
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
              </article>
            )}

            {reflection && (
              <div className="p-6 bg-dawn-surface/80 border border-dawn-haze/15 rounded-2xl animate-card-rise">
                <p className="text-[10px] uppercase tracking-[0.2em] opacity-50 mb-2">Kept in your journal</p>
                <p className="font-serif italic text-lg leading-relaxed">{reflection}</p>
              </div>
            )}
          </section>
        )}

        {/* Soft goal discovery — gentle, rare, after value. */}
        {phase === "open" && !goal && discovery && (
          <section className="mt-10 p-6 bg-dawn-surface/60 border border-dawn-haze/15 rounded-2xl text-center animate-card-rise">
            <Lines lines={DISCOVERY_SOFT} className="space-y-1 text-dawn-ink/80 text-base" />
            <div className="mt-5 flex gap-3 justify-center">
              <Link
                to="/goal"
                onClick={() => track("goal_prompt_accepted")}
                className="px-6 py-3 bg-dawn-rose text-dawn-sky text-xs uppercase tracking-[0.18em] font-bold rounded-full"
              >
                Create a journey
              </Link>
              <button
                onClick={() => {
                  track("goal_prompt_dismissed");
                  setDiscovery(false);
                }}
                className="px-6 py-3 text-xs uppercase tracking-[0.18em] text-dawn-ink/50 border border-dawn-haze/20 rounded-full"
              >
                Not now
              </button>
            </div>
          </section>
        )}

        {phase === "open" && offlineNote && (
          <p className="mt-4 text-center text-xs text-dawn-rose/90">
            Can't reach Dawnhalo right now — your day count is safe; try again in a moment.
          </p>
        )}

        {/* No draw counter, no persistent hotlines (spec §5.2, §10). Support
            lives one tap away inside "I need something now", and appears
            prominently only when crisis detection triggers. */}

        {/* "I need something now" — always reachable, never loud. */}
        {(phase === "choose" || phase === "open") && (
          <div className="mt-10 text-center">
            <button
              onClick={() => {
                setNowOpen((v) => !v);
                setNowFlow(null);
              }}
              className="text-[11px] uppercase tracking-[0.2em] text-dawn-ink/40 hover:text-dawn-ink/70 border-b border-dawn-haze/20 pb-0.5"
            >
              {NOW_LABEL}
            </button>
            {nowOpen && (
              <div className="mt-4 p-5 bg-dawn-surface/80 border border-dawn-haze/15 rounded-2xl text-left animate-card-rise">
                {!nowFlow ? (
                  <>
                    <p className="text-[10px] uppercase tracking-[0.2em] opacity-50 mb-3">{NOW_QUESTION}</p>
                    <div className="flex flex-wrap gap-2">
                      {NOW_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => nowRoute(opt.id)}
                          className="text-[12px] px-4 py-2.5 rounded-full border border-dawn-haze/20 text-dawn-ink/75 hover:bg-dawn-haze/10"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                ) : nowFlow === "support" ? (
                  <div>
                    <p className="font-serif italic text-base leading-relaxed text-dawn-ink/85">
                      {SUPPORT_INTRO}
                    </p>
                    <div className="mt-4 space-y-2">
                      {SUPPORT_RESOURCES.map((r) => (
                        <a
                          key={r.region}
                          href={`tel:${r.tel}`}
                          className="block p-4 bg-dawn-sky/50 border border-dawn-haze/15 rounded-xl"
                        >
                          <p className="font-serif text-base text-dawn-ink">{r.label}</p>
                          <p className="text-xs text-dawn-ink/55">{r.detail}</p>
                        </a>
                      ))}
                    </div>
                    <button
                      onClick={() => setNowOpen(false)}
                      className="mt-4 w-full py-2 text-[11px] uppercase tracking-[0.18em] text-dawn-ink/40"
                    >
                      Close
                    </button>
                  </div>
                ) : (
                  <div>
                    <Lines
                      lines={nowFlow === "calm" ? CALM_FLOW : CLARITY_FLOW}
                      className="space-y-3 text-dawn-ink/85 text-base"
                    />
                    <button
                      onClick={() => setNowOpen(false)}
                      className="mt-4 w-full py-2 text-[11px] uppercase tracking-[0.18em] text-dawn-ink/40"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
