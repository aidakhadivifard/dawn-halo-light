// ALL static copy for the endurance-goal layer lives in this one reviewed
// file (the Copy Rule requires it). Every line affirms the effort, never the
// outcome: no predictions, no guarantees, no doom, no guilt.
//
// The check-in response ADAPTS to the emotional state:
//   strong    → light acknowledgment only (don't over-celebrate a fine day)
//   barely    → full support: reframed day count + benchmark + ritual
//   cant      → gentlest mode: no benchmark, no pep; honesty check offered
//   exhausted → full support, tiredness named as part of holding on

import type { CheckinState, MilestoneId } from "./keepgoing";

export const ACK: Record<CheckinState, (day: number) => string> = {
  strong: (day) => `Day ${day}. You chose to stay, again.`,
  barely: (day) => `Day ${day} — being tired IS part of holding on.`,
  cant: () => `Today is heavy. You still showed up to say it.`,
  exhausted: (day) => `Day ${day} — empty, and still here. That is not nothing.`,
};

export const HONESTY_OFFER =
  "Want to look at whether this is still worth it? Choosing to stop is a decision, not a failure.";

export const HONESTY_PROMPT = (daysPaid: number) =>
  `You've paid ${daysPaid} more days toward this. Is the reward still worth the price?`;

export const HONESTY_DONE_HEADING = (days: number) =>
  `You held on for ${days} days. Choosing to stop is a decision, not a failure.`;

export const GOAL_COMPLETED_HEADING = (days: number) =>
  `${days} days, start to finish. You did not walk away.`;

export const MILESTONE_MESSAGES: Record<MilestoneId, (day: number) => string> = {
  day3: () => "Day 3. Most people never see this day. You did.",
  day7: () => "Seven days of choosing to stay. Each one was a decision.",
  day30: () => "Thirty days of showing up for the same choice.",
  quarter: (day) => `Day ${day} — a quarter of the road is behind you, every step of it yours.`,
  half: (day) => `Day ${day} — halfway. The days you have paid are real, whatever comes.`,
  three_quarters: (day) =>
    `Day ${day} — three quarters in. You have carried this further than most carry anything.`,
  target: (day) => `Day ${day}. You reached the day you named, and you did not walk away.`,
};

// Deterministic offline reflections for the writing ritual — used when the AI
// is unreachable or its output violates the Copy Rule. Each mirrors the state
// and turns toward the goal as a QUESTION, never a prediction.
export const FALLBACK_REFLECTIONS: Record<CheckinState, (goalTitle: string) => string> = {
  strong: (t) =>
    `A steady day, held in your own hands. What kept "${t}" easy to carry today?`,
  barely: (t) =>
    `You wrote from the thin edge of holding on — and you still wrote. What is applying the most pressure to "${t}" this week?`,
  cant: (t) =>
    `Today asked more than you had, and you said so out loud. If "${t}" could hear you now, what would you want it to know?`,
  exhausted: (t) =>
    `Empty is not the same as gone — you showed up to write this. What would half a day's rest change about how "${t}" feels?`,
};

/** Effort-affirming line shown when no sourced benchmark is available. */
export const EFFORT_LINE = "No statistic today — just the fact of you, still here.";
