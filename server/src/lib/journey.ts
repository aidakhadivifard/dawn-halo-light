// The Vow (journey) — pure helpers. A vow is one hard thing a person is
// enduring, one hope they named, and ONE card drawn at the start that never
// changes. The app's job from then on is to keep count and bear witness.
//
// Everything here is deterministic and testable: day math on local dates and
// the composed "witness" lines shown when someone logs a dark night.

import type { DarkNightRow, JourneyRow, VowStepRow } from "../db";

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
/** First letter of the letter-recipient's name, for the sealed-letter hint. */
export function letterInitial(letterTo: string | null | undefined): string | null {
  const t = (letterTo ?? "").trim();
  return t ? t[0].toUpperCase() : null;
}

// ---------------------------------------------------------------------------
// One Small Step — "Count the staying. Remember the doing. Never count the
// failing." Staying is Day N. Doing is remembered in rare Memory moments.
// Failing is never aggregated, never displayed, never implied.

/** Per-card action language: the vow card shapes the step prompt. */
const CARD_ACTION_PROMPTS: Record<string, string> = {
  "The Long Road": "You do not need to finish the road today. Move one marker.",
  "Winter Roots": "Not all work shows above the ground. What can you tend quietly today?",
  "The Distant Lantern": "You don't need to reach the light today. What takes you one step nearer?",
  "The Waiting Dawn": "The night does not ask for the whole journey. What can you carry until morning?",
  "The Mountain Pass": "No one crosses a pass in a day. What is the next foothold?",
  "The Sleeping Seed": "Growth is quiet at first. What one thing would water it today?",
  "The Far Shore": "The shore is far; the oar is near. One pull.",
  "The Path With No Shortcut": "The whole road is too much to carry today. Carry one piece of it.",
};

export function cardActionPrompt(cardTitle: string): string {
  return CARD_ACTION_PROMPTS[cardTitle] ?? "Is there one thing you can move today?";
}

/**
 * Pace the ask: after two consecutive declines, go quiet for a few days.
 * Silence answered with silence — the prompt must never become a daily
 * confession.
 */
export function shouldAskStep(
  recentOutcomes: { status: string; local_date: string }[],
  todayLocalDate: string,
  quietDays = 3,
): boolean {
  if (recentOutcomes.length < 2) return true;
  const [a, b] = recentOutcomes; // newest first
  if (a.status !== "declined" || b.status !== "declined") return true;
  return daysBetween(a.local_date, todayLocalDate) >= quietDays;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Memory — evidence, not motivation. Deliberately infrequent and
 * unpredictable (roughly one visit in four), so its emotional weight is
 * preserved. The moves count appears ONLY here, wrapped in narrative, never
 * as a persistent stat beside Day N — juxtaposing the two invites the user
 * to compute a completion ratio, which is the failure-counting we refuse.
 */
export function memoryLine(args: {
  journeyId: string;
  todayLocalDate: string;
  startedLocalDate: string;
  moves: Pick<VowStepRow, "text" | "local_date">[];
  nights: Pick<DarkNightRow, "text" | "local_date">[];
}): string | null {
  const { journeyId, todayLocalDate, startedLocalDate, moves, nights } = args;
  const h = hashStr(`${journeyId}::${todayLocalDate}`);
  if (h % 4 !== 0) return null;
  if (!moves.length && !nights.length) return null;

  const day = dayNumber(startedLocalDate, todayLocalDate);
  const variants: string[] = [];

  if (moves.length) {
    variants.push(
      `${day} days with this vow. ${moves.length} time${moves.length === 1 ? "" : "s"}, you chose to move it forward. The days you couldn't did not erase the days you did.`,
    );
    const m = moves[h % moves.length];
    const mDay = dayNumber(startedLocalDate, m.local_date);
    variants.push(
      `On Day ${mDay}, you said you'd ${trimStep(m.text)} — and you did. That is still part of the vow.`,
    );
  }
  if (nights.length) {
    const n = nights[h % nights.length];
    const nDay = dayNumber(startedLocalDate, n.local_date);
    if (dayNumber(n.local_date, todayLocalDate) > 7) {
      variants.push(`You wrote this on Day ${nDay}: “${n.text}” — You didn't need to know.`);
    }
  }
  if (!variants.length) return null;
  return variants[h % variants.length];
}

function trimStep(text: string): string {
  const t = text.trim().replace(/[.!]+$/, "");
  return t.length > 60 ? t.slice(0, 57) + "…" : t.charAt(0).toLowerCase() + t.slice(1);
}

/** The quiet welcome after days away. Never a count of what was missed. */
export function returnLine(
  lastSeenLocalDate: string | null,
  startedLocalDate: string,
  todayLocalDate: string,
  gapDays = 4,
): string | null {
  if (!lastSeenLocalDate) return null;
  if (daysBetween(lastSeenLocalDate, todayLocalDate) < gapDays) return null;
  const day = dayNumber(startedLocalDate, todayLocalDate);
  return `Day ${day}. The silence did not end the vow.`;
}

export function darkNightContext(args: {
  journey: Pick<JourneyRow, "started_local_date" | "card_title"> &
    Partial<Pick<JourneyRow, "letter_to">>;
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

  // The quiet reminder of who this road is for — never the full name.
  const initial = letterInitial(journey.letter_to);
  if (initial) line += ` The letter to ${initial}. is still sealed.`;

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
