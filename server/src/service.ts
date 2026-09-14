// Application service: ties together crisis detection, classification,
// entitlement, AI card generation, illustration selection, and persistence.
// HTTP routes are thin wrappers over this; tests drive it directly.

import type { DB, JourneyRow } from "./db";
import type { Card, CardTheme } from "./types";
import { detectCrisis, CRISIS_RESOURCES } from "./lib/crisis";
import { classifyInput } from "./lib/classify";
import { canDraw, snapshot, withinTrial, type QuotaState } from "./lib/entitlement";
import { selectIllustration, NO_REPEAT_WINDOW_DAYS } from "./lib/illustrations";
import {
  generateCardText,
  generateVowText,
  chooseRoadCard,
  nextTinyStep,
  type MessagesClient,
} from "./lib/anthropic";
import { MAX_RUNGS } from "./lib/tinystep";
import { findCard, fallbackCard as fallbackRoadCard, type RoadCard } from "./lib/roadcards";
import { findHalo } from "./lib/deck";
import { drawHorizon, sketchAvailable, type SketchDeps } from "./lib/sketch";
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
  /** Horizon sketch (Gemini). Inject a fetch/apiKey in tests. */
  sketch?: SketchDeps;
}

/**
 * How many witnessed moments (done steps + hard nights) fully color the
 * horizon sketch. Never shown as a number — the picture is the only readout.
 */
export const SKETCH_FULL_AT = 40;
/** A horizon may be redrawn this many times in total (renames stay cheap). */
export const SKETCH_MAX_DRAWS = 3;

export type DrawResult =
  | { kind: "crisis"; message: string; resources: typeof CRISIS_RESOURCES.resources }
  | { kind: "paywall"; reason: string }
  | { kind: "card"; card: Card };

/**
 * One horizon, at most two roads. A third road is not more devotion — it is
 * the horizon pretending to be a goal. The cap is a product invariant.
 */
