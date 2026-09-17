// Typed client for the Dawnhalo backend. Every call carries the anonymous
// device id and the user's local day. Network/availability failures throw, so
// the service layer (cards.ts) can fall back to offline behavior gracefully.

import { getDeviceId, localDay } from "@/lib/device";
import type { CardTheme } from "@/lib/cardLibrary";

// VITE_API_URL points at the Express backend (e.g. http://localhost:8787).
// Empty string means "same origin" (useful if you reverse-proxy /api). A
// production build with no URL configured (the APK built by CI) falls back to
// the live API, so the vow reaches the server instead of living offline only.
const PROD_API = "https://dawnhalo-api.onrender.com";
const configured = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const BASE = configured || (import.meta.env.PROD ? PROD_API : "");

/** A wish in the list: her words, its card if it has one, and how it is going. */
export interface ApiWish {
  id: string;
  text: string;
  card: { id: string; name: string; line: string } | null;
  cardAt?: string | null;
  sketch: ApiSketch;
  answeredToday: boolean;
  days: number;
  lastDeedAt: string | null;
  createdAt: string;
}

/** One wish the app heard: a button to press, and a phrase to say back. */
export interface HeardWish {
  label: string;
  echo: string;
}

export interface ApiCard {
  id: string;
  opener: string;
  title: string;
  message: string;
  reflection?: string;
  theme: CardTheme;
  illustrationId: string;
  isCrisis?: boolean;
  followUpUsed?: boolean;
  createdAt: string;
  fallback?: boolean;
}

export interface Entitlement {
  subscribed: boolean;
  plan: "monthly" | "yearly" | null;
  activeDays: number;
  withinTrial: boolean;
  drawsToday: number;
  freeDrawsRemaining: number; // -1 = unlimited
  dailyCardFree: true;
}

export interface CrisisPayload {
  isCrisis: true;
  message: string;
  resources: { region: string; label: string; detail: string }[];
}

export type DrawResponse =
  | { kind: "card"; card: ApiCard; entitlement: Entitlement }
  | { kind: "crisis"; payload: CrisisPayload }
  | { kind: "paywall"; reason: string; entitlement?: Entitlement };

function headers(extra: Record<string, string> = {}): HeadersInit {
  return {
    "content-type": "application/json",
    "x-device-id": getDeviceId(),
    "x-local-date": localDay(),
    ...extra,
  };
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: headers((init?.headers as Record<string, string>) ?? {}),
  });
  if (res.status === 402) {
    const body = await res.json().catch(() => ({}));
    throw new PaywallError(body.reason ?? "paywall", body.entitlement);
  }
  if (!res.ok) throw new Error(`api_error_${res.status}`);
  return (await res.json()) as T;
}

export class PaywallError extends Error {
  reason: string;
  entitlement?: Entitlement;
  constructor(reason: string, entitlement?: Entitlement) {
    super("paywall");
    this.reason = reason;
    this.entitlement = entitlement;
  }
}

