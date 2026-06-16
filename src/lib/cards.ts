// Thin typed service layer for card fetching.
// All UI card data flows through this module so a real backend can be
// swapped in by editing only this file (replace the mocked calls with
// fetch() / server-function calls returning the same Card shape).

import {
  drawDailyCard,
  drawRandomCard,
  askOracle,
  artForCard,
  type OracleCard,
} from "@/lib/dawnhalo";

export type Card = {
  /** Stable id for the drawn card (useful for saving / sharing). */
  id: string;
  /** Short conversational lead-in shown above the title. */
  opener: string;
  /** Card title. */
  title: string;
  /** Main card body / message. */
  message: string;
  /** Resolved illustration URL (already mapped from the library). */
  illustration: string;
  /** True when the input was classified as a crisis — UI shows support copy. */
  isCrisis?: boolean;
};

export type DrawInput = {
  intent: "ask" | "feel";
  text: string;
};

export type FollowUpInput = {
  previous: Card;
  text: string;
};

function toCard(o: OracleCard): Card {
  return {
    id: o.id,
    opener: o.opener,
    title: o.title,
    message: o.message,
    illustration: artForCard(o),
  };
}

/** Today's daily card. */
export async function getDailyCard(date: Date = new Date()): Promise<Card> {
  return toCard(drawDailyCard(date));
}

/** Draw a card in response to a user prompt (ask a question or share a feeling). */
export async function drawCard(input: DrawInput): Promise<Card> {
  const text = input.text?.trim();
  if (!text) return toCard(drawRandomCard());
  const result = askOracle(text);
  if (result.kind === "crisis") {
    return {
      id: `crisis_${Date.now().toString(36)}`,
      opener: "I want to pause here with you for a moment…",
      title: "You Are Not Alone",
      message:
        "What you're carrying sounds really heavy. Please reach out to someone who can stay with you right now — a trusted person, or a crisis line in your country. You deserve support, not silence.",
      illustration: artForCard({ id: "crisis", theme: "quiet_strength" }),
      isCrisis: true,
    };
  }
  return toCard(result.card);
}

/** Ask a follow-up grounded in the previous card. */
export async function askFollowUp(input: FollowUpInput): Promise<Card> {
  // Mock: route follow-ups through the same oracle as a feeling-style prompt.
  return drawCard({ intent: "feel", text: input.text });
}
