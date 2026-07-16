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
  step1Heading: "What are you holding on for?",
  step1Sub: "One concrete thing, with a real day it ends.",
  titlePlaceholder: "e.g. stay at this job until my equity vests",
  rewardLabel: "The reward at the end",
  rewardPlaceholder: "e.g. the vested shares — my way out",
  dateLabel: "The day it ends",
  photoLabel: "A photo of it (optional — stays on your phone)",
  step2Heading: "What helps you keep going?",
  step2Card: "Pull a card",
  step2CardSub: "A reading for the day you're in.",
  step2Writing: "Write it out",
  step2WritingSub: "Say it plainly; get one honest reflection.",
  step3Heading: HOLDING_QUESTION,
  step3Sub: "Day 1 starts the moment you answer.",
  dateLockNote:
    "The date locks when you commit. Changing it later means closing this goal and starting a new one — a shorter road you actually walk beats a longer one you keep redrawing.",
} as const;

export const HONESTY_OPTIONS = [
  { id: "continue", label: "Yes, continuing" },
  { id: "thinking", label: "I need to think" },
  { id: "done", label: "I'm done — and that's a decision, not a failure." },
] as const;

export const ABANDON_CONFIRM =
  "Closing this goal keeps everything you wrote. The day count ends here — deliberately. That is a decision, not a failure.";

export const JOURNAL_LOCKED =
  "Your journal — every check-in and everything you wrote — opens with a plan.";

export const BENCHMARK_SOURCE_LABEL = "source";

export const STRIP_LABEL = (day: number) => `Day ${day}`;

export const RITUAL_CARD_HEADING = "Today's card, for what you're holding.";
export const RITUAL_WRITING_HEADING = "Write it out.";
export const RITUAL_WRITING_PLACEHOLDER = "A dream, a feeling, the thing you didn't say out loud…";
