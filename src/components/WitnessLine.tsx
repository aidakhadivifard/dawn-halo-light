// The witness's line — his sentence, and the stroke of his pen running out
// from under it.
//
// The hand itself is not here yet: the asset we had did not read as a hand,
// and a wrong hand is worse than none. The stroke alone is honest — it is
// what a pen leaves behind. When the real hand arrives it drops in at the
// end of this stroke, where the pen would be.

export function WitnessLine({
  line,
  deed,
  size = "md",
}: {
  line: string;
  deed?: string | null;
  size?: "md" | "sm";
}) {
  const big = size === "md";
  return (
    <div>
      <p className={"font-hand text-wish-ink leading-tight " + (big ? "text-[30px]" : "text-[25px]")}>{line}</p>
      {deed && (
        <p className={"font-hand text-wish-muted leading-tight mt-0.5 " + (big ? "text-[23px]" : "text-[20px]")}>
          {deed}
        </p>
      )}
      <svg
        aria-hidden
        viewBox="0 0 400 16"
        preserveAspectRatio="none"
        className={"mt-2 text-wish-gold " + (big ? "w-52 h-3.5" : "w-40 h-3")}
        fill="none"
      >
        {/* One unhurried stroke, thinning as it lifts — the way a pen leaves the page. */}
        <path
          d="M2 9 C 80 2, 150 14, 230 7 S 350 3, 396 11"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