export const MAX_ROADS = 2;

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
  const sketchDeps = deps.sketch ?? {};
  /** In-flight sketch generations, so a second request never draws twice. */
  const inflight = new Map<string, Promise<void>>();

  function newToken(prefix: string): string {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  /** The sketch as the client sees it: status, where to load it, how much color is due. */
  function sketchView(deviceId: string) {
    const h = db.getHorizon(deviceId);
    const available = sketchAvailable(sketchDeps);
    if (!h) return { available, status: "none" as const, lineUrl: null, colorUrl: null, lit: 0, fullAt: SKETCH_FULL_AT, stale: false };
    const ready = h.sketch_status === "ready" && !!h.sketch_token;
    return {
      available,
      status: h.sketch_status,
      lineUrl: ready ? `/api/sketch/${h.sketch_token}/line` : null,
      colorUrl: ready ? `/api/sketch/${h.sketch_token}/color` : null,
      // Only the staying is counted — done steps and nights stayed through.
      lit: Math.min(SKETCH_FULL_AT, db.countStaying(deviceId)),
      fullAt: SKETCH_FULL_AT,
      stale: ready && h.sketch_for_text !== h.text,
    };
  }

  /**
   * Draw (or redraw) the horizon in the background. Idempotent: a pending or
   * up-to-date sketch is left alone. Returns the resulting status.
   */
  function requestSketch(deviceId: string): "none" | "pending" | "ready" | "failed" | "unavailable" | "capped" {
    const h = db.getHorizon(deviceId);
    if (!h) return "none";
    if (!sketchAvailable(sketchDeps)) return "unavailable";
    if (h.sketch_status === "pending" || inflight.has(deviceId)) return "pending";
    if (h.sketch_status === "ready" && h.sketch_for_text === h.text) return "ready";
    if (h.sketch_draws >= SKETCH_MAX_DRAWS) return h.sketch_status === "ready" ? "capped" : "failed";

    const token = h.sketch_token ?? newToken("sk");
    const text = h.text;
    db.setSketchStatus({ deviceId, status: "pending", token, error: null });
    db.bumpSketchDraws(deviceId);
    const job = drawHorizon(text, sketchDeps)
      .then(({ line, color }) => {
        db.putSketch(deviceId, "line", line.mime, line.bytes);
        db.putSketch(deviceId, "color", color.mime, color.bytes);
        db.setSketchStatus({ deviceId, status: "ready", token, error: null, forText: text });
      })
      .catch((err: any) => {
        // A failed redraw keeps the old pictures; a failed first draw shows none.
        const had = !!db.getSketch(deviceId, "line");
        db.setSketchStatus({ deviceId, status: had ? "ready" : "failed", error: String(err?.message ?? err).slice(0, 200) });
      })
      .finally(() => inflight.delete(deviceId));
    inflight.set(deviceId, job);
    return "pending";
  }

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
      horizon: db.getHorizon(deviceId)?.text ?? null,
    };
  }

  /**
   * Resolve which road (active vow) an action is about. With one road the id
   * is optional; with two it must be given and must belong to this device.
   */
  function resolveJourney(deviceId: string, journeyId?: string | null): JourneyRow | undefined {
    const active = db.activeJourneys(deviceId);
    if (journeyId) return active.find((j) => j.id === journeyId);
    return active[0];
  }

  function journeyToApi(j: JourneyRow, localDate: string) {
    const nights = db.listDarkNights(j.id);
    return {
      id: j.id,
      label: j.label ?? null,
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

  /**
   * A road with its living state: today's step, the paced ask, the rare
   * memory, and the quiet welcome back. Computes the return line BEFORE
   * touching last-seen, so absence is noticed once and never counted.
   */
  function livingJourney(j: JourneyRow, localDate: string) {
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
    getJourney(deviceId: string, localDate: string, journeyId?: string | null) {
      db.getOrCreateDevice(deviceId);
      const j = resolveJourney(deviceId, journeyId);
      if (!j) return null;
      return livingJourney(j, localDate);
    },

    // ----- Horizon & Roads --------------------------------------------------

    /**
     * The home screen in one call: the horizon (the life they are walking
     * toward — never measured, never a goal) and up to MAX_ROADS active roads.
     */
    getHome(deviceId: string, localDate: string) {
      db.getOrCreateDevice(deviceId);
      const h = db.getHorizon(deviceId);
      const horizon = h?.text ?? null;
      const roads = db.activeJourneys(deviceId).map((j) => livingJourney(j, localDate));
      const card = findCard(h?.card_id);
      const today = h ? db.deedsOn(deviceId, localDate) : [];
      return {
        horizon,
        // The wish is sealed the moment the card is drawn; the client hides edit.
        sealed: !!h?.card_id,
        card: card ? { id: card.id, name: card.name, line: card.line } : null,
        // Today's answer, if it has already been given. Both kinds count the same.
        todayDeed: today[0]
          ? { id: today[0].id, kind: today[0].kind, text: today[0].text }
          : null,
        roads,
        maxRoads: MAX_ROADS,
        sketch: sketchView(deviceId),
      };
    },

    // ----- The horizon sketch -----------------------------------------------

    /** Ask for the drawing (idempotent). The picture arrives via getHome().sketch. */
    requestSketch(deviceId: string) {
      db.getOrCreateDevice(deviceId);
      return { status: requestSketch(deviceId), sketch: sketchView(deviceId) };
    },

    /** Public image lookup by token — the only way an <img> can reach it. */
    getSketchImage(token: string, kind: "line" | "color") {
      const h = db.getHorizonByToken(token);
      if (!h || h.sketch_status !== "ready") return null;
      return db.getSketch(h.device_id, kind) ?? null;
    },

    /** Tests await this so the background job has settled. */
    sketchSettled(deviceId: string): Promise<void> {
      return inflight.get(deviceId) ?? Promise.resolve();
    },

    getHorizon(deviceId: string): string | null {
      return db.getHorizon(deviceId)?.text ?? null;
    },

    /** Name (or rename) the horizon. Crisis-checked; never counted anywhere. */
    setHorizon(
      deviceId: string,
      text: string,
    ):
      | { kind: "crisis"; message: string; resources: typeof CRISIS_RESOURCES.resources }
      | { kind: "invalid" }
      | { kind: "sealed" }
      | { kind: "horizon"; horizon: string } {
      const trimmed = (text ?? "").trim().slice(0, 500);
      if (!trimmed) return { kind: "invalid" };
      // Once the card has been drawn the words are sealed — forever.
      if (db.getHorizon(deviceId)?.card_id) return { kind: "sealed" };
      if (detectCrisis(trimmed).isCrisis) {
        return { kind: "crisis", message: CRISIS_RESOURCES.message, resources: CRISIS_RESOURCES.resources };
      }
      db.getOrCreateDevice(deviceId);
      db.setHorizon(deviceId, trimmed);
      // Draw it — in the background, only if the words changed, only if we can.
      requestSketch(deviceId);
      return { kind: "horizon", horizon: trimmed };
    },

    // ----- The road card ----------------------------------------------------

    /**
     * Draw the ONE road card for the wish. Every card says the wish CAN happen;
     * they differ only in the shape of the road. Drawing it SEALS the words —
     * from this moment the wish can never be edited, and its picture is drawn
     * from these words forever. Drawn once: asking again returns the same card.
     */
    async drawRoadCard(deviceId: string): Promise<
      { kind: "no_horizon" } | { kind: "card"; card: RoadCard; sealed: true; alreadyDrawn: boolean }
    > {
      db.getOrCreateDevice(deviceId);
      const h = db.getHorizon(deviceId);
      if (!h) return { kind: "no_horizon" };

      const existing = findCard(h.card_id);
      if (existing) return { kind: "card", card: existing, sealed: true, alreadyDrawn: true };

      const { id } = await chooseRoadCard(h.text, { client, timeoutMs });
      const card = findCard(id) ?? fallbackRoadCard(h.text);
      db.setCard(deviceId, card.id, now().toISOString());
      // The wish is sealed — make sure its picture exists.
      requestSketch(deviceId);
      return { kind: "card", card, sealed: true, alreadyDrawn: false };
    },

    // ----- The deeds (what I did today for my wish) -------------------------

    /**
     * Record today's deed. Two kinds, and they count EXACTLY the same: 'did'
     * (a small act, with words) and 'stayed' (endured and kept going). There is
     * no better answer. Every deed brings a little more color into the picture.
     */
    recordDeed(
      deviceId: string,
      localDate: string,
      kind: "did" | "stayed",
      text?: string | null,
    ):
      | { kind: "crisis"; message: string; resources: typeof CRISIS_RESOURCES.resources }
      | { kind: "invalid" }
      | { kind: "deed"; deed: { id: string; kind: "did" | "stayed"; text: string | null; localDate: string } } {
      if (kind !== "did" && kind !== "stayed") return { kind: "invalid" };
      const trimmed = (text ?? "").trim().slice(0, 500) || null;
      if (kind === "did" && !trimmed) return { kind: "invalid" };
      if (trimmed && detectCrisis(trimmed).isCrisis) {
        return { kind: "crisis", message: CRISIS_RESOURCES.message, resources: CRISIS_RESOURCES.resources };
      }
      db.getOrCreateDevice(deviceId);
      const row = {
        id: newId("deed"),
        device_id: deviceId,
        kind,
        text: trimmed,
        local_date: localDate,
        created_at: now().toISOString(),
      } as const;
      db.insertDeed(row);
      return { kind: "deed", deed: { id: row.id, kind, text: trimmed, localDate } };
    },

    /**
     * One more, smaller. Built only from the wish and what they already said
     * they did — never from anything we assumed. Returns null when there is no
     * model (we offer nothing rather than invent), when today's answer hasn't
     * been given yet, or once the ladder has run its length: at some point the
     * honest thing is to stop asking.
     */
    async nextTinyStep(deviceId: string, localDate: string): Promise<string | null> {
      const h = db.getHorizon(deviceId);
      if (!h) return null;
      // Oldest first: their own answer, then each rung they've taken since.
      const todays = db.deedsOn(deviceId, localDate).slice().reverse();
      const first = todays.find((d) => d.kind === "did" && d.text);
      if (!first?.text) return null;
      const done = todays.filter((d) => d.id !== first.id && d.text).map((d) => d.text as string);
      if (done.length >= MAX_RUNGS) return null;
      return nextTinyStep({ wish: h.text, today: first.text, done }, { client, timeoutMs });
    },

    /** The deeds so far, newest first — the wish book's spine. */
    listDeeds(deviceId: string, limit = 60) {
      return db.listDeeds(deviceId, limit).map((d) => ({
        id: d.id,
        kind: d.kind,
        text: d.text,
        localDate: d.local_date,
        createdAt: d.created_at,
      }));
    },

    // ----- One Small Step ---------------------------------------------------

    /** Commit one small step for today. */
    commitStep(
      deviceId: string,
      localDate: string,
      text: string,
      journeyId?: string | null,
    ):
      | { kind: "crisis"; message: string; resources: typeof CRISIS_RESOURCES.resources }
      | { kind: "no_journey" }
      | { kind: "step"; step: { id: string; text: string; status: "committed" } } {
      const trimmed = (text ?? "").trim().slice(0, 300);
      if (!trimmed) return { kind: "no_journey" }; // treated as bad input upstream
      if (detectCrisis(trimmed).isCrisis) {
        return { kind: "crisis", message: CRISIS_RESOURCES.message, resources: CRISIS_RESOURCES.resources };
      }
      const j = resolveJourney(deviceId, journeyId);
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
    declineStep(
      deviceId: string,
      localDate: string,
      journeyId?: string | null,
    ): { kind: "ok" } | { kind: "no_journey" } {
      const j = resolveJourney(deviceId, journeyId);
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
      journeyId?: string | null,
    ): { kind: "no_step" } | { kind: "resolved"; line: string } {
      const j = resolveJourney(deviceId, journeyId);
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
     * Make a vow — open a road: crisis-check every text, then draw ONE card.
     * Refuses when MAX_ROADS roads are already active — a road is never quietly
     * replaced, and the horizon is never allowed to become a third goal.
     */
    async createJourney(
      deviceId: string,
      localDate: string,
      input: { enduring: string; hope: string; label?: string; letterTo?: string; letterText?: string },
    ): Promise<
      | { kind: "crisis"; message: string; resources: typeof CRISIS_RESOURCES.resources }
      | { kind: "limit"; roads: ReturnType<typeof journeyToApi>[]; maxRoads: number }
      | { kind: "invalid" }
      | { kind: "journey"; journey: ReturnType<typeof journeyToApi> }
    > {
      const enduring = (input.enduring ?? "").trim().slice(0, 500);
      const hope = (input.hope ?? "").trim().slice(0, 500);
      const label = (input.label ?? "").trim().slice(0, 40) || null;
      // The sealed letter is optional; both parts required for it to exist.
      const letterTo = (input.letterTo ?? "").trim().slice(0, 80);
      const letterText = (input.letterText ?? "").trim().slice(0, 2000);
      const hasLetter = !!(letterTo && letterText);
      if (!enduring || !hope) return { kind: "invalid" };

      // Safety first — every field, before any AI call.
      for (const t of [enduring, hope, label ?? "", letterText]) {
        if (t && detectCrisis(t).isCrisis) {
          return {
            kind: "crisis",
            message: CRISIS_RESOURCES.message,
            resources: CRISIS_RESOURCES.resources,
          };
        }
      }

      db.getOrCreateDevice(deviceId);
      const active = db.activeJourneys(deviceId);
      if (active.length >= MAX_ROADS) {
        return { kind: "limit", roads: active.map((j) => journeyToApi(j, localDate)), maxRoads: MAX_ROADS };
      }

      const horizon = db.getHorizon(deviceId)?.text ?? null;
      const gen = await generateVowText({ enduring, hope, horizon }, { client, timeoutMs });
      const essence = findHalo(gen.title)?.essence ?? "";
      const illustrationId = selectIllustration(gen.theme, recentIds(deviceId, gen.theme));
      const row: JourneyRow = {
        id: newId("vow"),
        device_id: deviceId,
        label,
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
      journeyId?: string | null,
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
      const j = resolveJourney(deviceId, journeyId);
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
      input: { outcome: "fulfilled" | "released"; note?: string; journeyId?: string | null },
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
      const j = resolveJourney(deviceId, input.journeyId);
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
