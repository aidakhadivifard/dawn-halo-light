// The Vow — the spine of Dawnhalo. One hard thing, one hope, ONE card drawn
// once and never redrawn. From then on the app keeps count and bears witness:
// day number, dark nights, and finally a keepsake when the road ends.

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  createVow,
  logDarkNight,
  closeVow,
  type Vow,
  type DarkNightContext,
  type CloseResult,
} from "@/lib/vow";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RITUAL_FLOOR_MS = 1600;

// ---------------------------------------------------------------------------
// Onboarding: enduring -> hope -> the one draw -> sealed.

export function VowOnboarding({ onCreated }: { onCreated: (vow: Vow) => void }) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"enduring" | "hope" | "letter" | "drawing" | "reveal">(
    "enduring",
  );
  const [enduring, setEnduring] = useState("");
  const [hope, setHope] = useState("");
  const [letterTo, setLetterTo] = useState("");
  const [letterText, setLetterText] = useState("");
  const [vow, setVow] = useState<Vow | null>(null);
  const [busy, setBusy] = useState(false);

  const draw = async (withLetter: boolean) => {
    if (busy) return;
    setBusy(true);
    setPhase("drawing");
    const started = Date.now();
    const out = await createVow(
      enduring.trim(),
      hope.trim(),
      withLetter ? letterTo.trim() : undefined,
      withLetter ? letterText.trim() : undefined,
    );
    if (out.kind === "crisis") {
      navigate({ to: "/support" });
      return;
    }
    setVow(out.vow);
    await sleep(Math.max(0, RITUAL_FLOOR_MS - (Date.now() - started)));
    setPhase("reveal");
    setBusy(false);
  };

  return (
    <section className="animate-card-rise">
      {phase === "enduring" && (
        <div className="flex flex-col items-center text-center py-8">
          <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-dawn-rose mb-3">
            Before anything else
          </p>
          <h2 className="text-2xl font-serif font-light tracking-tight text-balance">
            What are you enduring?
          </h2>
          <p className="mt-3 text-dawn-ink/50 text-sm leading-relaxed max-w-[34ch]">
            The hard thing you are living through right now — in your own words.
          </p>
          <textarea
            autoFocus
            value={enduring}
            onChange={(e) => setEnduring(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="I'm waiting for… I'm carrying… I'm holding on through…"
            className="mt-6 w-full max-w-sm bg-dawn-surface/70 text-dawn-ink placeholder:text-dawn-ink/30 border border-dawn-haze/15 rounded-2xl p-5 text-sm leading-relaxed focus:outline-none focus:ring-1 ring-dawn-rose/30 resize-none"
          />
          <button
            onClick={() => enduring.trim() && setPhase("hope")}
            disabled={!enduring.trim()}
            className="mt-6 px-10 py-4 bg-dawn-rose text-dawn-sky text-sm uppercase tracking-[0.2em] font-bold rounded-full shadow-[0_12px_40px_-12px_rgba(244,163,122,0.5)] hover:bg-dawn-haze transition-all disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      )}

      {phase === "hope" && (
        <div className="flex flex-col items-center text-center py-8 animate-card-rise">
          <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-dawn-rose mb-3">
            And on the other side of it
          </p>
          <h2 className="text-2xl font-serif font-light tracking-tight text-balance">
            What do you hope for?
          </h2>
          <p className="mt-3 text-dawn-ink/50 text-sm leading-relaxed max-w-[34ch]">
            Name it plainly. The card will hold it with you — the hope stays yours.
          </p>
          <textarea
            autoFocus
            value={hope}
            onChange={(e) => setHope(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="That it works out. That the answer comes. That this was worth it."
            className="mt-6 w-full max-w-sm bg-dawn-surface/70 text-dawn-ink placeholder:text-dawn-ink/30 border border-dawn-haze/15 rounded-2xl p-5 text-sm leading-relaxed focus:outline-none focus:ring-1 ring-dawn-rose/30 resize-none"
          />
          <button
            onClick={() => hope.trim() && setPhase("letter")}
            disabled={!hope.trim()}
            className="mt-6 px-10 py-4 bg-dawn-rose text-dawn-sky text-sm uppercase tracking-[0.2em] font-bold rounded-full shadow-[0_12px_40px_-12px_rgba(244,163,122,0.5)] hover:bg-dawn-haze transition-all disabled:opacity-40"
          >
            Continue
          </button>
          <button
            onClick={() => setPhase("enduring")}
            className="mt-4 text-[11px] uppercase tracking-[0.18em] text-dawn-ink/40 hover:text-dawn-ink/70 transition-colors"
          >
            Back
          </button>
        </div>
      )}

      {phase === "letter" && (
        <div className="flex flex-col items-center text-center py-8 animate-card-rise">
          <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-dawn-rose mb-3">
            One more thing — only if you want
          </p>
          <h2 className="text-2xl font-serif font-light tracking-tight text-balance">
            Is there someone you're walking this road for?
          </h2>
          <p className="mt-3 text-dawn-ink/50 text-sm leading-relaxed max-w-[36ch]">
            Write them a letter. It is sealed the moment you draw — even you can't reread it. They
            will never know it exists… unless the day comes. If you let this vow go, the letter
            burns unread. No one ever finds out.
          </p>
          <input
            value={letterTo}
            onChange={(e) => setLetterTo(e.target.value)}
            maxLength={80}
            placeholder="Their name"
            className="mt-6 w-full max-w-sm bg-dawn-surface/70 text-dawn-ink placeholder:text-dawn-ink/30 border border-dawn-haze/15 rounded-xl px-5 py-3.5 text-sm text-center focus:outline-none focus:ring-1 ring-dawn-rose/30"
          />
          <textarea
            value={letterText}
            onChange={(e) => setLetterText(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="I made this vow today. If you're reading this, I made it…"
            className="mt-3 w-full max-w-sm bg-dawn-surface/70 text-dawn-ink placeholder:text-dawn-ink/30 border border-dawn-haze/15 rounded-2xl p-5 text-sm leading-relaxed focus:outline-none focus:ring-1 ring-dawn-rose/30 resize-none"
          />
          <div className="mt-6 p-4 max-w-sm bg-dawn-sky/60 border border-dawn-haze/15 rounded-xl">
            <p className="text-[11px] leading-relaxed text-dawn-ink/60">
              You will draw <span className="font-bold text-dawn-ink/80">one card</span> for this
              vow. It cannot be redrawn. It stays with you until the road ends.
            </p>
          </div>
          <button
            onClick={() => draw(true)}
            disabled={busy || !letterTo.trim() || !letterText.trim()}
            className="mt-6 px-10 py-4 bg-dawn-rose text-dawn-sky text-sm uppercase tracking-[0.2em] font-bold rounded-full shadow-[0_12px_40px_-12px_rgba(244,163,122,0.5)] hover:bg-dawn-haze transition-all disabled:opacity-40"
          >
            Seal the letter &amp; draw
          </button>
          <button
            onClick={() => draw(false)}
            disabled={busy}
            className="mt-4 text-[11px] uppercase tracking-[0.18em] text-dawn-ink/40 hover:text-dawn-ink/70 transition-colors disabled:opacity-50"
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
          <p className="font-serif text-lg italic text-dawn-ink/80 animate-card-rise leading-relaxed">
            Take a slow breath.
            <br />
            This card is drawn once.
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
              <div className="w-full aspect-[4/5] mb-7 rounded-lg overflow-hidden ring-1 ring-dawn-haze/15 bg-black/30">
                <img
                  src={vow.card.illustration}
                  alt={vow.card.title}
                  width={768}
                  height={1152}
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-dawn-rose mb-2">
                Your vow card · drawn once
              </p>
              <p className="text-sm italic font-serif opacity-60 leading-relaxed">{vow.card.opener}</p>
              <h2 className="mt-2 text-3xl font-serif font-light tracking-tight text-balance">
                {vow.card.title}
              </h2>
              <div className="mt-4 space-y-3 max-w-[46ch]">
                {vow.card.message.split(/\n{2,}/).map((p, i) => (
                  <p key={i} className="text-dawn-ink/75 leading-relaxed text-[15px]">{p}</p>
                ))}
              </div>
              {vow.card.reflection && (
                <div className="mt-6 pl-4 border-l-2 border-dawn-rose/40">
                  <p className="text-[15px] font-serif italic text-dawn-ink/85 leading-relaxed">
                    {vow.card.reflection}
                  </p>
                </div>
              )}
              <button
                onClick={() => onCreated(vow)}
                className="mt-8 w-full py-4 bg-dawn-rose text-dawn-sky text-sm uppercase tracking-[0.2em] font-bold rounded-full hover:bg-dawn-haze transition-colors"
              >
                Begin the count — Day 1
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

export function VowPanel({ vow, onEnded }: { vow: Vow; onEnded: () => void }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<PanelMode>("idle");
  const [nightText, setNightText] = useState("");
  const [nightCtx, setNightCtx] = useState<DarkNightContext | null>(null);
  const [outcome, setOutcome] = useState<"fulfilled" | "released">("fulfilled");
  const [note, setNote] = useState("");
  const [closeResult, setCloseResult] = useState<CloseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // After logging a night the vow prop is stale; the context carries the truth.
  const nights = nightCtx ? nightCtx.nightNumber : vow.darkNights.length;

  const submitNight = async () => {
    if (busy || !nightText.trim()) return;
    setBusy(true);
    try {
      const out = await logDarkNight(nightText.trim());
      if (!out) return;
      if (out.kind === "crisis") {
        navigate({ to: "/support" });
        return;
      }
      setNightCtx(out.context);
      setNightText("");
      setMode("nightDone");
    } finally {
      setBusy(false);
    }
  };

  const submitClose = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await closeVow(outcome, note.trim());
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
          <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-dawn-rose">
            {k.status === "fulfilled" ? "It came true" : "Released with honor"}
          </p>
          <h2 className="mt-2 text-3xl font-serif font-light tracking-tight">
            {k.daysHeld} days held
          </h2>
          <p className="mt-3 text-sm text-dawn-ink/70 leading-relaxed max-w-[38ch] mx-auto">
            {k.status === "fulfilled"
              ? `You held on through ${k.darkNights} hard night${k.darkNights === 1 ? "" : "s"}, and the thing you hoped for arrived. ${k.cardTitle} kept its watch.`
              : `The hoped-for thing didn't come — but ${k.daysHeld} days of staying did. That was never the card's doing. It was yours.`}
          </p>
          {closeResult.letter && (
            <div className="mt-6 p-5 bg-dawn-sky/60 border border-dawn-rose/30 rounded-2xl text-left">
              <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-dawn-rose mb-2">
                The letter to {closeResult.letter.to} is unsealed
              </p>
              <p className="font-serif italic text-[15px] leading-relaxed text-dawn-ink/85">
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
                  className="mt-4 px-6 py-2.5 bg-dawn-rose text-dawn-sky text-[10px] uppercase tracking-[0.18em] font-bold rounded-full hover:bg-dawn-haze transition-colors"
                >
                  {copied ? "Link copied" : `Copy the letter link for ${closeResult.letter.to}`}
                </button>
              )}
              <p className="mt-3 text-[11px] text-dawn-ink/50 leading-relaxed">
                You decide when and how it reaches them. The app never sends anything itself.
              </p>
            </div>
          )}
          {closeResult.letterBurned && (
            <p className="mt-5 text-[13px] font-serif italic text-dawn-ink/60 leading-relaxed">
              The letter burned unread. Only you know how many days you stood.
            </p>
          )}
          {closeResult.url && (
            <button
              onClick={copyUrl}
              className="mt-6 px-8 py-3.5 bg-dawn-rose text-dawn-sky text-[11px] uppercase tracking-[0.2em] font-bold rounded-full hover:bg-dawn-haze transition-colors"
            >
              {copied ? "Link copied" : "Share the keepsake"}
            </button>
          )}
          <button
            onClick={onEnded}
            className="mt-4 block mx-auto text-[11px] uppercase tracking-[0.18em] text-dawn-ink/45 hover:text-dawn-ink/75 transition-colors"
          >
            When you're ready — a new vow
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
          className="absolute -inset-8 -z-10 rounded-[3rem] blur-3xl animate-halo opacity-60"
          style={{
            background:
              "radial-gradient(60% 55% at 50% 40%, rgba(245,207,138,0.4) 0%, rgba(244,163,122,0.22) 40%, transparent 75%)",
          }}
        />
        <div className="relative rounded-2xl border border-dawn-haze/15 bg-dawn-surface/80 backdrop-blur-xl overflow-hidden">
          {/* Header row: the standing vow */}
          <div className="flex items-center gap-4 p-5">
            <div className="size-16 rounded-lg overflow-hidden ring-1 ring-dawn-haze/15 shrink-0 bg-black/30">
              <img
                src={vow.card.illustration}
                alt={vow.card.title}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] uppercase tracking-[0.2em] font-medium text-dawn-rose">
                Your vow · day {vow.dayNumber}
              </p>
              <h2 className="font-serif text-xl font-light tracking-tight truncate">
                {vow.card.title}
              </h2>
              <p className="text-[11px] text-dawn-ink/50 truncate italic">“{vow.hope}”</p>
            </div>
            <div className="text-right shrink-0">
              <span className="block text-2xl font-serif italic text-dawn-haze">
                {String(vow.dayNumber).padStart(2, "0")}
              </span>
              <span className="text-[8px] uppercase tracking-widest opacity-40">
                day{vow.dayNumber === 1 ? "" : "s"} held
              </span>
            </div>
          </div>

          {vow.letter?.sealed && (
            <p className="px-5 -mt-2 pb-1 text-[10px] uppercase tracking-[0.18em] text-dawn-rose/70">
              ✉ A letter to {vow.letter.initial}. — sealed
            </p>
          )}

          {mode === "reading" && (
            <div className="px-5 pb-5 animate-card-rise">
              <div className="pt-4 border-t border-dawn-haze/10 space-y-3">
                <p className="text-sm italic font-serif opacity-60">{vow.card.opener}</p>
                {vow.card.message.split(/\n{2,}/).map((p, i) => (
                  <p key={i} className="text-dawn-ink/75 leading-relaxed text-[14px]">{p}</p>
                ))}
                {vow.card.reflection && (
                  <p className="pl-3 border-l-2 border-dawn-rose/40 text-[14px] font-serif italic text-dawn-ink/85">
                    {vow.card.reflection}
                  </p>
                )}
                <p className="text-[10px] uppercase tracking-[0.18em] opacity-40 pt-1">
                  Enduring: <span className="normal-case italic opacity-90">“{vow.enduring}”</span>
                </p>
              </div>
            </div>
          )}

          {mode === "night" && (
            <div className="px-5 pb-5 animate-card-rise">
              <div className="pt-4 border-t border-dawn-haze/10">
                <p className="text-[10px] uppercase tracking-[0.18em] font-medium opacity-50 mb-3">
                  A hard night · say it in one line
                </p>
                <textarea
                  autoFocus
                  value={nightText}
                  onChange={(e) => setNightText(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="I don't know if I can keep doing this…"
                  className="w-full bg-dawn-sky/60 text-dawn-ink placeholder:text-dawn-ink/30 border border-dawn-haze/15 rounded-xl p-4 text-sm focus:outline-none focus:ring-1 ring-dawn-rose/30 resize-none"
                />
                <div className="mt-3 flex items-center gap-4">
                  <button
                    onClick={submitNight}
                    disabled={busy || !nightText.trim()}
                    className="px-6 py-2.5 bg-dawn-rose text-dawn-sky text-[10px] uppercase tracking-[0.18em] font-bold rounded-full hover:bg-dawn-haze transition-colors disabled:opacity-40"
                  >
                    Write it down
                  </button>
                  <button
                    onClick={() => setMode("idle")}
                    className="text-[10px] uppercase tracking-[0.18em] opacity-50 hover:opacity-80"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {mode === "nightDone" && nightCtx && (
            <div className="px-5 pb-5 animate-card-rise">
              <div className="pt-4 border-t border-dawn-haze/10">
                <p className="text-[10px] uppercase tracking-[0.18em] font-medium text-dawn-rose mb-2">
                  Witnessed
                </p>
                <p className="font-serif italic text-[15px] leading-relaxed text-dawn-ink/85">
                  {nightCtx.line}
                </p>
              </div>
            </div>
          )}

          {mode === "closing" && (
            <div className="px-5 pb-5 animate-card-rise">
              <div className="pt-4 border-t border-dawn-haze/10">
                <p className="text-[10px] uppercase tracking-[0.18em] font-medium opacity-50 mb-3">
                  {outcome === "fulfilled" ? "It came true — tell the ending" : "Let it go — with honor"}
                </p>
                <p className="text-[12px] text-dawn-ink/55 leading-relaxed mb-3">
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
                  className="w-full bg-dawn-sky/60 text-dawn-ink placeholder:text-dawn-ink/30 border border-dawn-haze/15 rounded-xl p-4 text-sm focus:outline-none focus:ring-1 ring-dawn-rose/30 resize-none"
                />
                <div className="mt-3 flex items-center gap-4">
                  <button
                    onClick={submitClose}
                    disabled={busy}
                    className="px-6 py-2.5 bg-dawn-rose text-dawn-sky text-[10px] uppercase tracking-[0.18em] font-bold rounded-full hover:bg-dawn-haze transition-colors disabled:opacity-40"
                  >
                    {outcome === "fulfilled" ? "Seal it — fulfilled" : "Release it"}
                  </button>
                  <button
                    onClick={() => setMode("idle")}
                    className="text-[10px] uppercase tracking-[0.18em] opacity-50 hover:opacity-80"
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
              className="text-[10px] uppercase tracking-[0.18em] font-medium px-4 py-2 rounded-full border border-dawn-haze/20 text-dawn-ink/80 hover:bg-dawn-haze/10 transition-colors"
            >
              {mode === "reading" ? "Fold the card" : "Read the vow"}
            </button>
            <button
              onClick={() => setMode("night")}
              className="text-[10px] uppercase tracking-[0.18em] font-medium px-4 py-2 rounded-full border border-dawn-haze/20 text-dawn-ink/80 hover:bg-dawn-haze/10 transition-colors"
            >
              A hard night{nights > 0 ? ` · ${nights}` : ""}
            </button>
            <button
              onClick={() => {
                setOutcome("fulfilled");
                setMode("closing");
              }}
              className="text-[10px] uppercase tracking-[0.18em] font-bold px-4 py-2 rounded-full bg-dawn-rose/15 border border-dawn-rose/30 text-dawn-rose hover:bg-dawn-rose/25 transition-colors"
            >
              It came true
            </button>
            <button
              onClick={() => {
                setOutcome("released");
                setMode("closing");
              }}
              className="text-[10px] uppercase tracking-[0.18em] font-medium px-4 py-2 rounded-full text-dawn-ink/40 hover:text-dawn-ink/70 transition-colors"
            >
              Let it go
            </button>
          </div>
        </div>
      </article>
    </section>
  );
}
