// Pure endurance-goal logic: day math, milestones, honesty-check scheduling.
// No DB, no clock — everything is passed in so it's easy to test.
//
// DECISIONS (authoritative, from the KeepGoing brief):
//  - The primary number is DAYS SINCE COMMITMENT (calendar days, inclusive:
//    the day the goal is created is Day 1). Missing a day NEVER resets it.
//  - Streak (consecutive check-in days) is secondary flavor only.
//  - Full celebrations ONLY at: day 3, day 7, day 30, 25% / 50% / 75% of the
//    way to the target date, and the target date itself.
//  - Honesty check every 21 days (day 21, 42, 63…), or early when the last
//    3 consecutive check-in days were "cant" / "exhausted".

export type CheckinState = "strong" | "barely" | "cant" | "exhausted";

export const CHECKIN_STATES: CheckinState[] = ["strong", "barely", "cant", "exhausted"];

export const HONESTY_INTERVAL_DAYS = 21;
export const LOW_STATE_RUN_TRIGGER = 3;

const DAY_MS = 86_400_000;

function utc(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

/** Calendar days since commitment, inclusive — the creation day is Day 1. */
export function daysSince(startDate: string, localDate: string): number {
  return Math.max(1, Math.round((utc(localDate) - utc(startDate)) / DAY_MS) + 1);
}

/** Total calendar length of the goal (start day and target day both count). */
export function totalDays(startDate: string, targetDate: string): number {
  return daysSince(startDate, targetDate);
}

export type MilestoneId =
  | "day3"
  | "day7"
  | "day30"
  | "quarter"
  | "half"
  | "three_quarters"
  | "target";

/**
 * The milestone celebrated on this local day, or null (most days). When a
 * fixed-day and a percentage milestone collide, the later-in-journey label
 * wins — one celebration per day, never two.
 */
export function milestoneFor(
  startDate: string,
  targetDate: string,
  localDate: string,
): MilestoneId | null {
  const day = daysSince(startDate, localDate);
  const total = totalDays(startDate, targetDate);
  if (day >= total) return "target";
  const pct = (p: number) => Math.round(total * p);
  if (day === pct(0.75)) return "three_quarters";
  if (day === pct(0.5)) return "half";
  if (day === pct(0.25)) return "quarter";
  if (day === 30) return "day30";
  if (day === 7) return "day7";
  if (day === 3) return "day3";
  return null;
}

/** Progress toward the target date, clamped to [0, 1]. */
export function progress(startDate: string, targetDate: string, localDate: string): number {
  const total = totalDays(startDate, targetDate);
  if (total <= 1) return 1;
  return Math.min(1, Math.max(0, daysSince(startDate, localDate) / total));
}

/**
 * Length of the run of consecutive CALENDAR days ending on `today` whose
 * check-in state was "cant" or "exhausted". A missed day breaks the run.
 */
export function lowStateRun(
  checkins: { local_date: string; state: string }[],
  today: string,
): number {
  const byDate = new Map(checkins.map((c) => [c.local_date, c.state]));
  let run = 0;
  let cursor = utc(today);
  for (;;) {
    const date = new Date(cursor).toISOString().slice(0, 10);
    const state = byDate.get(date);
    if (state !== "cant" && state !== "exhausted") break;
    run += 1;
    cursor -= DAY_MS;
  }
  return run;
}

/**
 * Whether the honesty check is due today. Scheduled: every 21 days since the
 * last check (or since commitment). Early: three consecutive low-state days
 * with no honesty check inside that run.
 */
export function honestyDue(args: {
  day: number;
  lastHonestyDay: number | null;
  lowRun: number;
}): boolean {
  const anchor = args.lastHonestyDay ?? 0;
  if (args.day >= anchor + HONESTY_INTERVAL_DAYS) return true;
  if (
    args.lowRun >= LOW_STATE_RUN_TRIGGER &&
    (args.lastHonestyDay === null || args.lastHonestyDay <= args.day - args.lowRun)
  ) {
    return true;
  }
  return false;
}
