// Application service: ties together crisis detection, classification,
// entitlement, AI card generation, illustration selection, and persistence.
// HTTP routes are thin wrappers over this; tests drive it directly.

import type { DB, JourneyRow } from "./db";
import type { Card, CardTheme } from "./types";
import { detectCrisis, CRISIS_RESOURCES } from "./lib/crisis";
import { classifyInput } from "./lib/classify";
import { canDraw, snapshot, withinTrial, type QuotaState } from "./lib/entitlement";
import { selectIllustration, NO_REPEAT_WINDOW_DAYS } from "./lib/illustrations";
import { generateCardText, generateVowText, type MessagesClient } from "./lib/anthropic";
import { findHalo } from "./lib/deck";
import type { JourneyContext } from "./lib/prompt";
import {
  darkNightContext,
  dayNumber,
  toKeepsake,
  type DarkNightContext,
  type Keepsake,
} from "./lib/journey";

export interface ServiceDeps {
  client?: MessagesClient | null;
  now?: () => Date;
  timeoutMs?: number;
}

export type DrawResult =
  | { kind: "crisis"; message: string; resources: typeof CRISIS_RESOURCES.resources }
  | { kind: "paywall"; reason: string }
  | { kind: "card"; card: Card };

let counter = 0;
function newId(prefix: string): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export function createService(db: DB, deps: ServiceDeps = {}) {
  const now = deps.now ?? (() => new Date());
  const client = deps.client;
  const timeoutMs = deps.timeoutMs;

  function quotaState(deviceId: string, localDate: string): QuotaState {
    const device = db.getOrCreateDevice(deviceId);
    const periodOk =
      !device.current_period_end || new Date(device.current_period_end) > now();
    const subscribed = !!device.subscribed && periodOk;
    return {
      subscribed,
      plan: (device.plan as "monthly" | "yearly" | null) ?? null,
      activeDays: db.countActiveDays(deviceId),
      drawsToday: db.countDrawsToday(deviceId, localDate),
    };
  }

  function recentIds(deviceId: string, theme: CardTheme): string[] {
    const since = new Date(now().getTime() - NO_REPEAT_WINDOW_DAYS * 86_400_000).toISOString();
    return db.recentIllustrationIds(deviceId, theme, since);
  }

  /** Active vow context, when one exists — threads the story into readings. */
  function journeyCtx(deviceId: string, localDate: string): JourneyContext | undefined {
    const j = db.activeJourney(deviceId);
    if (!j) return undefined;
    return {
      enduring: j.enduring,
      hope: j.hope,
      cardTitle: j.card_title,
      dayNumber: dayNumber(j.started_local_date, localDate),
    };
  }

  function journeyToApi(j: JourneyRow, localDate: string) {
    const nights = db.listDarkNights(j.id);
    return {
      id: j.id,
      enduring: j.enduring,
      hope: j.hope,
      status: j.status as "active" | "fulfilled" | "released",
      startedLocalDate: j.started_local_date,
      closedLocalDate: j.closed_local_date,
      dayNumber: dayNumber(j.started_local_date, j.closed_local_date ?? localDate),
      keepsakeToken: j.keepsake_token,
      card: {
        id: j.id,
        opener: j.opener,
        title: j.card_title,
        message: j.message,
        reflection: j.reflection ?? undefined,
        theme: j.theme as CardTheme,
        illustrationId: j.illustration_id,
        createdAt: j.created_at,
        fallback: !!j.fallback,
      } satisfies Card,
      darkNights: nights.map((n) => ({
        id: n.id,
        text: n.text,
        localDate: n.local_date,
        createdAt: n.created_at,
      })),
    };
  }

  function toCard(row: {
    id: string;
    opener: string;
    title: string;
    message: string;
    reflection?: string | null;
    theme: string;
    illustration_id: string;
    created_at: string;
    fallback?: number;
    follow_up_used?: number;
  }): Card {
    return {
      id: row.id,
      opener: row.opener,
      title: row.title,
      message: row.message,
      reflection: row.reflection ?? undefined,
      theme: row.theme as CardTheme,
      illustrationId: row.illustration_id,
      createdAt: row.created_at,
      fallback: !!row.fallback,
      followUpUsed: !!row.follow_up_used,
    };
  }

  return {
    entitlement(deviceId: string, localDate: string) {
      return snapshot(quotaState(deviceId, localDate));
    },

    async getDailyCard(deviceId: string, localDate: string): Promise<Card> {
      db.getOrCreateDevice(deviceId);
      // Daily card is idempotent per local day: one stable card per day.
      const existing = db
        .history(deviceId, 200)
        .find((d) => d.type === "daily" && d.local_date === localDate);
      if (existing) return toCard(existing);

      const gen = await generateCardText(
        { intent: "general", journey: journeyCtx(deviceId, localDate) },
        { client, timeoutMs },
      );
      const illustrationId = selectIllustration(gen.theme, recentIds(deviceId, gen.theme));
      const row = {
        id: newId("daily"),
        device_id: deviceId,
        local_date: localDate,
        type: "daily",
        theme: gen.theme,
        illustration_id: illustrationId,
        opener: gen.opener,
        title: gen.title,
        message: gen.message,
        reflection: gen.reflection || null,
        prompt: null,
        parent_id: null,
        fallback: gen.fallback ? 1 : 0,
        created_at: now().toISOString(),
      };
      db.insertDraw(row);
      return toCard(row);
    },

    async drawCard(
      deviceId: string,
      localDate: string,
      input: { intent: "ask" | "feel"; text: string },
    ): Promise<DrawResult> {
      const text = (input.text ?? "").trim();

      // Safety first — crisis check BEFORE anything else, no card produced.
      if (text && detectCrisis(text).isCrisis) {
        return {
          kind: "crisis",
          message: CRISIS_RESOURCES.message,
          resources: CRISIS_RESOURCES.resources,
        };
      }

      const state = quotaState(deviceId, localDate);
      const decision = canDraw("prompted", state);
      if (!decision.allowed) return { kind: "paywall", reason: decision.reason };

      const intent = text ? classifyInput(text) : "general";
      const gen = await generateCardText(
        { intent, text, journey: journeyCtx(deviceId, localDate) },
        { client, timeoutMs },
      );
      const illustrationId = selectIllustration(gen.theme, recentIds(deviceId, gen.theme));
      const row = {
        id: newId("card"),
        device_id: deviceId,
        local_date: localDate,
        type: "prompted",
        theme: gen.theme,
        illustration_id: illustrationId,
        opener: gen.opener,
        title: gen.title,
        message: gen.message,
        reflection: gen.reflection || null,
        prompt: text || null,
        parent_id: null,
        fallback: gen.fallback ? 1 : 0,
        created_at: now().toISOString(),
      };
      db.insertDraw(row);
      return { kind: "card", card: toCard(row) };
    },

    async askFollowUp(
      deviceId: string,
      localDate: string,
      input: { previousCardId: string; text: string },
    ): Promise<DrawResult | { kind: "not_found" } | { kind: "already_used" }> {
      const text = (input.text ?? "").trim();

      if (text && detectCrisis(text).isCrisis) {
        return {
          kind: "crisis",
          message: CRISIS_RESOURCES.message,
          resources: CRISIS_RESOURCES.resources,
        };
      }

      const parent = db.getDraw(input.previousCardId);
      if (!parent || parent.device_id !== deviceId) return { kind: "not_found" };
      if (parent.follow_up_used) return { kind: "already_used" }; // exactly ONE follow-up

      // A follow-up doesn't consume a daily draw, but post-trial free users are
      // still gated (it's an ask/feel interaction).
      const state = quotaState(deviceId, localDate);
      if (!state.subscribed && !withinTrial(state)) {
        return { kind: "paywall", reason: "trial_over" };
      }

      const intent = classifyInput(text || parent.message);
      const gen = await generateCardText(
        {
          intent,
          text,
          previous: { title: parent.title, message: parent.message },
          journey: journeyCtx(deviceId, localDate),
        },
        { client, timeoutMs },
      );
      const illustrationId = selectIllustration(gen.theme, recentIds(deviceId, gen.theme));
      const row = {
        id: newId("follow"),
        device_id: deviceId,
        local_date: localDate,
        type: "followup",
        theme: gen.theme,
        illustration_id: illustrationId,
        opener: gen.opener,
        title: gen.title,
        message: gen.message,
        reflection: gen.reflection || null,
        prompt: text || null,
        parent_id: parent.id,
        fallback: gen.fallback ? 1 : 0,
        created_at: now().toISOString(),
      };
      db.insertDraw(row);
      db.markFollowUpUsed(parent.id);
      return { kind: "card", card: { ...toCard(row), followUpUsed: true } };
    },

    // ----- The Vow (journey) ------------------------------------------------

    /** Active vow snapshot for the home screen, or null. */
    getJourney(deviceId: string, localDate: string) {
      db.getOrCreateDevice(deviceId);
      const j = db.activeJourney(deviceId);
      return j ? journeyToApi(j, localDate) : null;
    },

    listJourneys(deviceId: string, localDate: string) {
      return db.listJourneys(deviceId).map((j) => journeyToApi(j, localDate));
    },

    /**
     * Make a vow: crisis-check both texts, then draw ONE card. Refuses when an
     * active vow already exists — a vow is never quietly replaced.
     */
    async createJourney(
      deviceId: string,
      localDate: string,
      input: { enduring: string; hope: string },
    ): Promise<
      | { kind: "crisis"; message: string; resources: typeof CRISIS_RESOURCES.resources }
      | { kind: "exists"; journey: ReturnType<typeof journeyToApi> }
      | { kind: "invalid" }
      | { kind: "journey"; journey: ReturnType<typeof journeyToApi> }
    > {
      const enduring = (input.enduring ?? "").trim().slice(0, 500);
      const hope = (input.hope ?? "").trim().slice(0, 500);
      if (!enduring || !hope) return { kind: "invalid" };

      // Safety first — both fields, before any AI call.
      for (const t of [enduring, hope]) {
        if (detectCrisis(t).isCrisis) {
          return {
            kind: "crisis",
            message: CRISIS_RESOURCES.message,
            resources: CRISIS_RESOURCES.resources,
          };
        }
      }

      db.getOrCreateDevice(deviceId);
      const existing = db.activeJourney(deviceId);
      if (existing) return { kind: "exists", journey: journeyToApi(existing, localDate) };

      const gen = await generateVowText({ enduring, hope }, { client, timeoutMs });
      const essence = findHalo(gen.title)?.essence ?? "";
      const illustrationId = selectIllustration(gen.theme, recentIds(deviceId, gen.theme));
      const row: JourneyRow = {
        id: newId("vow"),
        device_id: deviceId,
        enduring,
        hope,
        card_title: gen.title,
        card_essence: essence,
        theme: gen.theme,
        illustration_id: illustrationId,
        opener: gen.opener,
        message: gen.message,
        reflection: gen.reflection || null,
        started_local_date: localDate,
        status: "active",
        closed_at: null,
        closed_local_date: null,
        closing_note: null,
        keepsake_token: null,
        fallback: gen.fallback ? 1 : 0,
        created_at: now().toISOString(),
      };
      db.insertJourney(row);
      return { kind: "journey", journey: journeyToApi(row, localDate) };
    },

    /**
     * Log a dark night. The answer is the person's own history — deterministic,
     * verifiably true, no AI. Crisis check still runs first.
     */
    addDarkNight(
      deviceId: string,
      localDate: string,
      text: string,
    ):
      | { kind: "crisis"; message: string; resources: typeof CRISIS_RESOURCES.resources }
      | { kind: "no_journey" }
      | { kind: "night"; context: DarkNightContext } {
      const trimmed = (text ?? "").trim().slice(0, 500);
      if (trimmed && detectCrisis(trimmed).isCrisis) {
        return {
          kind: "crisis",
          message: CRISIS_RESOURCES.message,
          resources: CRISIS_RESOURCES.resources,
        };
      }
      const j = db.activeJourney(deviceId);
      if (!j) return { kind: "no_journey" };

      const prior = db.listDarkNights(j.id);
      const context = darkNightContext({
        journey: j,
        priorNights: prior,
        todayLocalDate: localDate,
      });
      db.insertDarkNight({
        id: newId("night"),
        journey_id: j.id,
        device_id: deviceId,
        text: trimmed,
        local_date: localDate,
        created_at: now().toISOString(),
      });
      return { kind: "night", context };
    },

    /**
     * Close the vow — fulfilled (the hoped-for thing arrived) or released
     * (letting it go, honoring the endurance). Mints the keepsake token.
     */
    closeJourney(
      deviceId: string,
      localDate: string,
      input: { outcome: "fulfilled" | "released"; note?: string },
    ):
      | { kind: "no_journey" }
      | { kind: "closed"; journey: ReturnType<typeof journeyToApi>; keepsake: Keepsake } {
      const j = db.activeJourney(deviceId);
      if (!j) return { kind: "no_journey" };
      const token = `vow_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      db.closeJourney({
        id: j.id,
        status: input.outcome,
        closedAt: now().toISOString(),
        closedLocalDate: localDate,
        closingNote: (input.note ?? "").trim().slice(0, 500) || null,
        keepsakeToken: token,
      });
      const closed = db.getJourney(j.id)!;
      const nights = db.listDarkNights(j.id);
      return {
        kind: "closed",
        journey: journeyToApi(closed, localDate),
        keepsake: toKeepsake(closed, nights.length, localDate),
      };
    },

    /** Public keepsake lookup by token (no device required). */
    getKeepsake(token: string, localDate: string): Keepsake | null {
      const j = db.getJourneyByKeepsake(token);
      if (!j) return null;
      const nights = db.listDarkNights(j.id);
      return toKeepsake(j, nights.length, localDate);
    },

    toCard,
  };
}

export type Service = ReturnType<typeof createService>;
