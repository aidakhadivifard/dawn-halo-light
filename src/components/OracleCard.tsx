import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { askFollowUpEx, type Card } from "@/lib/cards";
import { saveCard, removeSaved, getSaved, createSpark } from "@/lib/store";
import { shareCardAsImage, shareJourneyImage } from "@/lib/shareImage";
import { track } from "@/lib/analytics";

type Props = {
  card: Card;
  onDrawAgain?: () => void;
  onDrawNew?: () => void;
  readOnly?: boolean;
  showCanDraw?: boolean;
  /** Active journey day — makes shares Day-first (spec §8). */
  journeyDay?: number;
};

// One card, one message: no "draw another" here, ever. A second card exists
// only inside the ritual, as a smaller question (spec §2).
export function OracleCardView({ card, readOnly, journeyDay }: Props) {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let alive = true;
    getSaved()
      .then((list) => alive && setSaved(list.some((c) => c.id === card.id)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [card.id]);

  const [followUp, setFollowUp] = useState("");
  const [followUpUsed, setFollowUpUsed] = useState(!!card.followUpUsed);
  // The same card answers in one or two plain sentences — no second card.
  const [followAnswer, setFollowAnswer] = useState<{ question: string; answer: string } | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [sparkOpen, setSparkOpen] = useState(false);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const toggleSave = async () => {
    if (saved) {
      await removeSaved(card.id);
      setSaved(false);
      track("card_unsaved");
    } else {
      await saveCard(card);
      setSaved(true);
      track("card_saved");
    }
  };

  const submitFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUp.trim() || followUpUsed || busy) return;
    setBusy(true);
    const started = Date.now();
    try {
      const out = await askFollowUpEx({ previous: card, text: followUp });
      // A gentle minimum pause so it feels like the card is being read —
      // never jarringly instant, never an artificial wait on top of real latency.
      const elapsed = Date.now() - started;
      if (elapsed < 1000) await new Promise((r) => setTimeout(r, 1000 - elapsed));
      if (out.kind === "crisis") {
        track("support_redirect", { source: "follow_up" });
        navigate({ to: "/support" });
        return;
      }
      if (out.kind === "paywall") {
        track("paywall_hit", { source: "follow_up" });
        navigate({ to: "/paywall" });
        return;
      }
      track("follow_up_asked");
      // Old servers return only a second card; its message is still the answer.
      setFollowAnswer({ question: followUp, answer: out.answer ?? out.card.message });
      setFollowUpUsed(true);
    } finally {
      setBusy(false);
    }
  };

  const doShare = async () => {
    const url = await createSpark(card, note);
    const text = `${card.title} — ${card.message}`;
    if (
      typeof navigator !== "undefined" &&
      (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }).share
    ) {
      try {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
          title: "Dawnhalo",
          text,
          url,
        });
        track("spark_shared", { method: "web_share" });
        return;
      } catch {
        /* fallthrough to copy */
      }
    }
    await navigator.clipboard.writeText(url);
    track("spark_shared", { method: "copy_link" });
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const [imageBusy, setImageBusy] = useState(false);
  const doShareImage = async () => {
    if (imageBusy) return;
    setImageBusy(true);
    try {
      // With a journey: the Day number is the hero of the share, not the card.
      const outcome = journeyDay
        ? await shareJourneyImage({
            day: journeyDay,
            card,
            // The keep-line was written to be carried — it IS the share line.
            line: card.keepLine ?? card.message.split(/\n{2,}/)[0]?.slice(0, 140) ?? card.title,
          })
        : await shareCardAsImage(card);
      track("card_image_shared", { method: outcome, format: journeyDay ? "journey" : "card" });
    } catch {
      /* canvas/share unavailable — quietly do nothing */
    } finally {
      setImageBusy(false);
    }
  };

  const ActionButton = ({
    onClick,
    active,
    children,
  }: {
    onClick: () => void;
    active?: boolean;
    children: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      className={
        "text-[10px] uppercase tracking-[0.18em] font-medium px-5 py-2.5 rounded-full transition-colors " +
        (active
          ? "bg-dawn-rose text-dawn-sky font-bold"
          : "border border-dawn-haze/20 text-dawn-ink/80 hover:bg-dawn-haze/10")
      }
    >
      {children}
    </button>
  );

  return (
    <article className="relative group animate-card-rise">
      <div
        aria-hidden
        className="absolute -inset-12 -z-10 rounded-[3rem] blur-3xl animate-halo opacity-80"
        style={{
          background:
            "radial-gradient(60% 55% at 50% 40%, rgba(245,207,138,0.55) 0%, rgba(244,163,122,0.35) 35%, rgba(189,92,120,0.18) 65%, transparent 80%)",
        }}
      />
      <div className="relative rounded-2xl p-7 sm:p-8 border border-dawn-haze/15 bg-dawn-surface/80 backdrop-blur-xl shadow-[0_40px_120px_-30px_rgba(245,180,120,0.35),inset_0_1px_0_rgba(255,220,180,0.08)]">
        {/* The reveal flip is the ritual — a slow, tactile second. */}
        <div className="w-full aspect-[4/5] mb-7 rounded-lg overflow-hidden ring-1 ring-dawn-haze/15 bg-black/30 animate-card-flip">
          <img src={card.illustration} alt={card.title} width={768} height={1152} className="h-full w-full object-cover" loading="lazy" />
        </div>

        <p className="text-sm italic font-serif opacity-60 leading-relaxed text-pretty">{card.opener}</p>
        <h2 className="mt-3 text-3xl font-serif font-light tracking-tight text-balance text-dawn-ink">{card.title}</h2>

        <div className="animate-message-unfold">
          <div className="mt-4 space-y-3 max-w-[46ch]">
            {card.message.split(/\n{2,}/).map((para, i) => (
              <p key={i} className="text-dawn-ink/75 leading-relaxed text-[15px] text-pretty">{para}</p>
            ))}
          </div>

          {/* The keep-line: the reading's pocketable claim — bold, quotable,
              the line that goes with them (and onto the share image). */}
          {card.keepLine && (
            <p className="mt-6 text-[17px] font-serif font-medium text-dawn-ink text-balance">
              {card.keepLine}
            </p>
          )}

          {card.reflection && (
            <div className="mt-6 pl-4 border-l-2 border-dawn-rose/40">
              <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-dawn-rose/70 mb-1.5">Reflection</p>
              <p className="text-[15px] font-serif italic text-dawn-ink/85 leading-relaxed text-pretty max-w-[44ch]">{card.reflection}</p>
            </div>
          )}
        </div>

        {/* One primary action; Save/Share stay visible — two quiet buttons
            behind a "More" tap bought nothing and buried the growth loop. */}
        {!readOnly && (
          <div className="mt-7 pt-6 border-t border-dawn-haze/10">
            {!followUpUsed && !askOpen && (
              <button
                onClick={() => setAskOpen(true)}
                className="w-full py-3.5 bg-dawn-rose/15 border border-dawn-rose/30 text-dawn-rose text-xs uppercase tracking-[0.2em] font-bold rounded-full hover:bg-dawn-rose/25 transition-colors"
              >
                Ask one more thing
              </button>
            )}
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <ActionButton onClick={toggleSave} active={saved}>
                {saved ? "Saved" : "Save"}
              </ActionButton>
              <ActionButton onClick={() => setSparkOpen((s) => !s)} active={sparkOpen}>
                Share
              </ActionButton>
            </div>
          </div>
        )}
        {readOnly && (
          <div className="mt-7 pt-6 border-t border-dawn-haze/10 flex flex-wrap gap-2">
            <ActionButton onClick={toggleSave} active={saved}>
              {saved ? "Saved" : "Save"}
            </ActionButton>
            <ActionButton onClick={() => setSparkOpen((s) => !s)} active={sparkOpen}>
              Share
            </ActionButton>
          </div>
        )}

        {sparkOpen && (
          <div className="mt-5 p-5 bg-dawn-sky/60 border border-dawn-haze/15 rounded-2xl space-y-4">
            <label className="block text-[10px] uppercase tracking-[0.18em] font-medium opacity-60">Add a note (optional)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} rows={2}
              placeholder="Saw this and thought of you. Take a breath. xx"
              className="w-full bg-dawn-night/60 text-dawn-ink placeholder:text-dawn-ink/25 border border-dawn-haze/15 rounded-xl p-4 text-sm focus:outline-none focus:ring-1 ring-dawn-rose/30 resize-none" />
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={doShare}
                className="text-[10px] uppercase tracking-[0.18em] font-bold px-6 py-2.5 bg-dawn-rose text-dawn-sky rounded-full hover:bg-dawn-haze transition-colors">
                {copied ? "Link copied" : "Share link"}
              </button>
              <button onClick={doShareImage} disabled={imageBusy}
                className="text-[10px] uppercase tracking-[0.18em] font-bold px-6 py-2.5 border border-dawn-rose/40 text-dawn-rose rounded-full hover:bg-dawn-rose/10 transition-colors disabled:opacity-50">
                {imageBusy ? "Preparing…" : "Save as image"}
              </button>
              <button onClick={() => setSparkOpen(false)} className="text-[10px] uppercase tracking-[0.18em] opacity-50 hover:opacity-80 transition-opacity">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {!readOnly && !followUpUsed && busy && (
        <div className="mt-6 flex flex-col items-center text-center py-8">
          <div className="relative w-20 h-20 mb-4">
            <div
              aria-hidden
              className="absolute inset-0 rounded-full blur-2xl animate-halo-breathe"
              style={{ background: "radial-gradient(circle, rgba(245,207,138,0.6) 0%, rgba(244,163,122,0.3) 45%, transparent 70%)" }}
            />
          </div>
          <p className="font-serif italic text-dawn-haze/80 text-sm animate-card-rise">Reading your card…</p>
        </div>
      )}

      {!readOnly && !followUpUsed && !busy && askOpen && (
        <form onSubmit={submitFollowUp} className="mt-6 animate-card-rise">
          <div className="relative">
            <input autoFocus id={`fu-${card.id}`} value={followUp} onChange={(e) => setFollowUp(e.target.value)}
              placeholder="Ask the card one more thing…"
              className="w-full bg-dawn-surface/70 text-dawn-ink placeholder:text-dawn-ink/30 border border-dawn-haze/15 rounded-xl px-5 py-4 pr-24 text-sm focus:outline-none focus:ring-1 ring-dawn-rose/30" />
            <button type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-[0.18em] font-bold px-4 py-2 bg-dawn-rose text-dawn-sky rounded-full hover:bg-dawn-haze transition-colors">
              Ask
            </button>
          </div>
        </form>
      )}

      {/* The same card answers — a continuation of the reading, not a second
          card ceremony. Plain speech; the atmosphere already happened above. */}
      {followAnswer && (
        <div className="mt-6 pl-4 border-l-2 border-dawn-haze/25 animate-card-rise">
          <p className="text-[10px] uppercase tracking-[0.18em] font-medium opacity-45 mb-1.5">
            You asked: {followAnswer.question}
          </p>
          <p className="text-[15px] text-dawn-ink/85 leading-relaxed text-pretty max-w-[44ch]">
            {followAnswer.answer}
          </p>
        </div>
      )}
    </article>
  );
}
