// What the app heard, written down.
//
// She wrote four things in one breath. Instead of telling her "I hear four
// wishes: A, B, C and D" and then listing A, B, C and D again as buttons, the
// app writes them down — one after another, in the gold of the witness's
// hand, each word arriving as ink does, and a small glint as each line is
// finished, the way something catches the light the moment it exists.
//
// The written lines ARE the choices. There is nothing to read above them and
// nothing to repeat below; when the last one is down, the app asks which to
// begin with.

import { useEffect, useState } from "react";
import type { HeardWish } from "@/lib/api";

const WORD_MS = 120;
const WORD_IN = 420;
const GAP_MS = 320;

/** How long one line takes to be written, glint included. */
function lineMs(label: string): number {
  return label.split(/\s+/).filter(Boolean).length * WORD_MS + WORD_IN + GAP_MS;
}

function Sparkle({ delay, size, className }: { delay: number; size: number; className: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={"absolute " + className}
      style={{ animation: `twinkle 720ms cubic-bezier(0.2, 0.7, 0.2, 1) ${delay}ms both` }}
    >
      <path
        d="M12 2 C12.6 8, 16 11.4, 22 12 C16 12.6, 12.6 16, 12 22 C11.4 16, 8 12.6, 2 12 C8 11.4, 11.4 8, 12 2 Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** One line being written, with its glint at the end. */
function Written({ text }: { text: string }) {
  const words = text.split(/\s+/).filter(Boolean);
  const doneAt = words.length * WORD_MS + WORD_IN - 160;
  return (
    <span
      className="relative inline"
      style={{ animation: `glint 900ms ease-out ${doneAt}ms both` }}
    >
      {words.map((w, i) => (
        <span key={i}>
          <span className="inline-block" style={{ animation: `wordin ${WORD_IN}ms ease-out ${i * WORD_MS}ms both` }}>
            {w}
          </span>
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
      {/* The glint: two points of light at the end of the line, the moment it is finished. */}
      <span aria-hidden className="relative inline-block w-0 h-0 align-baseline">
        <Sparkle delay={doneAt} size={18} className="-top-[1.15em] ltr:left-1 rtl:right-1 text-wish-gold" />
        <Sparkle delay={doneAt + 180} size={10} className="-top-[0.35em] ltr:left-5 rtl:right-5 text-wish-gold/80" />
      </span>
    </span>
  );
}

export function HeardWishes({
  wishes,
  onPick,
  disabled,
  chosen,
  onWritten,
}: {
  wishes: HeardWish[];
  onPick: (w: HeardWish) => void;
  disabled?: boolean;
  /** The one she pressed: it stays lit while the others step back. */
  chosen?: string | null;
  /** The last line is down; the question may be asked. */
  onWritten?: () => void;
}) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    let alive = true;
    const timers: number[] = [];
    let at = 200;
    wishes.forEach((w, i) => {
      timers.push(window.setTimeout(() => alive && setShown(i + 1), at));
      at += lineMs(w.label);
    });
    timers.push(window.setTimeout(() => alive && onWritten?.(), at - GAP_MS + 200));
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
    // A new hearing is a new writing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wishes]);

  return (
    <ul>
      {wishes.slice(0, shown).map((w) => (
        <li key={w.label}>
          <button
            onClick={() => onPick(w)}
            disabled={disabled}
            className={
              "w-full text-start py-3.5 border-b border-wish-gold/25 font-hand text-[28px] leading-snug text-wish-gold-ink " +
              "transition-opacity duration-500 active:opacity-60 " +
              (chosen ? (chosen === w.label ? "opacity-100 animate-pulse" : "opacity-30") : "disabled:opacity-40")
            }
          >
            <Written text={w.label} />
          </button>
        </li>
      ))}
    </ul>
  );
}
