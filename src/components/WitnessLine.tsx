// The witness's line — one thing, not two.
//
// His sentence, and his hand at the end of it, with the stroke of the pen
// running back underneath the words. In Farsi the whole thing mirrors, so the
// hand enters from the other side and the stroke runs the other way.

import { WitnessHand } from "@/components/WitnessHand";

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
    <div className="relative">
      <p className={"font-hand text-wish-ink leading-tight " + (big ? "text-[30px]" : "text-[25px]")}>{line}</p>
      {deed && (
        <p className={"font-hand text-wish-muted leading-tight mt-0.5 " + (big ? "text-[23px]" : "text-[20px]")}>
          {deed}
        </p>
      )}
      {/* The hand signs at the end of the last line, and the stroke of its pen
          runs back underneath the words — so it sits ON the text, not below it. */}
      <div className={"flex ltr:justify-end rtl:justify-start " + (big ? "-mt-7" : "-mt-6")}>
        <WitnessHand className={"text-wish-gold " + (big ? "w-48" : "w-36")} />
      </div>
    </div>
  );
}
