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
