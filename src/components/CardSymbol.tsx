// The deck's twelve symbols, drawn.
//
// Not a font, not a Unicode character, not an emoji. A "#" is a hashtag, not a
// ladder; a ladder has two rails and rungs you could put your foot on. Every
// symbol here is line art in the same weight as the wish drawings, in oracle
// gold, and every one of them can be drawn ON — the stroke arrives as if a pen
// were laying it down, which is the whole moment of the card turning over.
//
// pathLength="1" on every path is what makes that possible: the dash animation
// is the same for a short line and a long curve, so the symbol draws evenly
// however complicated it is.

export type SymbolId =
  | "key" | "bridge" | "ladder" | "lantern" | "boat" | "seed"
  | "compass" | "hammer" | "mountain" | "crown" | "door" | "sun";

/** Each symbol as a list of strokes, laid down in the order a hand would. */
export const STROKES: Record<string, string[]> = {
  // Two rails and five rungs, tall enough that it could never be a hashtag.
  ladder: [
    "M21 59 C 21.8 42, 22.6 24, 23.5 6",
    "M43 59 C 42.4 42, 41.8 24, 41 6",
    "M21.4 50 Q 32 51.3 42.7 49.6",
    "M22 39.5 Q 32 40.7 42.3 39",
    "M22.5 29 Q 32 30.2 41.9 28.5",
    "M23 18.5 Q 32 19.6 41.5 18",
  ],
  // A bow, a shaft, two teeth.
  key: [
    "M32 21 m -9 0 a 9 9 0 1 0 18 0 a 9 9 0 1 0 -18 0",
    "M32 30 C 32 40, 32 50, 32 58",
    "M32 45 L 41 45",
    "M32 52 L 38.5 52",
  ],
  // An arch over water, with its deck and its piers.
  bridge: [
    "M6 31 L 58 31",
    "M12 31 C 17 14, 47 14, 52 31",
    "M22 31 L 22 21.6",
    "M32 31 L 32 18",
    "M42 31 L 42 21.6",
    "M12 31 L 12 47",
    "M52 31 L 52 47",
    "M5 53 C 16 49.5, 25 56, 34 52 S 52 49.5, 59 54",
  ],
  // A bail to carry it by, a cap, a flared glass, and one narrow flame.
  lantern: [
    "M26 12 C 27.5 5.5, 36.5 5.5, 38 12",
    "M21 15 L 43 15",
    "M23.5 15 L 21 43",
    "M40.5 15 L 43 43",
    "M21 43 L 43 43",
    "M21 43 L 18.5 48",
    "M43 43 L 45.5 48",
    "M18.5 48 L 45.5 48",
    "M32 25 C 29.6 29.5, 30 34.5, 32 36.5 C 34 34.5, 34.4 29.5, 32 25",
    "M32 36.5 L 32 39.5",
  ],
  // A hull, a mast, one full sail, and the water under it.
  boat: [
    "M10 42 C 18 55, 46 55, 54 42",
    "M9 43 L 55 43",
    "M32 11 L 32 43",
    "M32 15 C 43 23, 43 34, 32 40",
    "M5 55 C 16 51.5, 25 58, 34 54 S 52 51.5, 59 56",
  ],
  // A seed already opened: two leaves and a stem, growing out of the ground.
  seed: [
    "M32 55 m -7 -8 a 7 9 0 1 0 14 0 a 7 9 0 1 0 -14 0",
    "M32 47 C 32 37, 32 27, 32 15",
    "M32 33 C 24 33, 19.5 27, 19.5 20 C 27 20.5, 32 26, 32 33",
    "M32 26 C 40 26, 44.5 20, 44.5 13 C 37 13.5, 32 19, 32 26",
  ],
  // A ring, a needle, and the four quarters.
  compass: [
    "M32 32 m -23 0 a 23 23 0 1 0 46 0 a 23 23 0 1 0 -46 0",
    "M32 32 L 42 22 L 36 34 Z",
    "M32 32 L 22 42 L 28 30 Z",
    "M32 5.5 L 32 10",
    "M32 54 L 32 58.5",
    "M5.5 32 L 10 32",
    "M54 32 L 58.5 32",
  ],
  // A head with its two bands, and a handle that comes straight out of it.
  hammer: [
    "M19 13 L 45 13 L 45 27 L 19 27 Z",
    "M24.5 13 L 24.5 27",
    "M39.5 13 L 39.5 27",
    "M29.5 27 L 30 57",
    "M34.5 27 L 34 57",
    "M30 57 L 34 57",
  ],
  // Two peaks, the second lower, and snow on the first.
  mountain: [
    "M4 51 L 22 18 L 33 40 L 43 25 L 60 51",
    "M3 51 L 61 51",
    "M16 29.5 C 18.5 28, 19.5 31, 22 29 C 24.5 27.5, 25.5 30.5, 27.5 29",
  ],
  // Three points, three stones, one band.
  crown: [
    "M14 45 L 12 20 L 22 31 L 32 15 L 42 31 L 52 20 L 50 45",
    "M13.5 45 L 50.5 45",
    "M12 20 m -2 0 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0",
    "M32 15 m -2 0 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0",
    "M52 20 m -2 0 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0",
  ],
  // An arched doorway standing slightly open, and its threshold.
  door: [
    "M18 56 L 18 23 C 18 12, 46 12, 46 23 L 46 56",
    "M39 56 L 39 20.5",
    "M35 39 m -1.6 0 a 1.6 1.6 0 1 0 3.2 0 a 1.6 1.6 0 1 0 -3.2 0",
    "M12 56 L 52 56",
  ],
  // Already begun: a disc, and eight rays around it.
  sun: [
    "M32 32 m -13 0 a 13 13 0 1 0 26 0 a 13 13 0 1 0 -26 0",
    "M32 7 L 32 13",
    "M32 51 L 32 57",
    "M7 32 L 13 32",
    "M51 32 L 57 32",
    "M14.4 14.4 L 18.7 18.7",
    "M45.3 45.3 L 49.6 49.6",
    "M49.6 14.4 L 45.3 18.7",
    "M18.7 45.3 L 14.4 49.6",
  ],
};

export function hasSymbol(id: string): boolean {
  return id in STROKES;
}

export interface CardSymbolProps {
  id: string;
  className?: string;
  /**
   * Draw the strokes on, one after another, as if a pen were laying them down.
   * Off by default: a symbol sitting quietly in a list should not perform.
   */
  drawOn?: boolean;
  /** How long the whole drawing takes, ms. */
  duration?: number;
  title?: string;
}

export function CardSymbol({ id, className = "", drawOn, duration = 900, title }: CardSymbolProps) {
  const strokes = STROKES[id];
  if (!strokes) return null;
  // Each stroke starts a little after the one before, so the shape assembles
  // in the order a hand would make it, and still finishes on time.
  const step = strokes.length > 1 ? (duration * 0.45) / (strokes.length - 1) : 0;
  const each = duration - step * (strokes.length - 1);
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {strokes.map((d, i) => (
        <path
          key={i}
          d={d}
          pathLength={1}
          style={
            drawOn
              ? {
                  strokeDasharray: 1,
                  strokeDashoffset: 1,
                  animation: `inkin ${each}ms cubic-bezier(0.33,0,0.2,1) ${i * step}ms both`,
                }
              : undefined
          }
        />
      ))}
    </svg>
  );
}
