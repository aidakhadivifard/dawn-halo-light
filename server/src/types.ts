// Shared types for the Dawnhalo backend. The Card shape mirrors the frontend
// service seam (src/lib/cards.ts) so the wire format maps 1:1 to the UI.

export const CARD_THEMES = [
  "daily_general",
  "guidance_decision",
  "exhaustion_rest",
  "relationship_tension",
  "feeling_unseen",
  "self_image",
  "hope_abundance",
  "release_change",
  "quiet_strength",
] as const;

export type CardTheme = (typeof CARD_THEMES)[number];

/** How an input was classified before/by the oracle. */
export type Intent = "crisis" | "dream" | "question" | "feeling" | "general";

/** The card payload returned to the client. */
export interface Card {
  id: string;
  opener: string;
  title: string;
  message: string;
  /** One gentle reflection question shown beneath the guidance. */
  reflection?: string;
  theme: CardTheme;
  /** Library image id (e.g. "card-exhaustion_rest-02"); client resolves to a URL. */
  illustrationId: string;
  isCrisis?: boolean;
  /** Whether a follow-up has already been used on this card. */
  followUpUsed?: boolean;
  createdAt: string;
  /** True when the card text came from the deterministic fallback, not Claude. */
  fallback?: boolean;
}

/** Entitlement / quota snapshot for a device. */
export interface Entitlement {
  subscribed: boolean;
  plan: "monthly" | "yearly" | null;
  /** Active days counted so far (local-day based). */
  activeDays: number;
  /** Whether the device is still inside the first 14 active days. */
  withinTrial: boolean;
  /** Draws used today (daily card + ask/feel), local day. */
  drawsToday: number;
  /** Remaining free *prompted* draws today (ask/feel), after rules applied. */
  freeDrawsRemaining: number;
  /** The daily card is always free; convenience flag for the client. */
  dailyCardFree: true;
}
