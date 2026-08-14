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
  /** One short claim to carry — the reading's pocketable line. */
  keepLine?: string;
  /** The side the card took: "forward" | "steady" | "caution". */
  lean?: string;
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
  | { kind: "card"; card: ApiCard; entitlement: Entitlement; goalSeed?: string; answer?: string }
  | { kind: "crisis"; payload: CrisisPayload }
  | { kind: "paywall"; reason: string; entitlement?: Entitlement };

// ---- endurance goal ("what you're holding on for") ----

export type CheckinState = "strong" | "barely" | "cant" | "exhausted";
export type RitualType = "card" | "writing";

export interface BenchmarkLine {
  id: string;
  text: string;
  sourceName: string;
  sourceUrl: string;
  tags: string[];
}

export interface Goal {
  id: string;
  title: string;
  reward: string;
  startDate: string;
  targetDate: string;
  photoUrl?: string;
  ritual: RitualType;
  status: string;
  createdAt: string;
}

export interface GoalStatus {
  goal: Goal;
  day: number;
  totalDays: number;
  progress: number;
  streak: number;
  checkinCount: number;
  checkedInToday: boolean;
  todayState: CheckinState | null;
  ritualDoneToday: boolean;
  benchmark: BenchmarkLine | null;
  honestyDue: boolean;
  honestyPrompt: string;
  hasWitness?: boolean;
  witnessSawToday?: boolean;
}

export interface GoalSummary {
  title: string;
  reward: string;
  startDate: string;
  targetDate: string;
  endDate: string;
  daysHeld: number;
  checkinCount: number;
  stateCounts: Record<CheckinState, number>;
  notes: string[];
  heading: string;
  outcome: "completed" | "abandoned";
}

export interface CheckinResult {
  already: boolean;
  day: number;
  streak: number;
  state: CheckinState;
  ack: string;
  benchmark: BenchmarkLine | null;
  offerRitual: boolean;
  suggestedRitual: RitualType;
  offerHonesty: boolean;
  honestyDue: boolean;
  honestyOffer?: string;
  milestone: { id: string; message: string } | null;
  summary?: GoalSummary;
  suggestWitness?: boolean;
}

export type CheckinResponse =
  | { kind: "checkin"; checkin: CheckinResult }
  | { kind: "crisis"; payload: CrisisPayload };

export type RitualResponse =
  | { kind: "card"; card: ApiCard }
  | { kind: "reflection"; reflection: string; fallback: boolean }
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

// Never let the ritual hang on a sleeping backend: cap every call so the
// offline fallback takes over instead of an endless "thinking" screen.
const REQUEST_TIMEOUT_MS = 15_000;

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: headers((init?.headers as Record<string, string>) ?? {}),
    signal:
      typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
        ? AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        : undefined,
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
    return { kind: "card", card: body.card, entitlement: body.entitlement, goalSeed: body.goalSeed };
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
    return { kind: "card", card: body.card, entitlement: body.entitlement, answer: body.answer };
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

  // ---- endurance goal ----

  async getGoal(goalId?: string): Promise<{ status: GoalStatus | null }> {
    return req(goalId ? `/goal?goalId=${encodeURIComponent(goalId)}` : `/goal`);
  },
  /** Every active journey, oldest first. Falls back to the single-goal
   *  endpoint against an older backend. */
  async getGoals(): Promise<{ goals: GoalStatus[] }> {
    try {
      return await req(`/goals`);
    } catch {
      const { status } = await req<{ status: GoalStatus | null }>(`/goal`);
      return { goals: status ? [status] : [] };
    }
  },
  async createGoal(input: {
    title: string;
    reward: string;
    targetDate: string;
    ritual?: RitualType;
  }): Promise<{ status: GoalStatus }> {
    return req(`/goal`, { method: "POST", body: JSON.stringify(input) });
  },
  async updateGoal(patch: {
    title?: string;
    photoUrl?: string | null;
    ritual?: RitualType;
    goalId?: string;
  }): Promise<{ ok: true; status: GoalStatus }> {
    return req(`/goal`, { method: "PATCH", body: JSON.stringify(patch) });
  },
  async closeGoal(reason: "completed" | "abandoned", goalId?: string): Promise<{ summary: GoalSummary }> {
    return req(`/goal/close`, { method: "POST", body: JSON.stringify({ reason, goalId }) });
  },
  async checkin(input: { state: CheckinState; note?: string; goalId?: string }): Promise<CheckinResponse> {
    const body = await req<any>(`/goal/checkin`, { method: "POST", body: JSON.stringify(input) });
    if (body.isCrisis) return { kind: "crisis", payload: body };
    return { kind: "checkin", checkin: body.checkin };
  },
  async ritual(input: { type: RitualType; text?: string; goalId?: string }): Promise<RitualResponse> {
    const body = await req<any>(`/goal/ritual`, {
      method: "POST",
      body: JSON.stringify(input),
    }).catch((e) => {
      if (e instanceof PaywallError)
        return { paywall: true, reason: e.reason, entitlement: e.entitlement };
      throw e;
    });
    if (body.paywall) return { kind: "paywall", reason: body.reason, entitlement: body.entitlement };
    if (body.isCrisis) return { kind: "crisis", payload: body };
    if (body.card) return { kind: "card", card: body.card };
    return { kind: "reflection", reflection: body.reflection, fallback: !!body.fallback };
  },
  async honesty(
    answer: "continue" | "adjust" | "thinking" | "done",
    note?: string,
    goalId?: string,
  ): Promise<{ ok: true; summary?: GoalSummary }> {
    return req(`/goal/honesty`, { method: "POST", body: JSON.stringify({ answer, note, goalId }) });
  },
  async goalHistory(): Promise<{
    checkins: { id: string; date: string; state: CheckinState; note?: string }[];
    entries: {
      id: string;
      date: string;
      type: RitualType;
      cardId?: string;
      userText?: string;
      aiReflection?: string;
    }[];
    honesty: { id: string; date: string; day: number; answer: string; note?: string }[];
  }> {
    return req(`/goal/history`);
  },
  async goalHistoryFor(goalId: string): Promise<{
    checkins: { id: string; date: string; state: CheckinState; note?: string }[];
    entries: {
      id: string;
      date: string;
      type: RitualType;
      cardId?: string;
      userText?: string;
      aiReflection?: string;
    }[];
    honesty: { id: string; date: string; day: number; answer: string; note?: string }[];
  }> {
    return req(`/goal/history?goalId=${encodeURIComponent(goalId)}`);
  },
  async deck(): Promise<{ deck: { title: string; theme: string; essence: string }[] }> {
    return req(`/deck`);
  },

  // ---- the Witness ----

  async createWitnessInvite(): Promise<{ token: string; url: string }> {
    return req(`/goal/witness`, { method: "POST", body: JSON.stringify({}) });
  },
  async sendWitnessSignal(): Promise<{ ok: true; url?: string }> {
    return req(`/goal/witness/signal`, { method: "POST", body: JSON.stringify({}) });
  },
  async getWitness(token: string): Promise<{
    active: boolean;
    day?: number;
    checkinCount?: number;
    showedUpToday?: boolean;
    heavyToday?: boolean;
  }> {
    return req(`/witness/${encodeURIComponent(token)}?date=${localDay()}`);
  },
};

/**
 * Fire-and-forget wake-up call. The free-plan backend sleeps after 15 min;
 * pinging it the moment the app opens means it is usually warm by the time
 * the user reaches the cards, instead of the draw eating the cold start.
 */
export function warmBackend(): void {
  try {
    fetch(`${BASE}/api/health`).catch(() => {});
  } catch {
    /* ignore */
  }
}
