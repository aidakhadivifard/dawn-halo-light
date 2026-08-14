// The Reading Engine's data payload (spec §3.7): every reading request must
// carry this user's own life — goal, recent check-ins, their own written
// words, the last honesty answer, nearby milestones — so the model can obey
// the Specificity Rule. A reading that could be sent to anyone is a failed
// reading; without this payload no prompt can fix that.

import type { DB } from "../db";
import { daysSince, totalDays, milestoneFor, type CheckinState } from "./keepgoing";

const STATE_LABELS: Record<string, string> = {
  strong: "holding strong",
  barely: "barely holding on",
  cant: "can't do this today",
  exhausted: "exhausted, no willpower left",
};

/**
 * The rules the model must follow for every goal-aware response. Kept with
 * the payload so they always travel together.
 */
export const READING_ENGINE_RULES = `READING ENGINE RULES (non-negotiable):
1. Include at least ONE concrete detail from the reader's data above — their goal wording, a phrase they wrote (quoted sparingly and exactly), a date, a day number. A reading that could be sent to any reader is a failed reading.
2. If they judge themselves harshly, look for counter-evidence in their own history above (check-ins kept, days returned, their own words) and reframe with it: harsh claim → their evidence → redefinition. NEVER invent evidence; if none exists, do not force the reframe.
3. If today's check-in contradicts their recent written words, you may gently name the contradiction ONCE, pointing only at their own words. Never diagnose, never psychoanalyze.
4. Never claim to feel their emotions or know their future. Your intimacy comes from attention, not pretended emotion. Allowed: "I only see what you have written here — but I do see it."
5. Keep it short. Specific beats long. Affirm the effort, never promise the outcome.`;

/**
 * Build the context block for a device's active goal, or undefined when the
 * user has no goal (a brand-new reader may receive a general reading — for
 * that day only).
 */
export function buildReadingContext(
  db: DB,
  deviceId: string,
  localDate: string,
): string | undefined {
  const goals = db.listActiveGoals(deviceId);
  if (goals.length === 0) return undefined;

  // Several roads may be held at once. The reading focuses on the one whose
  // day is heaviest right now (else the newest); the others appear as brief
  // "also holding" lines so the model sees the whole life, not one lane.
  const weight: Record<string, number> = { cant: 3, exhausted: 2, barely: 1, strong: 0 };
  const withToday = goals.map((g) => ({
    g,
    today: db.listCheckins(g.id).find((c) => c.local_date === localDate),
  }));
  const focus = [...withToday].sort(
    (a, b) => (weight[b.today?.state ?? ""] ?? -1) - (weight[a.today?.state ?? ""] ?? -1),
  )[0];
  const goal = focus.today ? focus.g : goals[goals.length - 1];
  const others = withToday.filter((w) => w.g.id !== goal.id);

  const day = daysSince(goal.start_date, localDate);
  const total = totalDays(goal.start_date, goal.target_date);
  const remaining = Math.max(0, total - day);
  const checkins = db.listCheckins(goal.id);
  const today = checkins.find((c) => c.local_date === localDate);
  const last7 = checkins.filter((c) => c.local_date <= localDate).slice(-7);
  const entries = db
    .listRitualEntries(goal.id)
    .filter((e) => e.user_text)
    .slice(-3);
  const notes = checkins.filter((c) => c.note).slice(-3);
  const lastHonesty = db.lastHonesty(goal.id);

  const lines: string[] = [];
  lines.push(`CONTEXT — THIS READER'S OWN LIFE (the house records; use them):`);
  lines.push(
    `Holding on for: "${goal.title}" — the reward: ${goal.reward}. Day ${day} of ${total}; ${remaining} days remain (target ${goal.target_date}). They have returned ${checkins.length} time${checkins.length === 1 ? "" : "s"}.`,
  );
  if (today) {
    lines.push(`Today's check-in: ${STATE_LABELS[today.state] ?? today.state}.`);
  }
  for (const w of others) {
    const d = daysSince(w.g.start_date, localDate);
    lines.push(
      `Also holding: "${w.g.title}" — Day ${d}${
        w.today ? `; today: ${STATE_LABELS[w.today.state] ?? w.today.state}` : ""
      }.`,
    );
  }
  // The reading's weather comes from the READER's day, never from the card:
  // bright by default, gentle only when ANY of their own check-ins says the
  // day is heavy.
  const heavy = withToday.some((w) => w.today && w.today.state !== "strong");
  lines.push(
    heavy
      ? `TONE FOR TODAY: their day is heavy — read gently, warmth over spark. Consolation is allowed today.`
      : `TONE FOR TODAY: an ordinary or strong day — read with morning energy, forward and vivid, taking a side. No consolation today; hand them something worth carrying.`,
  );
  if (last7.length > 0) {
    lines.push(
      `Recent check-ins: ${last7
        .map((c) => `${c.local_date} ${STATE_LABELS[c.state] ?? c.state}`)
        .join("; ")}.`,
    );
  }
  const written = [
    ...entries.map((e) => ({ date: e.local_date, text: e.user_text! })),
    ...notes.map((c) => ({ date: c.local_date, text: c.note! })),
  ]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-3);
  if (written.length > 0) {
    lines.push(`They recently wrote (their own words — quote sparingly and exactly):`);
    for (const w of written) lines.push(`- "${w.text.slice(0, 200)}" (${w.date})`);
  }
  if (lastHonesty) {
    lines.push(
      `Last honesty check (day ${lastHonesty.day_number}): answered "${lastHonesty.answer}"${lastHonesty.note ? ` — "${lastHonesty.note.slice(0, 120)}"` : ""}.`,
    );
  }
  // A milestone reached today or within the last 3 days carries weight.
  for (let back = 0; back <= 3; back++) {
    const d = new Date(Date.parse(localDate) - back * 86_400_000).toISOString().slice(0, 10);
    if (d < goal.start_date) break;
    const m = milestoneFor(goal.start_date, goal.target_date, d);
    if (m) {
      lines.push(
        back === 0
          ? `Today is a milestone day (${m}).`
          : `A milestone (${m}) was reached ${back} day${back === 1 ? "" : "s"} ago.`,
      );
      break;
    }
  }

  return `\n\n${lines.join("\n")}\n\n${READING_ENGINE_RULES}`;
}

export type { CheckinState };
