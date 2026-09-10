// The Vow — the spine of Dawnhalo. One hard thing, one hope, ONE card drawn
// once and never redrawn. From then on the app keeps count and bears witness:
// day number, dark nights, and finally a keepsake when the road ends.
//
// Above every vow stands the horizon: the life the person is walking toward.
// The horizon is never measured — no day count, no progress, no closing. A
// vow is a road toward it; there can be at most two roads at once.

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  createVow,
  setHorizon as saveHorizon,
  logDarkNight,
  closeVow,
  commitStep,
  declineStep,
  resolveStep,
  type Vow,
  type DarkNightContext,
  type CloseResult,
} from "@/lib/vow";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RITUAL_FLOOR_MS = 1600;

// ---------------------------------------------------------------------------
// Onboarding: (horizon, once) -> enduring -> hope -> letter -> the one draw.

type OnboardingPhase = "welcome" | "horizon" | "enduring" | "hope" | "letter" | "drawing" | "reveal";

export function VowOnboarding({
  onCreated,
  horizon = null,
  onHorizon,
  roadsOpen = 0,
  onCancel,
}: {
  onCreated: (vow: Vow) => void;
  /** The horizon already named, or null — when null the flow begins by naming it. */
  horizon?: string | null;
  onHorizon?: (horizon: string) => void;
  /** How many roads are already open; the copy changes for a second road. */
  roadsOpen?: number;
  /** Present when the person can step back to an existing road instead. */
  onCancel?: () => void;
}) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<OnboardingPhase>(horizon ? "enduring" : "welcome");
  const [horizonText, setHorizonText] = useState("");
  const [label, setLabel] = useState("");
  const [enduring, setEnduring] = useState("");
  const [hope, setHope] = useState("");
  const [letterTo, setLetterTo] = useState("");
  const [letterText, setLetterText] = useState("");
  const [vow, setVow] = useState<Vow | null>(null);
  const [busy, setBusy] = useState(false);
  // Fixed at mount: a background refresh mid-ritual must not turn this into "a second road".
  const [secondRoad] = useState(roadsOpen > 0);

  const nameHorizon = async () => {
    if (busy || !horizonText.trim()) return;
    setBusy(true);
    try {
      const out = await saveHorizon(horizonText.trim());
      if (out.kind === "crisis") {
        navigate({ to: "/support" });
        return;
      }
      onHorizon?.(out.horizon);
      setPhase("enduring");
    } finally {
      setBusy(false);
    }
  };

  const draw = async (withLetter: boolean) => {
    if (busy) return;
    setBusy(true);
    setPhase("drawing");
    const started = Date.now();
    const out = await createVow(enduring.trim(), hope.trim(), {
      label: label.trim() || undefined,
      letterTo: withLetter ? letterTo.trim() : undefined,
      letterText: withLetter ? letterText.trim() : undefined,
    });
    if (out.kind === "crisis") {
      navigate({ to: "/support" });
      return;
    }
    if (out.kind === "full") {
      // Two roads already — the home screen will show them. Nothing to reveal.
      onCancel?.();
      setBusy(false);
      return;
    }
    setVow(out.vow);
    await sleep(Math.max(0, RITUAL_FLOOR_MS - (Date.now() - started)));
    setPhase("reveal");
    setBusy(false);
  };

  return (
    <section className="animate-card-rise">
      {phase === "welcome" && (
        <div className="flex flex-col items-center text-center py-10">
          <div className="relative w-36 h-36 mb-4">
            <div
              aria-hidden
              className="absolute inset-0 rounded-full blur-[50px] opacity-80 animate-halo"
              style={{ background: "radial-gradient(circle, rgba(201,162,74,0.55) 0%, rgba(201,162,74,0.2) 45%, transparent 72%)" }}
            />
          </div>
          <h2 className="text-3xl font-serif font-light tracking-tight text-balance leading-tight">
            The far thing first.
          </h2>
          <p className="mt-4 text-dawn-ink/75 text-base leading-relaxed max-w-[34ch]">
            Say the life you are walking toward, in your own words. It is drawn once, in one thin line.
            Then one card for the road — drawn once, never redrawn. The staying is yours; the app keeps
            count of nothing but that.
          </p>
          <button
            onClick={() => setPhase("horizon")}
            className="mt-8 px-10 py-4 bg-dawn-rose text-dawn-sky text-[14px] uppercase tracking-[0.16em] font-bold rounded-full shadow-[0_12px_40px_-12px_rgba(201,162,74,0.45)] hover:bg-dawn-haze transition-all"
          >
            Name my horizon
          </button>
        </div>
      )}

      {phase === "horizon" && (
        <div className="flex flex-col items-center text-center py-8 animate-card-rise">
          <p className="text-[12px] uppercase tracking-[0.2em] font-medium text-dawn-rose mb-3">
            Your horizon
          </p>
          <h2 className="text-2xl font-serif font-light tracking-tight text-balance">
            What is the life you are walking toward?
          </h2>
          <p className="mt-3 text-dawn-ink/70 text-base leading-relaxed max-w-[34ch]">
            Say it in your own words. Not one of them will be changed. It is never measured — only kept,
            and drawn.
          </p>
          <textarea
            autoFocus
            value={horizonText}
            onChange={(e) => setHorizonText(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="In your own words."
            className="mt-6 w-full max-w-sm bg-dawn-surface/70 text-dawn-ink placeholder:text-dawn-ink/45 border border-dawn-haze/15 rounded-2xl p-5 text-base leading-relaxed focus:outline-none focus:ring-1 ring-dawn-rose/30 resize-none"
          />
          <button
            onClick={nameHorizon}
            disabled={busy || !horizonText.trim()}
            className="mt-6 px-10 py-4 bg-dawn-rose text-dawn-sky text-[14px] uppercase tracking-[0.16em] font-bold rounded-full shadow-[0_12px_40px_-12px_rgba(201,162,74,0.45)] hover:bg-dawn-haze transition-all disabled:opacity-60"
          >
            This is my horizon
          </button>
        </div>
      )}

      {phase === "enduring" && (
        <div className="flex flex-col items-center text-center py-8 animate-card-rise">
          <p className="text-[12px] uppercase tracking-[0.2em] font-medium text-dawn-rose mb-3">
            {secondRoad ? "A second road" : "Now, the first road"}
          </p>
          <h2 className="text-2xl font-serif font-light tracking-tight text-balance">
            What are you walking through, for it?
          </h2>
          <p className="mt-3 text-dawn-ink/70 text-base leading-relaxed max-w-[34ch]">
            The hard thing you are living through right now — the road, in your own words.
          </p>
          <textarea
            autoFocus
            value={enduring}
            onChange={(e) => setEnduring(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="I'm waiting for… I'm carrying… I'm holding on through…"
            className="mt-6 w-full max-w-sm bg-dawn-surface/70 text-dawn-ink placeholder:text-dawn-ink/45 border border-dawn-haze/15 rounded-2xl p-5 text-base leading-relaxed focus:outline-none focus:ring-1 ring-dawn-rose/30 resize-none"
          />
          <button
            onClick={() => enduring.trim() && setPhase("hope")}
            disabled={!enduring.trim()}
            className="mt-6 px-10 py-4 bg-dawn-rose text-dawn-sky text-[14px] uppercase tracking-[0.16em] font-bold rounded-full shadow-[0_12px_40px_-12px_rgba(244,163,122,0.5)] hover:bg-dawn-haze transition-all disabled:opacity-60"
          >
            Continue
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              className="mt-4 text-[13px] uppercase tracking-[0.18em] text-dawn-ink/60 hover:text-dawn-ink/80 transition-colors"
            >
              Not now
            </button>
          )}
        </div>
      )}

      {phase === "hope" && (
        <div className="flex flex-col items-center text-center py-8 animate-card-rise">
          <p className="text-[12px] uppercase tracking-[0.2em] font-medium text-dawn-rose mb-3">
            And on the other side of it
          </p>
          <h2 className="text-2xl font-serif font-light tracking-tight text-balance">
            What do you hope for, on this road?
          </h2>
          <p className="mt-3 text-dawn-ink/70 text-base leading-relaxed max-w-[34ch]">
            Name it plainly. The card will hold it with you — the hope stays yours.
          </p>
          <textarea
            autoFocus
            value={hope}
            onChange={(e) => setHope(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="That it works out. That the answer comes. That this was worth it."
            className="mt-6 w-full max-w-sm bg-dawn-surface/70 text-dawn-ink placeholder:text-dawn-ink/45 border border-dawn-haze/15 rounded-2xl p-5 text-base leading-relaxed focus:outline-none focus:ring-1 ring-dawn-rose/30 resize-none"
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={40}
            placeholder="Name this road in a word or two (optional) — Body, The Shop, Us"
            className="mt-3 w-full max-w-sm bg-dawn-surface/70 text-dawn-ink placeholder:text-dawn-ink/45 border border-dawn-haze/15 rounded-xl px-5 py-3.5 text-base text-center focus:outline-none focus:ring-1 ring-dawn-rose/30"
          />
          <button
            onClick={() => hope.trim() && setPhase("letter")}
            disabled={!hope.trim()}
            className="mt-6 px-10 py-4 bg-dawn-rose text-dawn-sky text-[14px] uppercase tracking-[0.16em] font-bold rounded-full shadow-[0_12px_40px_-12px_rgba(244,163,122,0.5)] hover:bg-dawn-haze transition-all disabled:opacity-60"
          >
            Continue
          </button>
          <button
            onClick={() => setPhase("enduring")}
            className="mt-4 text-[13px] uppercase tracking-[0.18em] text-dawn-ink/60 hover:text-dawn-ink/70 transition-colors"
          >
            Back
          </button>
        </div>
      )}

      {phase === "letter" && (
        <div className="flex flex-col items-center text-center py-8 animate-card-rise">
          <p className="text-[12px] uppercase tracking-[0.2em] font-medium text-dawn-rose mb-3">
            One more thing — only if you want
          </p>
          <h2 className="text-2xl font-serif font-light tracking-tight text-balance">
            Is there someone you're walking this road for?
          </h2>
          <p className="mt-3 text-dawn-ink/70 text-base leading-relaxed max-w-[36ch]">
            Write them a letter. It is sealed the moment you draw — even you can't reread it. They
            will never know it exists… unless the day comes. If you let this vow go, the letter
            burns unread. No one ever finds out.
          </p>
          <input
            value={letterTo}
            onChange={(e) => setLetterTo(e.target.value)}
            maxLength={80}
            placeholder="Their name"
            className="mt-6 w-full max-w-sm bg-dawn-surface/70 text-dawn-ink placeholder:text-dawn-ink/45 border border-dawn-haze/15 rounded-xl px-5 py-3.5 text-base text-center focus:outline-none focus:ring-1 ring-dawn-rose/30"
          />
          <textarea
            value={letterText}
            onChange={(e) => setLetterText(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="I made this vow today. If you're reading this, I made it…"
            className="mt-3 w-full max-w-sm bg-dawn-surface/70 text-dawn-ink placeholder:text-dawn-ink/45 border border-dawn-haze/15 rounded-2xl p-5 text-base leading-relaxed focus:outline-none focus:ring-1 ring-dawn-rose/30 resize-none"
          />
          <div className="mt-6 p-4 max-w-sm bg-dawn-sky/60 border border-dawn-haze/15 rounded-xl">
            <p className="text-[13px] leading-relaxed text-dawn-ink/75">
              You will draw <span className="font-bold text-dawn-ink/80">one card</span> for this
              vow. It cannot be redrawn. It stays with you until the road ends.
            </p>
          </div>
          <button
            onClick={() => draw(true)}
            disabled={busy || !letterTo.trim() || !letterText.trim()}
            className="mt-6 px-10 py-4 bg-dawn-rose text-dawn-sky text-[14px] uppercase tracking-[0.16em] font-bold rounded-full shadow-[0_12px_40px_-12px_rgba(244,163,122,0.5)] hover:bg-dawn-haze transition-all disabled:opacity-60"
          >
            Seal the letter &amp; draw
          </button>
          <button
            onClick={() => draw(false)}
            disabled={busy}
            className="mt-4 text-[13px] uppercase tracking-[0.18em] text-dawn-ink/60 hover:text-dawn-ink/70 transition-colors disabled:opacity-70"
          >
            Skip — just the vow
          </button>
        </div>
      )}

      {phase === "drawing" && (
        <div className="flex flex-col items-center text-center py-16">
          <div className="relative w-56 h-56 mb-6">
            <div
              aria-hidden
              className="absolute inset-0 rounded-full blur-[80px] animate-halo-breathe"
              style={{
                background:
                  "radial-gradient(circle, rgba(245,207,138,0.6) 0%, rgba(244,163,122,0.35) 40%, transparent 70%)",
              }}
            />
          </div>
          <p className="font-serif text-xl italic text-dawn-ink/85 animate-card-rise leading-relaxed">
            The deck is choosing for you.
          </p>
          <p className="mt-2 text-base text-dawn-ink/70 animate-card-rise">
            Take a slow breath. This card is drawn once.
          </p>
        </div>
      )}

      {phase === "reveal" && vow && (
        <div className="animate-card-draw">
          <article className="relative">
            <div
              aria-hidden
              className="absolute -inset-12 -z-10 rounded-[3rem] blur-3xl animate-halo opacity-80"
              style={{
                background:
                  "radial-gradient(60% 55% at 50% 40%, rgba(245,207,138,0.55) 0%, rgba(244,163,122,0.35) 35%, rgba(189,92,120,0.18) 65%, transparent 80%)",
              }}
            />
            <div className="relative rounded-2xl p-7 sm:p-8 border border-dawn-haze/15 bg-dawn-surface/80 backdrop-blur-xl shadow-[0_40px_120px_-30px_rgba(245,180,120,0.35)]">
              <div className="w-full aspect-[4/5] mb-7 rounded-lg overflow-hidden ring-1 ring-dawn-haze/15 bg-dawn-ink/10">
                <img
                  src={vow.card.illustration}
                  alt={vow.card.title}
                  width={768}
                  height={1152}
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="text-[12px] uppercase tracking-[0.2em] font-medium text-dawn-rose mb-2">
                Your vow card · drawn once
              </p>
              <p className="text-base italic font-serif opacity-75 leading-relaxed">{vow.card.opener}</p>
              <h2 className="mt-2 text-3xl font-serif font-light tracking-tight text-balance">
                {vow.card.title}
              </h2>
              <div className="mt-4 space-y-3 max-w-[46ch]">
                {vow.card.message.split(/\n{2,}/).map((p, i) => (
                  <p key={i} className="text-dawn-ink/75 leading-relaxed text-base">{p}</p>
                ))}
              </div>
              {vow.card.reflection && (
                <div className="mt-6 pl-4 border-l-2 border-dawn-rose/40">
                  <p className="text-base font-serif italic text-dawn-ink/85 leading-relaxed">
                    {vow.card.reflection}
                  </p>
                </div>
              )}
              <button
                onClick={() => onCreated(vow)}
                className="mt-8 w-full py-4 bg-dawn-rose text-dawn-sky text-[14px] uppercase tracking-[0.16em] font-bold rounded-full hover:bg-dawn-haze transition-colors"
              >
                {secondRoad ? "Open the road — Day 1" : horizon || horizonText ? "Show me my horizon — Day 1" : "Begin the count — Day 1"}
              </button>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Home panel: the standing vow — day count, dark nights, the ways it ends.

type PanelMode = "idle" | "reading" | "night" | "nightDone" | "closing" | "closed";

export function VowPanel({
  vow,
  onEnded,
  onWitnessed,
}: {
  vow: Vow;
  onEnded: () => void;
  /** A done step or a hard night was written down — the horizon may take color. */
  onWitnessed?: () => void;
}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<PanelMode>("idle");
  const [nightText, setNightText] = useState("");
  const [nightCtx, setNightCtx] = useState<DarkNightContext | null>(null);
  const [nightChoice, setNightChoice] = useState<"none" | "step" | "stayed" | "stepped">("none");
  const [outcome, setOutcome] = useState<"fulfilled" | "released">("fulfilled");
  const [note, setNote] = useState("");
  const [closeResult, setCloseResult] = useState<CloseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // One Small Step — local phase over the snapshot's living state.
  const [stepText, setStepText] = useState("");
  const [stepPhase, setStepPhase] = useState<"snapshot" | "declined" | "committed" | "witness">(
    "snapshot",
  );
  const [stepLine, setStepLine] = useState<string | null>(null);
  const [committedText, setCommittedText] = useState<string | null>(null);

  const living = vow.living;
  const showAsk = stepPhase === "snapshot" && !living.todayStep && living.askStep;
  // "Did it move?" appears on RETURN, not right after committing — the doc's
  // distinction between inviting a step and auditing it.
  const showResolve = stepPhase === "snapshot" && living.todayStep?.status === "committed";
  const resolveText = living.todayStep?.text ?? committedText ?? "";

  const doCommit = async (text: string) => {
    if (busy || !text.trim()) return;
    setBusy(true);
    try {
      const out = await commitStep(text.trim(), vow.id);
      if (out?.kind === "crisis") {
        navigate({ to: "/support" });
        return;
      }
      if (out?.kind === "step") {
        setCommittedText(out.step.text);
        setStepPhase("committed");
        setStepText("");
      }
    } finally {
      setBusy(false);
    }
  };

  const doDecline = async () => {
    setStepPhase("declined"); // no message, no warning — just quiet
    void declineStep(vow.id);
  };

  const doResolve = async (done: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const line = await resolveStep(done, vow.id);
      setStepLine(line);
      setStepPhase("witness");
      if (done) onWitnessed?.();
    } finally {
      setBusy(false);
    }
  };

  // After logging a night the vow prop is stale; the context carries the truth.
  const nights = nightCtx ? nightCtx.nightNumber : vow.darkNights.length;

  const submitNight = async () => {
    if (busy || !nightText.trim()) return;
    setBusy(true);
    try {
      const out = await logDarkNight(nightText.trim(), vow.id);
      if (!out) return;
      if (out.kind === "crisis") {
        navigate({ to: "/support" });
        return;
      }
      setNightCtx(out.context);
      setNightText("");
      setMode("nightDone");
      onWitnessed?.();
    } finally {
      setBusy(false);
    }
  };

  const submitClose = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await closeVow(outcome, note.trim(), vow.id);
      if (res) {
        setCloseResult(res);
        setMode("closed");
      }
    } finally {
      setBusy(false);
    }
  };

  const copyUrl = async () => {
    if (!closeResult?.url) return;
    try {
      await navigator.clipboard.writeText(closeResult.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  if (mode === "closed" && closeResult) {
    const k = closeResult.keepsake;
    return (
      <section className="mb-10 animate-card-rise">
        <div className="relative rounded-2xl p-7 border border-dawn-haze/15 bg-dawn-surface/80 backdrop-blur-xl text-center">
          <p className="text-[12px] uppercase tracking-[0.2em] font-medium text-dawn-rose">
            {k.status === "fulfilled" ? "It came true" : "Released with honor"}
          </p>
          <h2 className="mt-2 text-3xl font-serif font-light tracking-tight">
            {k.daysHeld} days held
          </h2>
          <p className="mt-3 text-base text-dawn-ink/70 leading-relaxed max-w-[38ch] mx-auto">
            {k.status === "fulfilled"
              ? `You held on through ${k.darkNights} hard night${k.darkNights === 1 ? "" : "s"}, and the thing you hoped for arrived. ${k.cardTitle} kept its watch.`
              : `The hoped-for thing didn't come — but ${k.daysHeld} days of staying did. That was never the card's doing. It was yours.`}
          </p>
          {closeResult.letter && (
            <div className="mt-6 p-5 bg-dawn-sky/60 border border-dawn-rose/30 rounded-2xl text-left">
              <p className="text-[12px] uppercase tracking-[0.2em] font-medium text-dawn-rose mb-2">
                The letter to {closeResult.letter.to} is unsealed
              </p>
              <p className="font-serif italic text-base leading-relaxed text-dawn-ink/85">
                “{closeResult.letter.text}”
              </p>
              {closeResult.letter.url && (
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(closeResult.letter!.url!);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1600);
                    } catch {
                      /* clipboard unavailable */
                    }
                  }}
                  className="mt-4 px-6 py-2.5 bg-dawn-rose text-dawn-sky text-[12px] uppercase tracking-[0.12em] font-bold rounded-full hover:bg-dawn-haze transition-colors"
                >
                  {copied ? "Link copied" : `Copy the letter link for ${closeResult.letter.to}`}
                </button>
              )}
              <p className="mt-3 text-[13px] text-dawn-ink/70 leading-relaxed">
                You decide when and how it reaches them. The app never sends anything itself.
              </p>
            </div>
          )}
          {closeResult.letterBurned && (
            <p className="mt-5 text-[15px] font-serif italic text-dawn-ink/75 leading-relaxed">
              The letter burned unread. Only you know how many days you stood.
            </p>
          )}
          {closeResult.url && (
            <button
              onClick={copyUrl}
              className="mt-6 px-8 py-3.5 bg-dawn-rose text-dawn-sky text-[13px] uppercase tracking-[0.2em] font-bold rounded-full hover:bg-dawn-haze transition-colors"
            >
              {copied ? "Link copied" : "Share the keepsake"}
            </button>
          )}
          <button
            onClick={onEnded}
            className="mt-4 block mx-auto text-[13px] uppercase tracking-[0.18em] text-dawn-ink/65 hover:text-dawn-ink/75 transition-colors"
          >
            Back to the horizon
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-10">
      <article className="relative">
        <div
          aria-hidden
          className="absolute -inset-8 -z-10 rounded-[3rem] blur-3xl animate-halo opacity-75"
          style={{
            background:
              "radial-gradient(60% 55% at 50% 40%, rgba(245,207,138,0.4) 0%, rgba(244,163,122,0.22) 40%, transparent 75%)",
          }}
        />
        <div className="relative rounded-2xl border border-dawn-haze/15 bg-dawn-surface/80 backdrop-blur-xl overflow-hidden">
          {/* Header row: the standing vow */}
          <div className="flex items-center gap-4 p-5">
            <div className="size-16 rounded-lg overflow-hidden ring-1 ring-dawn-haze/15 shrink-0 bg-dawn-ink/10">
              <img
                src={vow.card.illustration}
                alt={vow.card.title}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] uppercase tracking-[0.16em] font-medium text-dawn-rose truncate">
                {vow.label ?? "Your vow"}
              </p>
              <h2 className="font-serif text-xl font-medium tracking-tight leading-tight">
                {vow.card.title}
              </h2>
              <p className="text-[13px] text-dawn-ink/70 italic line-clamp-2 leading-snug">“{vow.hope}”</p>
            </div>
            <div className="text-right shrink-0 pl-1">
              <span className="block text-3xl font-serif italic text-dawn-haze leading-none">
                {String(vow.dayNumber).padStart(2, "0")}
              </span>
              <span className="text-[12px] uppercase tracking-[0.14em] text-dawn-muted">
                day{vow.dayNumber === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          {vow.letter?.sealed && (
            <p className="px-5 -mt-2 pb-1 text-[12px] uppercase tracking-[0.18em] text-dawn-rose/70">
              ✉ A letter to {vow.letter.initial}. — sealed
            </p>
          )}

          {/* The quiet welcome back — never a count of absent days. */}
          {mode === "idle" && living.returnLine && (
            <p className="px-5 pb-2 font-serif italic text-base text-dawn-ink/70">
              {living.returnLine}
            </p>
          )}

          {/* Memory — rare, narrative evidence. The only place moves are spoken of. */}
          {mode === "idle" && living.memory && (
            <div className="mx-5 mb-3 p-4 bg-dawn-sky/60 border border-dawn-haze/15 rounded-xl">
              <p className="text-[12px] uppercase tracking-[0.2em] font-medium text-dawn-rose/70 mb-1.5">
                Memory
              </p>
              <p className="font-serif italic text-base leading-relaxed text-dawn-ink/85">
                {living.memory}
              </p>
            </div>
          )}

          {/* One Small Step — an invitation, never an assignment. */}
          {mode === "idle" && showAsk && (
            <div className="px-5 pb-4">
              <p className="text-[15px] font-serif italic text-dawn-ink/75 leading-relaxed mb-3">
                {living.actionPrompt}
              </p>
              <input
                value={stepText}
                onChange={(e) => setStepText(e.target.value)}
                maxLength={300}
                placeholder="One call. Ten minutes. One page. Just showing up."
                className="w-full bg-dawn-sky/60 text-dawn-ink placeholder:text-dawn-ink/45 border border-dawn-haze/15 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-1 ring-dawn-rose/30"
              />
              <div className="mt-3 flex items-center gap-4">
                <button
                  onClick={() => doCommit(stepText)}
                  disabled={busy || !stepText.trim()}
                  className="px-6 py-2.5 bg-dawn-rose text-dawn-sky text-[12px] uppercase tracking-[0.12em] font-bold rounded-full hover:bg-dawn-haze transition-colors disabled:opacity-60"
                >
                  I'll do this
                </button>
                <button
                  onClick={doDecline}
                  className="text-[12px] uppercase tracking-[0.18em] text-dawn-ink/60 hover:text-dawn-ink/70 transition-colors"
                >
                  Not today
                </button>
              </div>
            </div>
          )}

          {mode === "idle" && showResolve && (
            <div className="px-5 pb-4">
              <p className="text-[12px] uppercase tracking-[0.18em] font-medium opacity-70 mb-1.5">
                Did it move?
              </p>
              <p className="font-serif italic text-base text-dawn-ink/80 mb-3">“{resolveText}”</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => doResolve(true)}
                  disabled={busy}
                  className="px-6 py-2.5 bg-dawn-rose text-dawn-sky text-[12px] uppercase tracking-[0.12em] font-bold rounded-full hover:bg-dawn-haze transition-colors disabled:opacity-60"
                >
                  Yes — I did it
                </button>
                <button
                  onClick={() => doResolve(false)}
                  disabled={busy}
                  className="text-[12px] uppercase tracking-[0.18em] text-dawn-ink/65 hover:text-dawn-ink/75 transition-colors disabled:opacity-70"
                >
                  Not this time
                </button>
              </div>
            </div>
          )}

          {mode === "idle" && stepPhase === "committed" && committedText && (
            <p className="px-5 pb-4 font-serif italic text-base text-dawn-ink/75">
              “{committedText}” — held for today.
            </p>
          )}

          {mode === "idle" && stepPhase === "witness" && stepLine && (
            <p className="px-5 pb-4 font-serif italic text-base text-dawn-ink/85">{stepLine}</p>
          )}

          {mode === "reading" && (
            <div className="px-5 pb-5 animate-card-rise">
              <div className="pt-4 border-t border-dawn-haze/10 space-y-3">
                <p className="text-base italic font-serif opacity-75">{vow.card.opener}</p>
                {vow.card.message.split(/\n{2,}/).map((p, i) => (
                  <p key={i} className="text-dawn-ink/75 leading-relaxed text-base">{p}</p>
                ))}
                {vow.card.reflection && (
                  <p className="pl-3 border-l-2 border-dawn-rose/40 text-base font-serif italic text-dawn-ink/85">
                    {vow.card.reflection}
                  </p>
                )}
                <p className="text-[12px] uppercase tracking-[0.18em] opacity-60 pt-1">
                  Enduring: <span className="normal-case italic opacity-90">“{vow.enduring}”</span>
                </p>
              </div>
            </div>
          )}

          {mode === "night" && (
            <div className="px-5 pb-5 animate-card-rise">
              <div className="bg-dawn-night rounded-2xl p-5 text-[#f7eef2]">
                <p className="text-[12px] uppercase tracking-[0.18em] font-medium opacity-70 mb-3">
                  A hard night · say it in one line
                </p>
                <textarea
                  autoFocus
                  value={nightText}
                  onChange={(e) => setNightText(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="I don't know if I can keep doing this…"
                  className="w-full bg-dawn-cream text-dawn-ink placeholder:text-dawn-ink/45 border border-dawn-gold/30 rounded-xl p-4 text-base focus:outline-none focus:ring-1 ring-dawn-rose/30 resize-none"
                />
                <div className="mt-3 flex items-center gap-4">
                  <button
                    onClick={submitNight}
                    disabled={busy || !nightText.trim()}
                    className="px-6 py-2.5 bg-dawn-cream text-dawn-ink text-[12px] uppercase tracking-[0.12em] font-bold rounded-full hover:bg-dawn-gold transition-colors disabled:opacity-60"
                  >
                    Write it down
                  </button>
                  <button
                    onClick={() => setMode("idle")}
                    className="text-[12px] uppercase tracking-[0.18em] opacity-70 hover:opacity-80"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {mode === "nightDone" && nightCtx && (
            <div className="px-5 pb-5 animate-card-rise">
              <div className="bg-dawn-night rounded-2xl p-5 text-[#f7eef2]">
                <p className="text-[12px] uppercase tracking-[0.18em] font-medium text-dawn-gold mb-2">
                  Witnessed
                </p>
                <p className="font-serif italic text-base leading-relaxed text-[#f7eef2]">
                  {nightCtx.line}
                </p>

                {/* Some nights, will means moving; some nights it means only
                    not letting go. The user decides which night this is. */}
                {nightChoice === "none" && (
                  <div className="mt-4">
                    <p className="text-[15px] text-[#f7eef2]/85 mb-3">
                      Do you need to stay still tonight, or move one small thing?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setNightChoice("stayed")}
                        className="text-[12px] uppercase tracking-[0.1em] font-medium px-4 py-2.5 rounded-full border border-[#f7eef2]/30 text-[#f7eef2]/90 hover:bg-[#f7eef2]/10 transition-colors"
                      >
                        Just stay with me
                      </button>
                      <button
                        onClick={() => setNightChoice("step")}
                        className="text-[12px] uppercase tracking-[0.1em] font-medium px-4 py-2.5 rounded-full border border-dawn-gold/60 text-dawn-gold hover:bg-dawn-gold/10 transition-colors"
                      >
                        One small step
                      </button>
                    </div>
                  </div>
                )}

                {nightChoice === "stayed" && (
                  <p className="mt-4 font-serif italic text-base text-[#f7eef2]/85">
                    Then stay. Nothing has to be solved tonight.
                  </p>
                )}

                {nightChoice === "step" && (
                  <div className="mt-4">
                    <p className="text-[12px] uppercase tracking-[0.18em] font-medium opacity-70 mb-2">
                      What's the smallest thing that would still count?
                    </p>
                    <input
                      autoFocus
                      value={stepText}
                      onChange={(e) => setStepText(e.target.value)}
                      maxLength={300}
                      placeholder="Put on my shoes. Open the document. Send one message."
                      className="w-full bg-dawn-cream text-dawn-ink placeholder:text-dawn-ink/45 border border-dawn-gold/30 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-1 ring-dawn-rose/30"
                    />
                    <button
                      onClick={async () => {
                        await doCommit(stepText);
                        setNightChoice("stepped");
                      }}
                      disabled={busy || !stepText.trim()}
                      className="mt-3 px-6 py-2.5 bg-dawn-cream text-dawn-ink text-[12px] uppercase tracking-[0.12em] font-bold rounded-full hover:bg-dawn-gold transition-colors disabled:opacity-60"
                    >
                      That's enough for tonight
                    </button>
                  </div>
                )}

                {nightChoice === "stepped" && committedText && (
                  <p className="mt-4 font-serif italic text-base text-[#f7eef2]/85">
                    “{committedText}” — held for tonight. That's enough.
                  </p>
                )}
              </div>
            </div>
          )}

          {mode === "closing" && (
            <div className="px-5 pb-5 animate-card-rise">
              <div className="pt-4 border-t border-dawn-haze/10">
                <p className="text-[12px] uppercase tracking-[0.18em] font-medium opacity-70 mb-3">
                  {outcome === "fulfilled" ? "It came true — tell the ending" : "Let it go — with honor"}
                </p>
                <p className="text-[14px] text-dawn-ink/70 leading-relaxed mb-3">
                  {outcome === "fulfilled"
                    ? "This closes the vow and mints your keepsake — the whole arc, kept."
                    : "Some hopes don't arrive. The days you held were still real; the keepsake keeps them."}
                </p>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder={outcome === "fulfilled" ? "What happened?" : "A closing word (optional)"}
                  className="w-full bg-dawn-sky/60 text-dawn-ink placeholder:text-dawn-ink/45 border border-dawn-haze/15 rounded-xl p-4 text-base focus:outline-none focus:ring-1 ring-dawn-rose/30 resize-none"
                />
                <div className="mt-3 flex items-center gap-4">
                  <button
                    onClick={submitClose}
                    disabled={busy}
                    className="px-6 py-2.5 bg-dawn-rose text-dawn-sky text-[12px] uppercase tracking-[0.12em] font-bold rounded-full hover:bg-dawn-haze transition-colors disabled:opacity-60"
                  >
                    {outcome === "fulfilled" ? "Seal it — fulfilled" : "Release it"}
                  </button>
                  <button
                    onClick={() => setMode("idle")}
                    className="text-[12px] uppercase tracking-[0.18em] opacity-70 hover:opacity-80"
                  >
                    Not yet
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Action bar */}
          <div className="flex flex-wrap gap-2 px-5 pb-5">
            <button
              onClick={() => setMode(mode === "reading" ? "idle" : "reading")}
              className="text-[12px] uppercase tracking-[0.1em] font-medium px-3.5 py-2 rounded-full border border-dawn-haze/20 text-dawn-ink/80 hover:bg-dawn-haze/10 transition-colors"
            >
              {mode === "reading" ? "Fold the card" : "Read the vow"}
            </button>
            <button
              onClick={() => setMode("night")}
              className="text-[12px] uppercase tracking-[0.1em] font-medium px-3.5 py-2 rounded-full border border-dawn-haze/20 text-dawn-ink/80 hover:bg-dawn-haze/10 transition-colors"
            >
              A hard night{nights > 0 ? ` · ${nights}` : ""}
            </button>
            <button
              onClick={() => {
                setOutcome("fulfilled");
                setMode("closing");
              }}
              className="text-[12px] uppercase tracking-[0.1em] font-bold px-3.5 py-2 rounded-full bg-dawn-rose/15 border border-dawn-rose/30 text-dawn-rose hover:bg-dawn-rose/25 transition-colors"
            >
              It came true
            </button>
            <button
              onClick={() => {
                setOutcome("released");
                setMode("closing");
              }}
              className="text-[12px] uppercase tracking-[0.1em] font-medium px-3.5 py-2 rounded-full text-dawn-ink/60 hover:text-dawn-ink/70 transition-colors"
            >
              Let it go
            </button>
          </div>
        </div>
      </article>
    </section>
  );
}
