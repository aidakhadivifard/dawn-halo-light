// The card, as an object.
//
// It has a back, a front, a thin gold frame and a weight to it, because the
// moment it turns over is the one moment in the app that is supposed to feel
// like something happening TO you rather than something you typed. A title and
// a line on a page is not that; a card is.
//
// The deck is fixed. The same twelve cards, the same twelve symbols, drawn the
// same way every time — a card you could recognise again is a card worth
// keeping. Only the reading underneath it is written for the person.
//
// No hand anywhere near this. The witness's hand belongs to the notebook,
// where he writes; here there is only the card.

import { CardSymbol } from "@/components/CardSymbol";

/** Paper, faintly. Enough that the ivory reads as a surface, not a fill. */
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>" +
  "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/>" +
  "<feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.7 0'/></filter>" +
  "<rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

function Surface({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={
        "absolute inset-0 rounded-[18px] bg-wish-white overflow-hidden " +
        "shadow-[0_18px_40px_-24px_rgba(61,41,71,0.45)] " +
        className
      }
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.055] mix-blend-multiply"
        style={{ backgroundImage: GRAIN }}
      />
      {children}
    </div>
  );
}

/** The frame, drawn on rather than simply appearing. */
function Frame({ drawOn }: { drawOn?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 300"
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full text-wish-gold"
      fill="none"
    >
      {/* A path, not a <rect>: dashing a path is the one thing every engine
          agrees on, and a frame that stops three quarters of the way round is
          worse than no animation at all. */}
      <path
        d="M19 7 H181 A12 12 0 0 1 193 19 V281 A12 12 0 0 1 181 293 H19 A12 12 0 0 1 7 281 V19 A12 12 0 0 1 19 7 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        pathLength={1}
        style={
          drawOn
            ? { strokeDasharray: 1, strokeDashoffset: 1, animation: "inkin 620ms cubic-bezier(0.4,0,0.2,1) both" }
            : undefined
        }
      />
    </svg>
  );
}

/**
 * The back. One design for the whole deck, so a card face-down is
 * unmistakably a Dawnhalo card: the halo just before the sun clears the line.
 */
export function CardBack({ className = "" }: { className?: string }) {
  return (
    <Surface className={className}>
      <Frame />
      <div className="absolute inset-0 grid place-items-center">
        <svg viewBox="0 0 120 120" className="w-1/2 text-wish-gold" fill="none" stroke="currentColor">
          <circle cx="60" cy="62" r="17" strokeWidth="1.4" />
          <path d="M60 62 m -29 0 a 29 29 0 0 1 58 0" strokeWidth="1" opacity="0.75" />
          <path d="M60 62 m -41 0 a 41 41 0 0 1 82 0" strokeWidth="0.9" opacity="0.45" />
          <path d="M14 62 H106" strokeWidth="1.2" />
        </svg>
      </div>
      {/* The wordmark stays Latin on the back, in both languages: it is a name. */}
      <p
        dir="ltr"
        className="absolute bottom-6 inset-x-0 text-center font-serif text-[11px] tracking-[0.34em] text-wish-gold/80"
      >
        DAWNHALO
      </p>
    </Surface>
  );
}

export interface CardFaceProps {
  id: string;
  name: string;
  line: string;
  /** Run the reveal: frame, then symbol, then title, then line. */
  revealing?: boolean;
  /** Hide the symbol — it has left the card and is flying to the wish. */
  symbolGone?: boolean;
  className?: string;
}

export function CardFace({ id, name, line, revealing, symbolGone, className = "" }: CardFaceProps) {
  // The frame first, so the object exists before anything is written on it.
  const at = (ms: number) =>
    revealing ? { animation: `risein 520ms cubic-bezier(0.19,1,0.22,1) ${ms}ms both` } : undefined;
  return (
    <Surface className={className}>
      <Frame drawOn={revealing} />
      <div className="absolute inset-0 flex flex-col items-center justify-between px-6 py-9 text-center">
        <p
          className="font-serif text-[15px] tracking-[0.22em] uppercase text-wish-ink/85 rtl:tracking-normal rtl:normal-case rtl:text-[19px]"
          style={at(1180)}
        >
          {name}
        </p>
        <div className="flex-1 grid place-items-center w-full">
          <CardSymbol
            id={id}
            title={name}
            drawOn={revealing}
            duration={1100}
            className={
              "w-[58%] text-wish-gold transition-opacity duration-300 " + (symbolGone ? "opacity-0" : "opacity-100")
            }
          />
        </div>
        <p className="font-serif text-[17px] leading-snug text-wish-ink text-balance" style={at(1480)}>
          {line}
        </p>
      </div>
    </Surface>
  );
}

export type CardPhase = "rise" | "hold" | "flip" | "front" | "keeping";

export interface RoadCardObjectProps {
  id: string | null;
  name: string;
  line: string;
  phase: CardPhase;
  symbolGone?: boolean;
}

/**
 * The card itself: rises out of the deck, waits a beat, turns over.
 *
 * It keeps its back to you until the card is actually known, so the turn is
 * never a lie — if the Oracle is slow, the card simply waits face-down a
 * moment longer, which is exactly what a card does.
 */
export function RoadCardObject({ id, name, line, phase, symbolGone }: RoadCardObjectProps) {
  const flipped = phase === "flip" || phase === "front" || phase === "keeping";
  return (
    <div
      className={
        "w-[74%] max-w-[272px] aspect-[2/3] [perspective:1400px] " +
        "animate-[cardrise_900ms_cubic-bezier(0.16,1,0.3,1)_both] " +
        "transition-transform duration-700 ease-out " +
        (phase === "keeping" ? "scale-[0.82]" : "scale-100")
      }
    >
      <div
        className={
          "relative w-full h-full [transform-style:preserve-3d] " +
          "transition-transform duration-[820ms] ease-[cubic-bezier(0.3,0.8,0.25,1)] " +
          (flipped ? "[transform:rotateY(180deg)]" : "")
        }
      >
        <CardBack className="[backface-visibility:hidden]" />
        {id && (
          <CardFace
            id={id}
            name={name}
            line={line}
            revealing={phase === "front" || phase === "keeping"}
            symbolGone={symbolGone}
            className="[backface-visibility:hidden] [transform:rotateY(180deg)]"
          />
        )}
      </div>
    </div>
  );
}
