// The witness's line — his sentence, and his hand still holding the pen at the
// end of it.
//
// One drawing, in oracle gold (#D9A441) with its own alpha, does both
// directions: the hand comes in from the end of the line and the stroke trails
// back under the words that were just written. In Farsi the whole thing is
// mirrored, so the pen finishes on the left and the stroke runs right, under
// where the sentence began.

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
      <img
        src="/witness-hand.png"
        alt=""
        aria-hidden
        draggable={false}
        width={1560}
        height={392}
        className={
          "mt-2 h-auto select-none pointer-events-none rtl:-scale-x-100 " + (big ? "w-72" : "w-52")
        }
      />
    </div>
  );
}
