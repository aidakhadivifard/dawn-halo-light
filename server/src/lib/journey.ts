// The Vow (journey) — pure helpers. A vow is one hard thing a person is
// enduring, one hope they named, and ONE card drawn at the start that never
// changes. The app's job from then on is to keep count and bear witness.
//
// Everything here is deterministic and testable: day math on local dates and
// the composed "witness" lines shown when someone logs a dark night.

import type { DarkNightRow, JourneyRow } from "../db";

/** Parse a YYYY-MM-DD local date into a UTC timestamp at midnight. */
function parseLocal(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

/**
 * 1-based day number of the vow: the day the vow was made is Day 1.
 * Robust to the user's clock moving backwards (never below 1).
 */
export function dayNumber(startedLocalDate: string, todayLocalDate: string): number {
  const diff = Math.round((parseLocal(todayLocalDate) - parseLocal(startedLocalDate)) / 86_400_000);
  return Math.max(1, diff + 1);
}

/** Whole days between two local dates (>= 0). */
export function daysBetween(a: string, b: string): number {
  return Math.max(0, Math.round((parseLocal(b) - parseLocal(a)) / 86_400_000));
}

export interface DarkNightContext {
  /** Day of the vow (1-based) on which this dark night was logged. */
  journeyDay: number;
  /** 1-based index of this dark night. */
  nightNumber: number;
  /** Local date of the previous dark night, if any. */
  previousNightDate: string | null;
  /** Days since the previous dark night (null for the first). */
  daysSincePrevious: number | null;
  /** The vow card's title — unchanged since day 1. */
  vowTitle: string;
  /** The composed witness line the UI shows. */
  line: string;
}

/**
 * Compose the deterministic "witness" response to a dark night. No AI: the
 * strength of this moment is that every word of it is verifiably true —
 * it is the person's own history handed back to them.
 *
 * `nights` must be the list of dark nights BEFORE this new one is added.
 */
export function darkNightContext(args: {
  journey: Pick<JourneyRow, "started_local_date" | "card_title">;
  priorNights: Pick<DarkNightRow, "local_date">[];
  todayLocalDate: string;
}): DarkNightContext {
  const { journey, priorNights, todayLocalDate } = args;
  const journeyDay = dayNumber(journey.started_local_date, todayLocalDate);
  const nightNumber = priorNights.length + 1;
  const prev = priorNights.length ? priorNights[priorNights.length - 1] : null;
  const previousNightDate = prev?.local_date ?? null;
  const daysSincePrevious = previousNightDate
    ? daysBetween(previousNightDate, todayLocalDate)
    : null;

  let line: string;
  if (nightNumber === 1) {
    line =
      `Day ${journeyDay} of your vow. This is the first night you've said it out loud — it is written down now. ` +
      `Your card is still ${journey.card_title}. It has not moved.`;
  } else if (daysSincePrevious !== null && daysSincePrevious <= 1) {
    line =
      `Day ${journeyDay}. Night ${nightNumber} — close on the heels of the last one. Nights cluster sometimes; ` +
      `it does not mean the road is gone. ${journey.card_title} is still your card.`;
  } else {
    line =
      `Day ${journeyDay}. This is night ${nightNumber}. The last one was ${daysSincePrevious} days ago — ` +
      `and you came through it. ${journey.card_title} has not moved.`;
  }

  return { journeyDay, nightNumber, previousNightDate, daysSincePrevious, vowTitle: journey.card_title, line };
}

/** The public keepsake shape for a closed (or active, for preview) vow. */
export interface Keepsake {
  status: string; // "active" | "fulfilled" | "released"
  enduring: string;
  hope: string;
  cardTitle: string;
  cardEssence: string;
  theme: string;
  illustrationId: string;
  message: string;
  startedLocalDate: string;
  closedLocalDate: string | null;
  /** Total days held (through closing day, or through `today` while active). */
  daysHeld: number;
  darkNights: number;
  closingNote: string | null;
}

export function toKeepsake(
  journey: JourneyRow,
  darkNightCount: number,
  todayLocalDate: string,
): Keepsake {
  const endDate = journey.closed_local_date ?? todayLocalDate;
  return {
    status: journey.status,
    enduring: journey.enduring,
    hope: journey.hope,
    cardTitle: journey.card_title,
    cardEssence: journey.card_essence,
    theme: journey.theme,
    illustrationId: journey.illustration_id,
    message: journey.message,
    startedLocalDate: journey.started_local_date,
    closedLocalDate: journey.closed_local_date,
    daysHeld: dayNumber(journey.started_local_date, endDate),
    darkNights: darkNightCount,
    closingNote: journey.closing_note,
  };
}
