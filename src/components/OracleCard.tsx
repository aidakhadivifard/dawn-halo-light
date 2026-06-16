import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { artForCard, type OracleCard as OracleCardT, saveCard, isSaved, removeSaved, askOracle, encodeShare } from "@/lib/dawnhalo";

type Props = {
  card: OracleCardT;
  onDrawAgain?: () => void;
  readOnly?: boolean;
  showCanDraw?: boolean;
};

export function OracleCardView({ card, onDrawAgain, readOnly, showCanDraw = true }: Props) {
  // Read from localStorage only after mount to avoid SSR/client hydration mismatch.
  const [saved, setSaved] = useState(false);
  useEffect(() => { setSaved(isSaved(card.id)); }, [card.id]);
  const [followUp, setFollowUp] = useState("");
  const [followUpUsed, setFollowUpUsed] = useState(false);
  const [followCard, setFollowCard] = useState<OracleCardT | null>(null);
  const [sparkOpen, setSparkOpen] = useState(false);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const toggleSave = () => {
    if (saved) { removeSaved(card.id); setSaved(false); }
    else { saveCard(card); setSaved(true); }
  };

  const submitFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUp.trim() || followUpUsed) return;
    const r = askOracle(followUp);
    if (r.kind === "crisis") { navigate({ to: "/support" }); return; }
    setFollowCard(r.card);
    setFollowUpUsed(true);
  };

  const shareUrl = () => {
    const token = encodeShare(card, note);
    return `${window.location.origin}/spark/${token}`;
  };

  const doShare = async () => {
    const url = shareUrl();
    const text = `${card.title} — ${card.message}`;
    if (typeof navigator !== "undefined" && (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }).share) {
      try { await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({ title: "Dawnhalo", text, url }); return; } catch { /* fallthrough */ }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <article className="relative group animate-card-rise">
      {/* Warm sunrise glow behind the card */}
      <div
        aria-hidden
        className="absolute -inset-12 -z-10 rounded-[3rem] blur-3xl animate-halo opacity-80"
        style={{
          background:
            "radial-gradient(60% 55% at 50% 40%, rgba(245,207,138,0.55) 0%, rgba(244,163,122,0.35) 35%, rgba(189,92,120,0.18) 65%, transparent 80%)",
        }}
      />
      <div
        className="relative rounded-2xl p-7 sm:p-8 border border-dawn-haze/15 bg-dawn-surface/80 backdrop-blur-xl shadow-[0_40px_120px_-30px_rgba(245,180,120,0.35),inset_0_1px_0_rgba(255,220,180,0.08)]"
      >
        <div className="w-full aspect-[4/5] mb-7 rounded-lg overflow-hidden ring-1 ring-dawn-haze/15 bg-black/30">
          <img src={artForCard(card)} alt={card.title} width={768} height={1152} className="h-full w-full object-cover" loading="lazy" />
        </div>

        <p className="text-sm italic font-serif opacity-60 leading-relaxed text-pretty">{card.opener}</p>
        <h2 className="mt-3 text-3xl font-serif font-light tracking-tight text-balance text-dawn-ink">{card.title}</h2>
        <p className="mt-4 text-dawn-ink/75 leading-relaxed text-[15px] text-pretty max-w-[46ch]">{card.message}</p>

        {!readOnly && (
          <div className="mt-7 pt-6 border-t border-dawn-haze/10 flex flex-col gap-2">
            <div className="flex gap-2">
              <button onClick={toggleSave}
                className={"text-[10px] uppercase tracking-[0.18em] font-bold px-5 py-2.5 rounded-full transition-colors " +
                  (saved
                    ? "bg-dawn-rose text-dawn-sky"
                    : "bg-dawn-ink text-dawn-sky hover:bg-dawn-cream")}>
                {saved ? "Saved" : "Save"}
              </button>
              {showCanDraw && onDrawAgain && (
                <button onClick={onDrawAgain}
                  className="text-[10px] uppercase tracking-[0.18em] font-medium px-5 py-2.5 border border-dawn-haze/20 text-dawn-ink/80 rounded-full hover:bg-dawn-haze/10 transition-colors">
                  Draw another
                </button>
              )}
            </div>
            <div className="flex gap-2">
              {!followUpUsed && (
                <button onClick={() => document.getElementById(`fu-${card.id}`)?.focus()}
                  className="text-[10px] uppercase tracking-[0.18em] font-medium px-5 py-2.5 border border-dawn-haze/20 text-dawn-ink/80 rounded-full hover:bg-dawn-haze/10 transition-colors">
                  Ask a follow-up
                </button>
              )}
              <button onClick={() => setSparkOpen((s) => !s)}
                className={"text-[10px] uppercase tracking-[0.18em] font-medium px-5 py-2.5 rounded-full transition-colors " +
                  (sparkOpen
                    ? "bg-dawn-haze/15 border border-dawn-haze/30 text-dawn-ink"
                    : "border border-dawn-haze/20 text-dawn-ink/80 hover:bg-dawn-haze/10")}>
                Share
              </button>
            </div>
          </div>
        )}
        {readOnly && (
          <div className="mt-7 pt-6 border-t border-dawn-haze/10">
            <button onClick={() => setSparkOpen((s) => !s)}
              className="text-[10px] uppercase tracking-[0.18em] font-medium px-5 py-2.5 border border-dawn-haze/20 text-dawn-ink/80 rounded-full hover:bg-dawn-haze/10 transition-colors">
              Share
            </button>
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
        <form onSubmit={submitFollowUp} className="mt-6 relative">
          <label className="block text-[10px] uppercase tracking-[0.18em] font-medium opacity-50 mb-2 ml-1">Ask a follow-up</label>
          <input id={`fu-${card.id}`} value={followUp} onChange={(e) => setFollowUp(e.target.value)}
            placeholder="Anything you want to ask this card…"
            className="w-full bg-dawn-surface/70 text-dawn-ink placeholder:text-dawn-ink/30 border border-dawn-haze/15 rounded-xl px-5 py-4 pr-24 text-sm focus:outline-none focus:ring-1 ring-dawn-rose/30" />
          <button type="submit"
            className="absolute right-2 top-[34px] text-[10px] uppercase tracking-[0.18em] font-bold px-4 py-2 bg-dawn-rose text-dawn-sky rounded-full hover:bg-dawn-haze transition-colors">
            Ask
          </button>
        </form>
      )}

      {followCard && (
        <div className="mt-8">
          <p className="text-[10px] uppercase tracking-[0.18em] font-medium opacity-50 mb-3 ml-1">The card answered</p>
          <OracleCardView card={followCard} readOnly showCanDraw={false} />
        </div>
      )}
    </article>
  );
}
