// Streak = consecutive active days ending today (the user's local day).
// Dates are "YYYY-MM-DD" strings so the math is timezone-stable.

export function computeStreak(activeDates: Iterable<string>, today: string): number {
  const set = new Set(activeDates);
  if (set.size === 0) return 0;

  // Today always counts as day 1 if the user has any activity today.
  // If they haven't drawn yet today, we still count from yesterday so
  // the streak isn't broken mid-day.
  let cursor = today;
  if (!set.has(cursor)) cursor = addDays(today, -1);
  if (!set.has(cursor)) return 0;

  let streak = 0;
  while (set.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return Math.max(streak, 1);
}

export function addDays(date: string, delta: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

/** Group draw rows by their local_date for the calendar. */
export function groupByDay<T extends { local_date: string }>(rows: T[]): Record<string, T[]> {
  const map: Record<string, T[]> = {};
  for (const r of rows) (map[r.local_date] ||= []).push(r);
  return map;
}
