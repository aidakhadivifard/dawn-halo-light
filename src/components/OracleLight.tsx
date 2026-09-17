// The Oracle's light.
//
// The Oracle is never drawn — no face, no figure, no eye. It is a light. When
// a card is asked for, the light gathers where the card is about to be; the
// card comes up out of it, face down; when the card turns, the light answers
// with one bright breath and then settles behind the card like the last of a
// sunrise. Every part of the draw happens inside this light, which is what
// makes it feel like something arriving rather than something loading.
//
// Four moods, and they follow one another in the draw:
//   gather — the light is coming (two seconds and a bit, before the card)
//   hold   — the card is up, face down, and the light breathes under it
//   flash  — the card turns; the light answers
//   soft   — the card is face up; the light stays, quietly, behind it

export type LightMode = "gather" | "hold" | "flash" | "soft";

/** Where the dust sits, as fractions of the light's box. Fixed, so it never jitters. */
const MOTES: { x: number; y: number; d: number; s: number }[] = [
  { x: 0.28, y: 0.62, d: 0, s: 4 },
  { x: 0.72, y: 0.7, d: 420, s: 3 },
  { x: 0.5, y: 0.82, d: 900, s: 5 },
  { x: 0.36, y: 0.48, d: 1300, s: 3 },
  { x: 0.64, y: 0.44, d: 1750, s: 4 },
  { x: 0.2, y: 0.78, d: 2200, s: 3 },
  { x: 0.8, y: 0.56, d: 2600, s: 4 },
  { x: 0.44, y: 0.3, d: 3000, s: 3 },
  { x: 0.58, y: 0.9, d: 3400, s: 4 },
];

export function OracleLight({ mode }: { mode: LightMode }) {
  const glow =
    mode === "gather"
      ? "summon 2300ms cubic-bezier(0.2, 0.7, 0.2, 1) both"
      : mode === "hold"
        ? "halo-breathe 1.7s ease-in-out infinite"
        : mode === "flash"
          ? "flash 900ms cubic-bezier(0.2, 0.7, 0.2, 1) both"
          : undefined;
  const motes = mode !== "soft";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center overflow-visible">
      {/* The wide light. */}
      <span
        className="absolute w-[24rem] h-[24rem] rounded-full blur-3xl transition-opacity duration-1000"
        style={{
          background: "radial-gradient(circle, rgba(217,164,65,0.55) 0%, rgba(217,164,65,0.18) 45%, transparent 72%)",
          animation: glow,
          opacity: mode === "soft" ? 0.38 : undefined,
        }}
      />
      {/* The heart of it — small, bright, a little warmer. */}
      <span
        className="absolute w-28 h-28 rounded-full blur-xl transition-opacity duration-1000"
        style={{
          background: "radial-gradient(circle, rgba(255,222,150,0.9) 0%, rgba(217,164,65,0.35) 55%, transparent 75%)",
          animation:
            mode === "gather"
              ? "spark 2300ms cubic-bezier(0.2, 0.7, 0.2, 1) both"
              : mode === "flash"
                ? "flash 900ms ease-out both"
                : undefined,
          opacity: mode === "soft" ? 0.25 : mode === "hold" ? 0.6 : undefined,
        }}
      />
      {/* Rings leaving the light while it gathers, and one more when it answers. */}
      {(mode === "gather" || mode === "flash") &&
        [0, 1, 2].slice(0, mode === "flash" ? 1 : 3).map((i) => (
          <span
            key={`${mode}-${i}`}
            className="absolute w-40 h-40 rounded-full border border-wish-gold/60"
            style={{ animation: `ripple ${mode === "flash" ? 1100 : 1900}ms ease-out ${i * 520}ms both` }}
          />
        ))}
      {/* Dust in the light. */}
      {MOTES.map((m, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-wish-gold transition-opacity duration-1000"
          style={{
            left: `${m.x * 100}%`,
            top: `${m.y * 100}%`,
            width: m.s,
            height: m.s,
            filter: "blur(0.6px)",
            opacity: motes ? undefined : 0,
            animation: motes ? `mote 3600ms ease-out ${m.d}ms infinite` : undefined,
          }}
        />
      ))}
    </div>
  );
}
