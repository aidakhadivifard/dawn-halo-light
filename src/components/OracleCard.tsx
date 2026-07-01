import { useEffect, useState } from "react";
import { Share } from "@capacitor/share";
import { saveCard, removeSaved, getSaved } from "@/lib/store";
import type { Card } from "@/lib/cards";

type Props = {
  card: Card;
  onDrawAgain?: () => void;
  onDrawNew?: () => void;
  readOnly?: boolean;
  showCanDraw?: boolean;
};

const ELEMENT_EMOJI: Record<string, string> = {
  Fire: "\u{1F525}",
  Water: "\u{1F30A}",
  Earth: "\u{1F30D}",
  Air: "\u{1F4A8}",
  Spirit: "\u{1F319}",
};

const ROMAN: Record<number, string> = {
  1:"I",2:"II",3:"III",4:"IV",5:"V",6:"VI",7:"VII",8:"VIII",9:"IX",10:"X",
  11:"XI",12:"XII",13:"XIII",14:"XIV",15:"XV",16:"XVI",17:"XVII",18:"XVIII",
  19:"XIX",20:"XX",21:"XXI",22:"XXII",
};

type Depth = 0 | 1 | 2;

export function OracleCardView({ card, onDrawAgain, onDrawNew, readOnly, showCanDraw = true }: Props) {
  const [saved, setSaved] = useState(false);
  const [depth, setDepth] = useState<Depth>(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    getSaved()
      .then((list) => alive && setSaved(list.some((c) => c.id === card.id)))
      .catch(() => {});
    return () => { alive = false; };
  }, [card.id]);

  const toggleSave = async () => {
    if (saved) {
      await removeSaved(card.id);
      setSaved(false);
    } else {
      await saveCard(card);
      setSaved(true);
    }
  };

  const goDeeper = () => {
    if (depth === 0 && card.shadow) setDepth(1);
    else if (depth <= 1 && card.hidden) setDepth(2);
  };

  const canGoDeeper = (depth === 0 && !!card.shadow) || (depth === 1 && !!card.hidden);

  const doShare = async () => {
    const essenceLines = card.message.split(/\n{2,}/).join("\n\n");
    const text = `${card.title}\n\n"${essenceLines}"\n\n— DawnHalo`;
    try {
      await Share.share({ title: card.title, text, dialogTitle: "Share your card" });
    } catch {
      try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  const ActionButton = ({
    onClick,
    active,
    disabled,
    children,
  }: {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        "text-[10px] uppercase tracking-[0.18em] font-medium px-5 py-2.5 rounded-full transition-colors disabled:opacity-30 " +
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

        {(card.element || card.number) && (
          <div className="flex items-center gap-2.5 mb-3">
            {card.element && <span className="text-2xl leading-none">{ELEMENT_EMOJI[card.element] ?? ""}</span>}
            {card.number && <span className="text-sm uppercase tracking-[0.2em] font-semibold text-dawn-ink/50">{ROMAN[card.number] ?? card.number}</span>}
          </div>
        )}
        <p className="text-sm italic font-serif opacity-60 leading-relaxed text-pretty">{card.opener}</p>
        <h2 className="mt-3 text-3xl font-serif font-light tracking-tight text-balance text-dawn-ink">{card.title}</h2>

        <div className="animate-message-unfold">
          <div className="mt-4 space-y-3 max-w-[46ch]">
            {card.message.split(/\n{2,}/).map((para, i) => (
              <p key={i} className="text-dawn-ink/75 leading-relaxed text-[15px] text-pretty">{para}</p>
            ))}
          </div>

          {card.reflection && depth === 0 && (
            <div className="mt-6 pl-4 border-l-2 border-dawn-rose/40">
              <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-dawn-rose/70 mb-1.5">Reflection</p>
              <p className="text-[15px] font-serif italic text-dawn-ink/85 leading-relaxed text-pretty max-w-[44ch]">{card.reflection}</p>
            </div>
          )}

          {depth >= 1 && card.shadow && (
            <div className="mt-6 pt-5 border-t border-dawn-haze/15 animate-message-unfold">
              <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-dawn-ink/40 mb-2">Shadow:</p>
              <div className="space-y-3 max-w-[46ch]">
                {card.shadow.split(/\n{2,}/).map((para, i) => (
                  <p key={`s${i}`} className="text-dawn-ink/65 leading-relaxed text-[15px] italic text-pretty">{para}</p>
                ))}
              </div>
            </div>
          )}

          {depth >= 2 && card.hidden && (
            <div className="mt-6 pt-5 border-t border-dawn-haze/15 animate-message-unfold">
              <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-dawn-rose/60 mb-2">Hidden</p>
              <div className="space-y-3 max-w-[46ch]">
                {card.hidden.split(/\n{2,}/).map((para, i) => (
                  <p key={`h${i}`} className="text-dawn-ink/75 leading-relaxed text-[15px] font-serif text-pretty">{para}</p>
                ))}
              </div>
              {card.reflection && (
                <div className="mt-5 pl-4 border-l-2 border-dawn-rose/40">
                  <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-dawn-rose/70 mb-1.5">Reflection</p>
                  <p className="text-[15px] font-serif italic text-dawn-ink/85 leading-relaxed text-pretty max-w-[44ch]">{card.reflection}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4 buttons: Save, Draw Another, Go Deeper, Share */}
        {!readOnly && (
          <div className="mt-7 pt-6 border-t border-dawn-haze/10 flex flex-wrap gap-2">
            <ActionButton onClick={toggleSave} active={saved}>
              {saved ? "Saved" : "Save"}
            </ActionButton>
            {showCanDraw && onDrawAgain && (
              <ActionButton onClick={onDrawAgain}>Draw another</ActionButton>
            )}
            {canGoDeeper && (
              <ActionButton onClick={goDeeper}>Go deeper</ActionButton>
            )}
            <ActionButton onClick={doShare} active={copied}>
              {copied ? "Copied" : "Share"}
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
            {canGoDeeper && (
              <ActionButton onClick={goDeeper}>Go deeper</ActionButton>
            )}
            <ActionButton onClick={doShare} active={copied}>
              {copied ? "Copied" : "Share"}
            </ActionButton>
          </div>
        )}
      </div>
    </article>
  );
}
