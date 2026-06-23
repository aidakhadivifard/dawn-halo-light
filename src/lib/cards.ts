// Typed service seam for card fetching. ALL UI card data flows through this
// module. It calls the real backend first and falls back to the offline mock
// (dawnhalo.ts) when the backend is unreachable, so the app keeps working in
// preview/offline. Components must not bypass this module.

import {
  drawDailyCard,
  drawRandomCard,
  askOracle,
  artForCard,
  type OracleCard,
} from "@/lib/dawnhalo";
import { srcForId, type CardTheme } from "@/lib/cardLibrary";
import { api, PaywallError, type ApiCard, type Entitlement } from "@/lib/api";

export type { Entitlement } from "@/lib/api";

export type Card = {
  /** Stable id for the drawn card (useful for saving / sharing). */
  id: string;
  /** Short conversational lead-in shown above the title. */
  opener: string;
  /** Card title. */
  title: string;
  /** Main card body / guidance. */
  message: string;
  /** One gentle reflection question shown beneath the guidance. */
  reflection?: string;
  /** Resolved illustration URL (already mapped from the library). */
  illustration: string;
  /** Backend illustration id (for save/share round-trips). */
  illustrationId?: string;
  /** Card theme (drives illustration selection). */
  theme?: CardTheme;
  /** Element of the card (Fire, Water, Earth, Air, Spirit). */
  element?: string;
  /** Card number in the deck. */
  number?: number;
  /** Shadow layer text. */
  shadow?: string;
  /** Hidden layer text (deepest reading). */
  hidden?: string;
  /** True when the input was classified as a crisis — UI shows support copy. */
  isCrisis?: boolean;
  /** Whether the one allowed follow-up has been used. */
  followUpUsed?: boolean;
  /** ISO timestamp. */
  createdAt?: string;
};

export type DrawInput = { intent: "ask" | "feel"; text: string };
export type FollowUpInput = { previous: Card; text: string };

export type DrawOutcome =
  | { kind: "card"; card: Card; entitlement?: Entitlement }
  | { kind: "crisis"; message: string; resources: { region: string; label: string; detail: string }[] }
  | { kind: "paywall"; reason: string };

const CRISIS_RESOURCES = [
  { region: "US", label: "Call or text 988", detail: "Suicide & Crisis Lifeline · 24/7" },
  { region: "UK", label: "Samaritans — 116 123", detail: "Free, 24/7, any reason at all" },
];

// ---- mappers -------------------------------------------------------------

export function fromApiCard(c: ApiCard): Card {
  return apiToCard(c);
}

function apiToCard(c: ApiCard): Card {
  return {
    id: c.id,
    opener: c.opener,
    title: c.title,
    message: c.message,
    reflection: c.reflection,
    theme: c.theme,
    illustrationId: c.illustrationId,
    illustration: srcForId(c.illustrationId, c.theme) ?? artForCard({ id: c.id, theme: c.theme }),
    element: c.element,
    number: c.number,
    shadow: c.shadow,
    hidden: c.hidden,
    isCrisis: c.isCrisis,
    followUpUsed: c.followUpUsed,
    createdAt: c.createdAt,
  };
}

function mockToCard(o: OracleCard): Card {
  return {
    id: o.id,
    opener: o.opener,
    title: o.title,
    message: o.message,
    reflection: o.reflection,
    theme: o.theme,
    element: o.element,
    number: o.number,
    shadow: o.shadow,
    hidden: o.hidden,
    illustration: artForCard(o),
    createdAt: o.createdAt,
  };
}

// ---- public seam ---------------------------------------------------------

/** Synchronous offline daily card — used for the initial SSR/first paint. */
export function offlineDailyCard(date: Date = new Date()): Card {
  return mockToCard(drawDailyCard(date));
}

/** Today's daily card (free forever). */
export async function getDailyCard(date: Date = new Date()): Promise<Card> {
  try {
    const { card } = await api.daily();
    return apiToCard(card);
  } catch {
    return mockToCard(drawDailyCard(date));
  }
}

/** Today's daily card plus the entitlement snapshot, when the backend is up. */
export async function getDailyWithEntitlement(): Promise<{ card: Card; entitlement?: Entitlement }> {
  try {
    const { card, entitlement } = await api.daily();
    return { card: apiToCard(card), entitlement };
  } catch {
    return { card: mockToCard(drawDailyCard(new Date())) };
  }
}

/** Draw a card from a prompt (ask a question or share a feeling). */
export async function drawCardEx(input: DrawInput): Promise<DrawOutcome> {
  try {
    const res = await api.draw(input);
    if (res.kind === "crisis")
      return { kind: "crisis", message: res.payload.message, resources: res.payload.resources };
    if (res.kind === "paywall") return { kind: "paywall", reason: res.reason };
    return { kind: "card", card: apiToCard(res.card), entitlement: res.entitlement };
  } catch (e) {
    if (e instanceof PaywallError) return { kind: "paywall", reason: e.reason };
    // Offline fallback: still enforce crisis safety deterministically.
    const result = askOracle(input.text || "");
    if (result.kind === "crisis")
      return { kind: "crisis", message: offlineCrisisMessage(), resources: CRISIS_RESOURCES };
    return { kind: "card", card: mockToCard(result.kind === "card" ? result.card : drawRandomCard()) };
  }
}

/** One follow-up grounded in the previous card. */
export async function askFollowUpEx(input: FollowUpInput): Promise<DrawOutcome> {
  try {
    const res = await api.followUp({ previousCardId: input.previous.id, text: input.text });
    if (res.kind === "crisis")
      return { kind: "crisis", message: res.payload.message, resources: res.payload.resources };
    if (res.kind === "paywall") return { kind: "paywall", reason: res.reason };
    return { kind: "card", card: apiToCard(res.card), entitlement: res.entitlement };
  } catch (e) {
    if (e instanceof PaywallError) return { kind: "paywall", reason: e.reason };
    const result = askOracle(input.text || "");
    if (result.kind === "crisis")
      return { kind: "crisis", message: offlineCrisisMessage(), resources: CRISIS_RESOURCES };
    return { kind: "card", card: mockToCard(result.kind === "card" ? result.card : drawRandomCard()) };
  }
}

// ---- back-compat thin wrappers (existing signatures) ---------------------

/** Draw a card; returns a Card or a crisis Card (legacy shape). */
export async function drawCard(input: DrawInput): Promise<Card> {
  const out = await drawCardEx(input);
  if (out.kind === "crisis") return crisisCard();
  if (out.kind === "paywall") return { ...crisisCard(), id: "paywall", isCrisis: false, title: "Plans" };
  return out.card;
}

export async function askFollowUp(input: FollowUpInput): Promise<Card> {
  const out = await askFollowUpEx(input);
  if (out.kind === "crisis") return crisisCard();
  return out.kind === "card" ? out.card : crisisCard();
}

function offlineCrisisMessage(): string {
  return "What you're carrying sounds really heavy, and you don't have to hold it alone. Please reach out to someone trained to listen — they want to hear from you.";
}

function crisisCard(): Card {
  return {
    id: `crisis_${Date.now().toString(36)}`,
    opener: "I want to pause here with you for a moment…",
    title: "You Are Not Alone",
    message: offlineCrisisMessage(),
    theme: "quiet_strength",
    illustration: artForCard({ id: "crisis", theme: "quiet_strength" }),
    isCrisis: true,
  };
}
