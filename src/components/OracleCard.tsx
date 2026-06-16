import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ART, type OracleCard as OracleCardT, saveCard, isSaved, removeSaved, askOracle, encodeShare } from "@/lib/dawnhalo";

type Props = {
  card: OracleCardT;
  onDrawAgain?: () => void;
  readOnly?: boolean;
  showCanDraw?: boolean;
};

export function OracleCardView({ card, onDrawAgain, readOnly, showCanDraw = true }: Props) {
  const [saved, setSaved] = useState<boolean>(() => isSaved(card.id));
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
      <div className="absolute -inset-6 bg-dawn-haze/30 blur-3xl rounded-[3rem] animate-halo -z-10" aria-hidden />
      <div className="relative bg-white border border-dawn-ink/5 rounded-2xl p-7 sm:p-8 shadow-[0_30px_60px_-30px_rgba(45,42,46,0.18)]">
        <div className="w-full aspect-[4/5] mb-7 rounded-lg overflow-hidden ring-1 ring-dawn-ink/5 bg-stone-50">
          <img src={ART[card.art]} alt={card.title} width={800} height={1000} className="h-full w-full object-cover" loading="lazy" />
        </div>

        <p className="text-sm italic font-serif opacity-60 leading-relaxed text-pretty">{card.opener}</p>
        <h2 className="mt-3 text-3xl font-serif font-light tracking-tight text-balance">{card.title}</h2>
        <p className="mt-4 text-dawn-ink/80 leading-relaxed text-[15px] text-pretty max-w-[46ch]">{card.message}</p>

        {!readOnly && (
          <div className="mt-7 pt-6 border-t border-dawn-ink/5 flex flex-wrap gap-2">
            <button onClick={toggleSave}
              className={"text-[10px] uppercase tracking-[0.18em] font-bold px-4 py-2 rounded-full transition-colors " +
                (saved ? "bg-dawn-rose text-white" : "bg-dawn-ink text-white hover:bg-dawn-ink/90")}>
              {saved ? "Collected" : "Collect"}
            </button>
            {showCanDraw && onDrawAgain && (
              <button onClick={onDrawAgain}
                className="text-[10px] uppercase tracking-[0.18em] font-medium px-4 py-2 border border-dawn-ink/10 rounded-full hover:bg-dawn-glow transition-colors">
                Draw another
              </button>
            )}
            {!followUpUsed && (
              <button onClick={() => document.getElementById(`fu-${card.id}`)?.focus()}
                className="text-[10px] uppercase tracking-[0.18em] font-medium px-4 py-2 border border-dawn-ink/10 rounded-full hover:bg-dawn-glow transition-colors">
                One follow-up
              </button>
            )}
            <button onClick={() => setSparkOpen((s) => !s)}
              className="text-[10px] uppercase tracking-[0.18em] font-medium px-4 py-2 border border-dawn-ink/10 rounded-full hover:bg-dawn-glow transition-colors">
              Send a Spark
            </button>
          </div>
        )}
        {readOnly && (
          <div className="mt-7 pt-6 border-t border-dawn-ink/5">
            <button onClick={() => setSparkOpen((s) => !s)}
              className="text-[10px] uppercase tracking-[0.18em] font-medium px-4 py-2 border border-dawn-ink/10 rounded-full hover:bg-dawn-glow transition-colors">
              Send a Spark
            </button>
          </div>
        )}

        {sparkOpen && (
          <div className="mt-5 p-4 bg-dawn-glow/60 border border-dawn-haze/20 rounded-xl space-y-3">
            <label className="block text-[10px] uppercase tracking-[0.18em] font-medium opacity-60">Add a note (optional)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} rows={2}
              placeholder="Saw this and thought of you. Take a breath. xx"
              className="w-full bg-white border border-dawn-ink/5 rounded-lg p-3 text-sm focus:outline-none focus:ring-1 ring-dawn-rose/20 resize-none" />
            <div className="flex items-center gap-3">
              <button onClick={doShare}
                className="text-[10px] uppercase tracking-[0.18em] font-bold px-4 py-2 bg-dawn-ink text-white rounded-full hover:bg-dawn-ink/90">
                {copied ? "Link copied" : "Share"}
              </button>
              <button onClick={() => setSparkOpen(false)} className="text-[10px] uppercase tracking-[0.18em] opacity-50">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {!readOnly && !followUpUsed && (
        <form onSubmit={submitFollowUp} className="mt-6 relative">
          <label className="block text-[10px] uppercase tracking-[0.18em] font-medium opacity-50 mb-2 ml-1">One follow-up</label>
          <input id={`fu-${card.id}`} value={followUp} onChange={(e) => setFollowUp(e.target.value)}
            placeholder="Anything you want to ask this card…"
            className="w-full bg-white border border-dawn-ink/5 rounded-xl px-5 py-4 pr-24 text-sm focus:outline-none focus:ring-1 ring-dawn-rose/20" />
          <button type="submit"
            className="absolute right-2 top-[34px] text-[10px] uppercase tracking-[0.18em] font-bold px-3 py-2 bg-dawn-ink text-white rounded-full">
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
