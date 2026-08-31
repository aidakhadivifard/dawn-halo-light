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
  cardActionPrompt,
  darkNightContext,
  dayNumber,
  letterInitial,
  memoryLine,
  returnLine,
  shouldAskStep,
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
      // The sealed letter never leaves the server while the vow is active —
      // only the recipient's initial. Even the writer cannot reread it.
      letter: j.letter_text ? { initial: letterInitial(j.letter_to), sealed: !j.letter_token } : null,
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
      if (!j) return null;

      // Living state: today's step, the paced ask, the rare memory, and the
      // quiet welcome back. Compute the return line BEFORE touching last-seen.
      const welcome = returnLine(j.last_seen_local_date, j.started_local_date, localDate);
      db.touchJourneySeen(j.id, localDate);

      const todayStep = db.stepForDay(j.id, localDate);
      const moves = db.listMoves(j.id);
      const nights = db.listDarkNights(j.id);
      return {
        ...journeyToApi(j, localDate),
        living: {
          todayStep: todayStep
            ? { id: todayStep.id, text: todayStep.text, status: todayStep.status as "committed" | "done" | "not_moved" }
            : null,
          askStep: !todayStep && shouldAskStep(db.recentAskOutcomes(j.id), localDate),
          actionPrompt: cardActionPrompt(j.card_title),
          memory: memoryLine({
            journeyId: j.id,
            todayLocalDate: localDate,
            startedLocalDate: j.started_local_date,
            moves,
            nights,
          }),
          returnLine: welcome,
        },
      };
    },

    // ----- One Small Step ---------------------------------------------------

    /** Commit one small step for today. */
    commitStep(
      deviceId: string,
      localDate: string,
      text: string,
    ):
      | { kind: "crisis"; message: string; resources: typeof CRISIS_RESOURCES.resources }
      | { kind: "no_journey" }
      | { kind: "step"; step: { id: string; text: string; status: "committed" } } {
      const trimmed = (text ?? "").trim().slice(0, 300);
      if (!trimmed) return { kind: "no_journey" }; // treated as bad input upstream
      if (detectCrisis(trimmed).isCrisis) {
        return { kind: "crisis", message: CRISIS_RESOURCES.message, resources: CRISIS_RESOURCES.resources };
      }
      const j = db.activeJourney(deviceId);
      if (!j) return { kind: "no_journey" };
      const existing = db.stepForDay(j.id, localDate);
      if (existing && existing.status === "committed") {
        return { kind: "step", step: { id: existing.id, text: existing.text, status: "committed" } };
      }
      const row = {
        id: newId("step"),
        journey_id: j.id,
        device_id: deviceId,
        text: trimmed,
        local_date: localDate,
        status: "committed",
        created_at: now().toISOString(),
      };
      db.insertVowStep(row);
      return { kind: "step", step: { id: row.id, text: row.text, status: "committed" } };
    },

    /** NOT TODAY — recorded only to pace future asks. Never counted, never shown. */
    declineStep(deviceId: string, localDate: string): { kind: "ok" } | { kind: "no_journey" } {
      const j = db.activeJourney(deviceId);
      if (!j) return { kind: "no_journey" };
      db.insertVowStep({
        id: newId("step"),
        journey_id: j.id,
        device_id: deviceId,
        text: "",
        local_date: localDate,
        status: "declined",
        created_at: now().toISOString(),
      });
      return { kind: "ok" };
    },

    /** Did it move? The witness line, either way, carries no judgment. */
    resolveStep(
      deviceId: string,
      localDate: string,
      done: boolean,
    ): { kind: "no_step" } | { kind: "resolved"; line: string } {
      const j = db.activeJourney(deviceId);
      if (!j) return { kind: "no_step" };
      const step = db.stepForDay(j.id, localDate);
      if (!step || step.status !== "committed") return { kind: "no_step" };
      db.resolveVowStep(step.id, done ? "done" : "not_moved");
      return {
        kind: "resolved",
        line: done ? "It moved today." : "The vow is still here.",
      };
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
      input: { enduring: string; hope: string; letterTo?: string; letterText?: string },
    ): Promise<
      | { kind: "crisis"; message: string; resources: typeof CRISIS_RESOURCES.resources }
      | { kind: "exists"; journey: ReturnType<typeof journeyToApi> }
      | { kind: "invalid" }
      | { kind: "journey"; journey: ReturnType<typeof journeyToApi> }
    > {
      const enduring = (input.enduring ?? "").trim().slice(0, 500);
      const hope = (input.hope ?? "").trim().slice(0, 500);
      // The sealed letter is optional; both parts required for it to exist.
      const letterTo = (input.letterTo ?? "").trim().slice(0, 80);
      const letterText = (input.letterText ?? "").trim().slice(0, 2000);
      const hasLetter = !!(letterTo && letterText);
      if (!enduring || !hope) return { kind: "invalid" };

      // Safety first — every field, before any AI call.
      for (const t of [enduring, hope, letterText]) {
        if (t && detectCrisis(t).isCrisis) {
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
        letter_to: hasLetter ? letterTo : null,
        letter_text: hasLetter ? letterText : null,
        letter_token: null,
        last_seen_local_date: localDate,
        keepsake_views: 0,
        letter_views: 0,
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
      | {
          kind: "closed";
          journey: ReturnType<typeof journeyToApi>;
          keepsake: Keepsake;
          /** Present only when a fulfilled vow unseals its letter. */
          letter: { to: string; text: string; token: string } | null;
          /** True when a released vow's letter was burned unread. */
          letterBurned: boolean;
        } {
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

      // The sealed letter's two fates: unsealed at fulfillment, burned at release.
      let letter: { to: string; text: string; token: string } | null = null;
      let letterBurned = false;
      if (j.letter_text && j.letter_to) {
        if (input.outcome === "fulfilled") {
          const letterToken = `ltr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
          db.unsealLetter(j.id, letterToken);
          letter = { to: j.letter_to, text: j.letter_text, token: letterToken };
        } else {
          db.burnLetter(j.id); // hard delete — no one will ever know
          letterBurned = true;
        }
      }

      const closed = db.getJourney(j.id)!;
      const nights = db.listDarkNights(j.id);
      return {
        kind: "closed",
        journey: journeyToApi(closed, localDate),
        keepsake: toKeepsake(closed, nights.length, localDate),
        letter,
        letterBurned,
      };
    },

    /** Public letter lookup — exists only after a fulfilled vow unsealed it. */
    getLetter(token: string, localDate: string) {
      const j = db.getJourneyByLetter(token);
      if (!j || !j.letter_text || !j.letter_to) return null;
      const nights = db.listDarkNights(j.id);
      return {
        to: j.letter_to,
        text: j.letter_text,
        writtenLocalDate: j.started_local_date,
        keepsake: toKeepsake(j, nights.length, localDate),
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
