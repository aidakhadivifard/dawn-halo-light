// Application service: ties together crisis detection, classification,
// entitlement, AI card generation, illustration selection, and persistence.
// HTTP routes are thin wrappers over this; tests drive it directly.

import type { DB } from "./db";
import type { Card, CardTheme } from "./types";
import { detectCrisis, CRISIS_RESOURCES } from "./lib/crisis";
import { classifyInput } from "./lib/classify";
import { canDraw, snapshot, withinTrial, type QuotaState } from "./lib/entitlement";
import { selectIllustration, NO_REPEAT_WINDOW_DAYS } from "./lib/illustrations";
import { generateCardText, type MessagesClient } from "./lib/anthropic";
import { findHalo } from "./lib/deck";

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
    const halo = findHalo(row.title);
    return {
      id: row.id,
      opener: row.opener,
      title: row.title,
      message: row.message,
      reflection: row.reflection ?? undefined,
      theme: row.theme as CardTheme,
      illustrationId: row.illustration_id,
      element: halo?.element,
      number: halo?.number,
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

      const gen = await generateCardText({ intent: "general" }, { client, timeoutMs });
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
      const gen = await generateCardText({ intent, text }, { client, timeoutMs });
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
        { intent, text, previous: { title: parent.title, message: parent.message } },
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

    toCard,
  };
}

export type Service = ReturnType<typeof createService>;
