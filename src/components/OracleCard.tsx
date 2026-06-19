import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { askFollowUpEx, type Card } from "@/lib/cards";
import { saveCard, removeSaved, getSaved, createSpark } from "@/lib/store";

type Props = {
  card: Card;
  onDrawAgain?: () => void;
  onDrawNew?: () => void;
  readOnly?: boolean;
  showCanDraw?: boolean;
};

export function OracleCardView({ card, onDrawAgain, onDrawNew, readOnly, showCanDraw = true }: Props) {
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
  const [followCard, setFollowCard] = useState<Card | null>(null);
  const [sparkOpen, setSparkOpen] = useState(false);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const toggleSave = async () => {
    if (saved) {
      await removeSaved(card.id);
      setSaved(false);
    } else {
      await saveCard(card);
      setSaved(true);
    }
  };

  const submitFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUp.trim() || followUpUsed || busy) return;
    setBusy(true);
    try {
      const out = await askFollowUpEx({ previous: card, text: followUp });
      if (out.kind === "crisis") {
        navigate({ to: "/support" });
        return;
      }
      if (out.kind === "paywall") {
        navigate({ to: "/paywall" });
        return;
      }
      setFollowCard(out.card);
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
        return;
      } catch {
        /* fallthrough to copy */
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
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
        <div className="w-full aspect-[4/5] mb-7 rounded-lg overflow-hidden ring-1 ring-dawn-haze/15 bg-black/30">
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

          {card.reflection && (
            <div className="mt-6 pl-4 border-l-2 border-dawn-rose/40">
              <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-dawn-rose/70 mb-1.5">Reflection</p>
              <p className="text-[15px] font-serif italic text-dawn-ink/85 leading-relaxed text-pretty max-w-[44ch]">{card.reflection}</p>
            </div>
          )}
        </div>

        {/* Action buttons — single row, wrapping naturally */}
        {!readOnly && (
          <div className="mt-7 pt-6 border-t border-dawn-haze/10 flex flex-wrap gap-2">
            <ActionButton onClick={toggleSave} active={saved}>
              {saved ? "Saved" : "Save"}
            </ActionButton>
            {showCanDraw && onDrawAgain && (
              <ActionButton onClick={onDrawAgain}>Draw another</ActionButton>
            )}
            {!followUpUsed && (
              <ActionButton onClick={() => document.getElementById(`fu-${card.id}`)?.focus()}>
                Ask a follow-up
              </ActionButton>
            )}
            <ActionButton onClick={() => setSparkOpen((s) => !s)} active={sparkOpen}>
              Share
            </ActionButton>
          </div>
        )}
        {readOnly && (
          <div className="mt-7 pt-6 border-t border-dawn-haze/10 flex flex-wrap gap-2">
            <ActionButton onClick={toggleSave} active={saved}>
              {saved ? "Saved" : "Save"}
            </ActionButton>
            {onDrawNew && (
              <ActionButton onClick={onDrawNew}>Draw a new card</ActionButton>
            )}
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
            <div className="flex items-center gap-4">
              <button onClick={doShare}
                className="text-[10px] uppercase tracking-[0.18em] font-bold px-6 py-2.5 bg-dawn-rose text-dawn-sky rounded-full hover:bg-dawn-haze transition-colors">
                {copied ? "Link copied" : "Share"}
              </button>
              <button onClick={() => setSparkOpen(false)} className="text-[10px] uppercase tracking-[0.18em] opacity-50 hover:opacity-80 transition-opacity">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {!readOnly && !followUpUsed && (
        <form onSubmit={submitFollowUp} className="mt-6">
          <label className="block text-[10px] uppercase tracking-[0.18em] font-medium opacity-50 mb-3 ml-1">What would you like to know more about?</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {["My next step", "What I need to hear", "A different perspective"].map((s) => (
              <button key={s} type="button" onClick={() => setFollowUp(s)}
                className={
                  "text-[11px] px-4 py-2 rounded-full border transition-colors " +
                  (followUp === s
                    ? "bg-dawn-rose/15 border-dawn-rose/40 text-dawn-ink"
                    : "border-dawn-haze/20 text-dawn-ink/70 hover:bg-dawn-haze/10")
                }>
                {s}
              </button>
            ))}
          </div>
          <div className="relative">
            <input id={`fu-${card.id}`} value={followUp} onChange={(e) => setFollowUp(e.target.value)}
              placeholder="Something else…"
              className="w-full bg-dawn-surface/70 text-dawn-ink placeholder:text-dawn-ink/30 border border-dawn-haze/15 rounded-xl px-5 py-4 pr-24 text-sm focus:outline-none focus:ring-1 ring-dawn-rose/30" />
            <button type="submit" disabled={busy}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-[0.18em] font-bold px-4 py-2 bg-dawn-rose text-dawn-sky rounded-full hover:bg-dawn-haze transition-colors disabled:opacity-50">
              {busy ? "…" : "Ask"}
            </button>
          </div>
        </form>
      )}

      {followCard && (
        <div className="mt-8">
          <p className="text-[10px] uppercase tracking-[0.18em] font-medium opacity-50 mb-3 ml-1">The card answered</p>
          <OracleCardView card={followCard} readOnly showCanDraw={false} onDrawNew={onDrawAgain} />
        </div>
      )}
    </article>
  );
}
