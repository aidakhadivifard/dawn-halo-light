// The witness's line — his sentence, written while you watch.
//
// The words arrive one by one, the way ink does. When the last one is down,
// the pen keeps going: a short gold stroke runs out from the end of the
// sentence, and at the end of that stroke is his hand, still holding the pen.
// Then the hand lifts away and leaves the stroke behind. Only after that does
// her own deed appear underneath, in the plain face — his hand wrote the line;
// it did not write what she did.
//
// The hand is one drawing (public/witness-hand-only.png, gold with its own
// alpha), cropped so the nib is at its lower-left corner. That is what lets
// it be placed exactly at the end of a stroke we draw ourselves — and be
// mirrored for Farsi, where the sentence ends on the left.

import { useEffect, useRef, useState } from "react";

/** The hand drawing, and where the nib is in it (source pixels). */
const HAND_SRC_W = 775;
const HAND_SRC_H = 392;
const NIB_X = 8;
const NIB_Y = 347;

/** One word after another. */
const WORD_MS = 150;
const WORD_IN = 420;

interface Pen {
  /** The stroke, as an SVG path from the end of the last word to the nib. */
  d: string;
  /** Where the stroke ends and the hand holds the pen. */
  nx: number;
  ny: number;
  /** The sentence reached the edge, so the pen swept down to a fresh line. */
  fresh: boolean;
}

export function WitnessLine({
  line,
  deed,
  dir = "ltr",
  size = "md",
  write = false,
  onWritten,
}: {
  line: string;
  deed?: string | null;
  dir?: "ltr" | "rtl";
  size?: "md" | "sm";
  /** Perform the writing. Off in lists, where the lines are already written. */
  write?: boolean;
  /** The hand has lifted; whatever follows the line may appear. */
  onWritten?: () => void;
}) {
  const big = size === "md";
  const rtl = dir === "rtl";
  const boxRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLSpanElement | null>(null);
  const [pen, setPen] = useState<Pen | null>(null);
  const [hand, setHand] = useState<"none" | "in" | "out">("none");
  const [written, setWritten] = useState(!write);
  const words = line.split(/\s+/).filter(Boolean);

  const handW = big ? 100 : 80;
  const scale = handW / HAND_SRC_W;
  const handH = HAND_SRC_H * scale;
  const nibX = NIB_X * scale;
  const nibY = NIB_Y * scale;
  const fontPx = big ? 30 : 25;

  useEffect(() => {
    if (!write) return;
    let alive = true;
    const timers: number[] = [];
    const after = (ms: number, fn: () => void) =>
      timers.push(window.setTimeout(() => alive && fn(), ms));
    const finish = () => {
      setWritten(true);
      onWritten?.();
    };

    const wordsDone = words.length * WORD_MS + WORD_IN;
    after(wordsDone + 60, () => {
      const box = boxRef.current?.getBoundingClientRect();
      const end = endRef.current?.getBoundingClientRect();
      if (!box || !end) return finish();
      // The end of the last word, on its baseline. Everything below is
      // written for a sentence running left to right; `g` mirrors it.
      const g = rtl ? -1 : 1;
      const x = (rtl ? end.left : end.right) - box.left;
      const y = end.bottom - box.top - 1;
      const room = rtl ? x : box.width - x;
      const full = big ? 118 : 92;
      if (room >= 60) {
        // Room enough: the pen runs on from the sentence. The hand may reach
        // past the edge of the text a little; a hand coming in from the
        // margin is what a hand does.
        const l = Math.min(full, room - 14);
        const nx = x + g * l;
        const ny = y + 3;
        const d =
          `M ${x} ${y} C ${x + g * l * 0.25} ${y - 7}, ${x + g * l * 0.5} ${y + 9}, ${x + g * l * 0.72} ${y + 1} ` +
          `S ${x + g * l * 0.88} ${y - 5}, ${nx} ${ny}`;
        return setPen({ d, nx, ny, fresh: false });
      }
      // No room: the pen sweeps down to a fresh line and finishes there, far
      // enough in that the hand has somewhere to be.
      const l = 70;
      const sy = y + fontPx * 1.0;
      const sx = rtl ? Math.max(l + handW * 0.85, x) : Math.min(box.width - l - handW * 0.85, x);
      const nx = sx + g * l;
      const ny = sy + 2;
      const d =
        `M ${x} ${y} C ${x + g * 12} ${y + 16}, ${sx + g * 40} ${sy - 10}, ${sx} ${sy} ` +
        `C ${sx + g * 22} ${sy + 8}, ${sx + g * 46} ${sy - 6}, ${nx} ${ny}`;
      setPen({ d, nx, ny, fresh: true });
    });
    // The stroke draws, the hand arrives at its end, holds, and lifts.
    const strokeAt = wordsDone + 60;
    after(strokeAt + 460, () => setHand("in"));
    after(strokeAt + 460 + 1500, () => setHand("out"));
    after(strokeAt + 460 + 1500 + 620, finish);
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
    // The line is the thing being written; a new line is a new writing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line, write]);

  return (
    <div ref={boxRef} className="relative">
      <p className={"font-hand text-wish-ink leading-tight " + (big ? "text-[30px]" : "text-[25px]")}>
        {write
          ? words.map((w, i) => (
              <span key={i}>
                <span
                  className="inline-block"
                  style={{ animation: `wordin ${WORD_IN}ms ease-out ${i * WORD_MS}ms both` }}
                >
                  {w}
                </span>
                {i < words.length - 1 ? " " : ""}
              </span>
            ))
          : line}
        <span ref={endRef} aria-hidden className="inline-block w-0 h-0" />
      </p>

      {/* Room for the stroke when it had to start on a fresh line. */}
      {pen?.fresh && <div style={{ height: fontPx * 0.9 }} />}

      {pen && (
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 w-full h-full overflow-visible text-wish-gold"
          fill="none"
        >
          <path
            d={pen.d}
            stroke="currentColor"
            strokeWidth={big ? 1.7 : 1.4}
            strokeLinecap="round"
            pathLength={1}
            style={{
              strokeDasharray: 1,
              strokeDashoffset: 1,
              animation: `inkin ${pen.fresh ? 720 : 520}ms cubic-bezier(0.4,0,0.2,1) both`,
            }}
          />
        </svg>
      )}

      {pen && hand !== "none" && (
        <span
          aria-hidden
          className="pointer-events-none absolute block"
          style={{
            width: handW,
            height: handH,
            // The nib sits exactly at the end of the stroke; in Farsi the hand
            // is mirrored, so the nib is at its lower-right corner instead.
            left: rtl ? pen.nx - (handW - nibX) : pen.nx - nibX,
            top: pen.ny - nibY,
            animation: hand === "in" ? "handin 320ms ease-out both" : "handout 620ms ease-in both",
            // The hand lifts away from the sentence — towards the margin it came from.
            ["--lift" as string]: rtl ? "-10px" : "10px",
          }}
        >
          <img
            src="/witness-hand-only.png"
            alt=""
            draggable={false}
            width={HAND_SRC_W}
            height={HAND_SRC_H}
            className="block w-full h-full select-none"
            style={{ transform: rtl ? "scaleX(-1)" : undefined }}
          />
        </span>
      )}

      {deed && written && (
        <p
          className={
            "font-serif text-wish-muted leading-snug mt-1.5 " + (big ? "text-[17px]" : "text-[16px]")
          }
          style={write ? { animation: "risein 620ms cubic-bezier(0.19,1,0.22,1) both" } : undefined}
        >
          {deed}
        </p>
      )}
    </div>
  );
}
