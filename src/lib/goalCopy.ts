// ALL static copy for the goal layer's UI lives in this one reviewed file
// (the Copy Rule requires it): affirm the effort, never promise the outcome.
// Inside the app this is ONE concept — "what you're holding on for" — never
// a feature brand.

import type { CheckinState } from "@/lib/api";

export const HOLDING_QUESTION = "How are you holding up today?";

export const STATE_OPTIONS: { id: CheckinState; label: string }[] = [
  { id: "strong", label: "Holding strong" },
  { id: "barely", label: "Barely holding on" },
  { id: "cant", label: "I can't do this" },
  { id: "exhausted", label: "Exhausted — no willpower left" },
];

/** Discovery moment for users without a goal who picked a hard state. */
export const DISCOVERY_LINE = "It sounds like you're holding on for something.";
export const DISCOVERY_CTA = "Want to name it?";
export const DISCOVERY_DISMISS = "Not now";

export const ONBOARDING = {
  titleHeading: "What are you holding on for?",
  titleSub: "Name the one thing. Plain words are enough.",
  titlePlaceholder: "say it in your own words…",
  titleExamples: [
    "stay at this job until my shares vest",
    "fit into it by the wedding",
    "finish my thesis",
  ],
  rewardHeading: "What's waiting for you at the end?",
  rewardSub: "The reward that makes the days worth paying.",
  rewardPlaceholder: "the vested shares — my way out…",
  dateHeading: "Which day does it end?",
  dateSub: "A real date. That's what makes it a promise, not a wish.",
  dateLockNote: "This date locks when you commit — you can close the goal early, you just can't stretch the road.",
  photoButton: "Add a photo of it (optional)",
  photoPrivacy: "It never leaves your phone.",
  ritualHeading: "What helps you keep going?",
  ritualCard: "Pull a card",
  ritualCardSub: "A reading for the day you're in.",
  ritualWriting: "Write it out",
  ritualWritingSub: "Say it plainly; get one honest reflection.",
  checkinHeading: HOLDING_QUESTION,
  checkinSub: "Day 1 starts the moment you answer.",
} as const;

export const HONESTY_OPENING = "Before we continue, let us be honest.";
export const HONESTY_QUESTION = "Is this goal still worth what it is asking from you?";
export const HONESTY_CHANGED = "What has changed since the last time we asked?";

export const HONESTY_OPTIONS = [
  { id: "continue", label: "Yes, clearly" },
  { id: "adjust", label: "Yes — but I need to change how I'm doing it" },
  { id: "thinking", label: "I'm not sure anymore" },
  { id: "done", label: "No — I think it is costing too much" },
] as const;

export const HONESTY_RESPONSES: Record<string, string> = {
  continue: "Then let us continue with open eyes, not blind endurance.",
  adjust: "The goal may still matter even if the current way of reaching it does not.",
  thinking: "Uncertainty is not failure. It is information.",
  done: "Endurance is not always wisdom. Sometimes the honest act is to stop.",
};

// --- Adaptive per-state actions (v3) ---

export const SOFT_TRANSITION = ["Thank you.", "Let us see what today has for you."] as const;

/** One realistic, low-effort action — never a prediction, never pressure. */
export function smallActionFor(goalTitle: string): string {
  const t = goalTitle.toLowerCase();
  if (/\b(weight|fit|dress|corset|gym|run|body)\b/.test(t))
    return "Drink a glass of water and make the next meal ordinary. Today does not need to become a perfect day.";
  if (/\b(job|work|equity|vest|boss|career|company)\b/.test(t))
    return "Do only the next necessary task. You do not have to emotionally solve the entire job today.";
  if (/\b(degree|thesis|study|exam|school|course)\b/.test(t))
    return "Open the work for ten minutes, then decide. Ten minutes is a real day.";
  if (/\b(save|money|debt|leave)\b/.test(t))
    return "Spend nothing extra for the next hour. One ordinary hour counts.";
  return "Make the next hour ordinary — nothing heroic, just the next small thing.";
}

