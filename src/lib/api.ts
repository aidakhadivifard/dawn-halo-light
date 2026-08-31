// Typed client for the Dawnhalo backend. Every call carries the anonymous
// device id and the user's local day. Network/availability failures throw, so
// the service layer (cards.ts) can fall back to offline behavior gracefully.

import { getDeviceId, localDay } from "@/lib/device";
import type { CardTheme } from "@/lib/cardLibrary";

// VITE_API_URL points at the Express backend (e.g. http://localhost:8787).
// Empty string means "same origin" (useful if you reverse-proxy /api).
const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

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
  async checkout(plan: "monthly" | "yearly"): Promise<{ url: string | null }> {
    return req(`/stripe/checkout`, { method: "POST", body: JSON.stringify({ plan }) });
  },

  // --- The Vow (journey) ---
  async getJourney(): Promise<{ journey: ApiJourney | null }> {
    return req(`/journey`);
  },
  async createJourney(input: {
    enduring: string;
    hope: string;
    letterTo?: string;
    letterText?: string;
  }): Promise<{ journey?: ApiJourney; isCrisis?: boolean; message?: string; resources?: CrisisPayload["resources"] }> {
    return req(`/journey`, { method: "POST", body: JSON.stringify(input) });
  },
  async darkNight(text: string): Promise<{
    context?: ApiDarkNightContext;
    isCrisis?: boolean;
    message?: string;
    resources?: CrisisPayload["resources"];
  }> {
    return req(`/journey/dark-night`, { method: "POST", body: JSON.stringify({ text }) });
  },
  async closeJourney(input: {
    outcome: "fulfilled" | "released";
    note?: string;
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

export interface ApiJourney {
  id: string;
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