export const api = {
  async daily(): Promise<{ card: ApiCard; entitlement: Entitlement }> {
    return req(`/cards/daily`);
  },
  async draw(input: { intent: "ask" | "feel"; text: string }): Promise<DrawResponse> {
    const body = await req<any>(`/cards/draw`, { method: "POST", body: JSON.stringify(input) }).catch(
      (e) => {
        if (e instanceof PaywallError) return { paywall: true, reason: e.reason, entitlement: e.entitlement };
        throw e;
      },
    );
    if (body.paywall) return { kind: "paywall", reason: body.reason, entitlement: body.entitlement };
    if (body.isCrisis) return { kind: "crisis", payload: body };
    return { kind: "card", card: body.card, entitlement: body.entitlement };
  },
  async followUp(input: { previousCardId: string; text: string }): Promise<DrawResponse> {
    const body = await req<any>(`/cards/follow-up`, {
      method: "POST",
      body: JSON.stringify(input),
    }).catch((e) => {
      if (e instanceof PaywallError) return { paywall: true, reason: e.reason, entitlement: e.entitlement };
      throw e;
    });
    if (body.paywall) return { kind: "paywall", reason: body.reason, entitlement: body.entitlement };
    if (body.isCrisis) return { kind: "crisis", payload: body };
    return { kind: "card", card: body.card, entitlement: body.entitlement };
  },
  async entitlement(): Promise<Entitlement> {
    return req(`/entitlement`);
  },
  async history(): Promise<{ history: ApiCard[] }> {
    return req(`/history`);
  },
  async calendar(): Promise<{ byDay: Record<string, ApiCard[]>; streak: number }> {
    return req(`/calendar`);
  },
  async listSaved(): Promise<{ saved: (ApiCard & { savedAt: string })[] }> {
    return req(`/saved`);
  },
  async save(card: ApiCard): Promise<void> {
    await req(`/saved`, { method: "POST", body: JSON.stringify({ card }) });
  },
  async unsave(id: string): Promise<void> {
    await req(`/saved/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
  async getSettings(): Promise<{ reminderTime: string; notificationsOn: boolean }> {
    return req(`/settings`);
  },
  async setSettings(s: { reminderTime: string; notificationsOn: boolean }): Promise<void> {
    await req(`/settings`, { method: "PUT", body: JSON.stringify(s) });
  },
  async createSpark(card: ApiCard, note: string): Promise<{ token: string; url: string }> {
    return req(`/spark`, { method: "POST", body: JSON.stringify({ card, note }) });
  },
  async getSpark(token: string): Promise<{ card: ApiCard; note: string }> {
    return req(`/spark/${encodeURIComponent(token)}`);
  },

  // --- Horizon & Roads ---
  async home(): Promise<ApiHome> {
    return req(`/home`);
  },
  async getHorizon(): Promise<{ horizon: string | null }> {
    return req(`/horizon`);
  },
  async requestSketch(): Promise<{ status: string; sketch: ApiSketch }> {
    return req(`/horizon/sketch`, { method: "POST", body: JSON.stringify({}) });
  },
  /** Absolute URL for a sketch image path returned by the API. */
  sketchUrl(path: string | null): string | null {
    return path ? `${BASE}${path}` : null;
  },
  async setHorizon(
    text: string,
    park: string[] = [],
    lang = "en",
  ): Promise<{
    horizon?: string;
    parked?: number;
    isCrisis?: boolean;
    message?: string;
    resources?: CrisisPayload["resources"];
  }> {
    return req(`/horizon`, { method: "PUT", body: JSON.stringify({ text, park, lang }) });
  },
  /** What the app heard: the distinct wishes inside what they wrote. Saves nothing. */
  async hearWish(
    text: string,
    lang: string,
  ): Promise<{
    wishes?: HeardWish[];
    /** True when it only split on punctuation — the phrasing is hers, not polished. */
    fallback?: boolean;
    isCrisis?: boolean;
    message?: string;
    resources?: CrisisPayload["resources"];
  }> {
    return req(`/wish/hear`, { method: "POST", body: JSON.stringify({ text, lang }) });
  },
  /** Every wish this person keeps — being lived, or still waiting. */
  async listWishes(): Promise<{ currentId: string | null; wishes: ApiWish[] }> {
    return req(`/wishes`);
  },
  /** Open one. Every other call then means this wish. */
  async openWish(id: string): Promise<{ ok: true }> {
    return req(`/wishes/${encodeURIComponent(id)}/open`, { method: "POST", body: JSON.stringify({}) });
  },
  /** Begin another wish. A sealed wish is not the end of the app. */
  async beginWish(text: string, park: string[] = []): Promise<{
    horizon?: string;
    wishId?: string;
    isCrisis?: boolean;
    message?: string;
    resources?: CrisisPayload["resources"];
  }> {
    return req(`/wishes`, { method: "POST", body: JSON.stringify({ text, park }) });
  },

  // --- The road card and the deeds ---
  /** Draw the one card. Drawing it seals the wish forever. */
  async drawRoadCard(lang = "en"): Promise<{ card: ApiRoadCard; sealed: true; alreadyDrawn: boolean }> {
    return req(`/card`, { method: "POST", body: JSON.stringify({ lang }) });
  },
  /** Today's answer. 'stayed' counts exactly as much as 'did'. */
  async recordDeed(kind: "did" | "stayed" | "stuck", text?: string | null): Promise<{
    deed?: ApiDeed;
    sketch?: ApiSketch;
    isCrisis?: boolean;
    message?: string;
    resources?: CrisisPayload["resources"];
  }> {
    return req(`/deed`, { method: "POST", body: JSON.stringify({ kind, text: text ?? null }) });
  },
  async listDeeds(): Promise<{ deeds: ApiDeed[] }> {
    return req(`/deeds`);
  },
  /** One more, smaller. `step: null` means the ladder is over — not an error. */
  async nextTinyStep(): Promise<{ step: string | null }> {
    return req(`/step/next`, { method: "POST", body: JSON.stringify({}) });
  },

  // --- The Vow (journey / road) — journeyId is required only with two roads ---
  async getJourney(journeyId?: string): Promise<{ journey: ApiJourney | null }> {
    return req(`/journey${journeyId ? `?journeyId=${encodeURIComponent(journeyId)}` : ""}`);
  },
  async createJourney(input: {
    enduring: string;
    hope: string;
    label?: string;
    letterTo?: string;
    letterText?: string;
  }): Promise<{ journey?: ApiJourney; isCrisis?: boolean; message?: string; resources?: CrisisPayload["resources"] }> {
    const res = await fetch(`${BASE}/api/journey`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(input),
    });
    if (res.status === 409) {
      const body = await res.json().catch(() => ({}));
      throw new RoadsFullError(body.roads ?? [], body.maxRoads ?? 2);
    }
    if (!res.ok) throw new Error(`api_error_${res.status}`);
    return (await res.json()) as any;
  },
  async commitStep(text: string, journeyId?: string): Promise<{
    step?: { id: string; text: string; status: "committed" };
    isCrisis?: boolean;
    message?: string;
    resources?: CrisisPayload["resources"];
  }> {
    return req(`/journey/step`, { method: "POST", body: JSON.stringify({ text, journeyId }) });
  },
  async declineStep(journeyId?: string): Promise<{ ok: boolean }> {
    return req(`/journey/step/decline`, { method: "POST", body: JSON.stringify({ journeyId }) });
  },
  async resolveStep(done: boolean, journeyId?: string): Promise<{ line: string }> {
    return req(`/journey/step/resolve`, { method: "POST", body: JSON.stringify({ done, journeyId }) });
  },
  async darkNight(text: string, journeyId?: string): Promise<{
    context?: ApiDarkNightContext;
    isCrisis?: boolean;
    message?: string;
    resources?: CrisisPayload["resources"];
  }> {
    return req(`/journey/dark-night`, { method: "POST", body: JSON.stringify({ text, journeyId }) });
  },
  async closeJourney(input: {
    outcome: "fulfilled" | "released";
    note?: string;
    journeyId?: string;
  }): Promise<{
    journey: ApiJourney;
    keepsake: ApiKeepsake;
    url: string;
    letter: { to: string; text: string; url: string } | null;
    letterBurned: boolean;
  }> {
    return req(`/journey/close`, { method: "POST", body: JSON.stringify(input) });
  },
  async getKeepsake(token: string): Promise<{ keepsake: ApiKeepsake }> {
    return req(`/keepsake/${encodeURIComponent(token)}`);
  },
  async getLetter(token: string): Promise<{ letter: ApiLetter }> {
    return req(`/letter/${encodeURIComponent(token)}`);
  },

  // --- Partner referrals ---
  async attributePartner(code: string): Promise<{ ok: boolean; attributed: boolean }> {
    return req(`/partner/attribute`, { method: "POST", body: JSON.stringify({ code }) });
  },
  async partnerStats(code: string, key: string): Promise<PartnerStats> {
    return req(`/partner/${encodeURIComponent(code)}/stats?key=${encodeURIComponent(key)}`);
  },
};

/** Thrown when a third road is attempted — the cap is a product invariant. */
export class RoadsFullError extends Error {
  roads: ApiJourney[];
  maxRoads: number;
  constructor(roads: ApiJourney[], maxRoads: number) {
    super("roads_full");
    this.roads = roads;
    this.maxRoads = maxRoads;
  }
}

/** The horizon sketch: drawn once in ink, colored by the staying. */
export interface ApiSketch {
  available: boolean;
  status: "none" | "pending" | "ready" | "failed";
  /** API-relative paths (prefix with the API base). */
  lineUrl: string | null;
  colorUrl: string | null;
  /** Done steps + hard nights — the only thing that brings color. */
  lit: number;
  fullAt: number;
  /** The words changed after the picture was drawn (redraw cap reached). */
  stale: boolean;
}

/** The home screen in one call: the horizon (never measured), its sketch, and the open roads. */
/** The road card, drawn once. Its id is also the badge glyph. */
export interface ApiRoadCard {
  id: string;
  /** What this card meant for this wish. Null when there was nothing honest to say. */
  reading?: string | null;
  name: string;
  line: string;
}

export interface ApiDeed {
  id: string;
  kind: "did" | "stayed" | "stuck";
  text: string | null;
  localDate?: string;
  createdAt?: string;
}

export interface ApiHome {
  horizon: string | null;
  /** Which wish the home screen is showing. */
  wishId?: string | null;
  /** True once any card has ever been kept — the app has begun. */
  started?: boolean;
  /** True once the card has been drawn: the words can never be edited again. */
  sealed?: boolean;
  card?: ApiRoadCard | null;
  todayDeed?: ApiDeed | null;
  roads: ApiJourney[];
  maxRoads: number;
  sketch: ApiSketch;
}

export interface ApiJourney {
  id: string;
  /** A short name for the road ("Body", "Pink Wallet"). */
  label: string | null;
  enduring: string;
  hope: string;
  status: "active" | "fulfilled" | "released";
  startedLocalDate: string;
  closedLocalDate: string | null;
  dayNumber: number;
  keepsakeToken: string | null;
  /** The sealed letter — only the recipient's initial while the vow is active. */
  letter: { initial: string | null; sealed: boolean } | null;
  card: ApiCard;
  darkNights: { id: string; text: string; localDate: string; createdAt: string }[];
  /** Living state — present on the active-vow snapshot only. */
  living?: ApiVowLiving;
}

export interface ApiVowLiving {
  todayStep: { id: string; text: string; status: "committed" | "done" | "not_moved" } | null;
  askStep: boolean;
  actionPrompt: string;
  memory: string | null;
  returnLine: string | null;
}

export interface ApiLetter {
  to: string;
  text: string;
  writtenLocalDate: string;
  keepsake: ApiKeepsake;
}

export interface ApiDarkNightContext {
  journeyDay: number;
  nightNumber: number;
  previousNightDate: string | null;
  daysSincePrevious: number | null;
  vowTitle: string;
  line: string;
}

export interface ApiKeepsake {
  status: string;
  enduring: string;
  hope: string;
  cardTitle: string;
  cardEssence: string;
  theme: CardTheme;
  illustrationId: string;
  message: string;
  startedLocalDate: string;
  closedLocalDate: string | null;
  daysHeld: number;
  darkNights: number;
  closingNote: string | null;
}

export interface PartnerStats {
  code: string;
  name: string;
  revSharePct: number;
  installs: number;
  subscribers: number;
  revenueUsd: number;
  accruedUsd: number;
  shareUrl: string;
}