/** Honest, grounded, non-mystical — for "Tell me the truth". */
export const TRUTH_RESPONSE = [
  "Here is what a card cannot tell you: hard days come in two kinds.",
  "One kind is the ordinary cost of a goal that still matters — tiredness, doubt, a bad week. That kind passes, and staying through it is simply the price you already agreed to pay.",
  "The other kind is a goal that has quietly stopped being yours — or a situation that is not safe to endure. That kind does not pass; it repeats.",
  "You are the only one who can tell which this is. If you are not sure, the honesty check below is the honest way to look at it — not one more push.",
] as const;

export const CANT_RESPONSE = [
  "I hear you.",
  "You do not have to make a permanent decision in the hardest moment of the day.",
] as const;

export const EXHAUSTED_LEAD = ["You do not need more pressure today.", "Let us make the next step smaller."] as const;

/** Contextual prompts for the second (ritual) card. */
export const RITUAL_CARD_PROMPTS = [
  "What do I need today?",
  "What am I not seeing?",
  "What should I release?",
  "What is the smallest next step?",
] as const;

/** Writing prompts, matched to the check-in state. */
export const WRITING_PROMPTS: Record<CheckinState, string> = {
  strong: "What helped you stay steady today?",
  barely: "What is making today harder than yesterday?",
  exhausted: "What can remain unfinished without becoming a disaster?",
  cant: "What are you afraid will happen if you continue? What are you afraid will happen if you stop?",
};

export const ABANDON_CONFIRM =
  "Closing this goal keeps everything you wrote. The day count ends here — deliberately. That is a decision, not a failure.";

export const JOURNAL_LOCKED =
  "Your journal — every check-in and everything you wrote — opens with a plan.";

export const BENCHMARK_SOURCE_LABEL = "source";

export const STRIP_LABEL = (day: number) => `Day ${day}`;

export const RITUAL_CARD_HEADING = "Today's card, for what you're holding.";
export const RITUAL_WRITING_HEADING = "Write it out.";
export const RITUAL_WRITING_PLACEHOLDER = "A dream, a feeling, the thing you didn't say out loud…";

// --- v3: creation flow, discovery, instant access ---

export const CREATION_OPENING = [
  "Some things are not solved in a day.",
  "Dawnhalo can stay with you while you move through one of them.",
] as const;
export const CREATION_CTA = "Create a journey";
export const CREATION_LATER = "Maybe later";
export const CREATION_TITLE_HELPER =
  "Keep it specific enough that you will know when the journey is complete.";
export const CREATION_REWARD_HELPER =
  "This is the reason you chose to endure the difficult part.";
export const CREATION_SUMMARY_HEAD = "You are choosing to:";
export const CREATION_SUMMARY_NOTE = [
  "Dawnhalo will not ask you to endure blindly.",
  "Every 21 days, it will ask whether this is still worth it.",
] as const;
export const CREATION_BEGIN = "Begin Day 1";
export const CREATION_EDIT = "Edit journey";
export const RITUAL_EACH_DAY = "Decide each day";

export const DISCOVERY_SOFT = [
  "It sounds like you are carrying this for more than one day.",
  "Dawnhalo can stay with you through it, one day at a time.",
] as const;

export const RETURNED_TIMES = (n: number) => `You have returned ${n} time${n === 1 ? "" : "s"}.`;

export const NOW_LABEL = "I need something now";
export const NOW_QUESTION = "What do you need?";
export const NOW_OPTIONS = [
  { id: "card", label: "A card" },
  { id: "clarity", label: "Clarity" },
  { id: "courage", label: "Courage" },
  { id: "calm", label: "Calm" },
  { id: "motivation", label: "Motivation" },
  { id: "goal", label: "Help with my goal" },
  { id: "write", label: "Write something down" },
] as const;

export const CALM_FLOW = [
  "Sit back for a moment. Let your shoulders drop.",
  "Breathe in slowly — and out, slower.",
  "Nothing is asked of you for the next minute. The day can wait sixty seconds.",
  "When you are ready, come back. The cards are not going anywhere.",
] as const;

export const CLARITY_FLOW = [
  "Say the situation in one plain sentence — no explaining, no softening.",
  "Now ask yourself: what do I already know that I keep re-asking?",
  "If you want, bring that sentence to the cards.",
] as const;
