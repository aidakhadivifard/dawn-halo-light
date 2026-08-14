// Application service: ties together crisis detection, classification,
// entitlement, AI card generation, illustration selection, and persistence.
// HTTP routes are thin wrappers over this; tests drive it directly.

import type { DB, GoalRow } from "./db";
import type { Card, CardTheme } from "./types";
import { detectCrisis, CRISIS_RESOURCES } from "./lib/crisis";
import { classifyInput } from "./lib/classify";
import { detectEnduranceSeed } from "./lib/endurance";
import { canDraw, snapshot, withinTrial, type QuotaState } from "./lib/entitlement";
import { selectIllustration, NO_REPEAT_WINDOW_DAYS } from "./lib/illustrations";
import { generateCardText, generateFollowUpAnswer, type MessagesClient } from "./lib/anthropic";
import { HALO_DECK, type HaloCard } from "./lib/deck";
import { buildReadingContext } from "./lib/readingContext";
import { generateReflection } from "./lib/reflect";
import { copyRuleViolations } from "./lib/copyrule";
import { benchmarkForDay, type BenchmarkLine } from "./lib/benchmarks";
import { computeStreak } from "./lib/streak";
import {
  daysSince,
  totalDays,
  progress,
  milestoneFor,
  lowStateRun,
  honestyDue,
  CHECKIN_STATES,
  type CheckinState,
  type MilestoneId,
} from "./lib/keepgoing";
import {
  ACK,
  HONESTY_OFFER,
  HONESTY_PROMPT,
  HONESTY_DONE_HEADING,
  GOAL_COMPLETED_HEADING,
  MILESTONE_MESSAGES,
} from "./lib/keepgoing-copy";

export interface ServiceDeps {
  client?: MessagesClient | null;
  now?: () => Date;
  timeoutMs?: number;
}

export type DrawResult =
  | { kind: "crisis"; message: string; resources: typeof CRISIS_RESOURCES.resources }
  | { kind: "paywall"; reason: string }
  | {
      kind: "card";
      card: Card;
      /**
       * The user's own words when their question was really about enduring
       * something and they have no goal yet — the reading may end with
       * "give it a day count", prefilled with this seed.
       */
      goalSeed?: string;
      /**
       * Follow-ups only: the same card's short plain answer. New clients
       * render this as a continuation; the card object keeps old clients whole.
       */
      answer?: string;
    };

export interface GoalPayload {
  id: string;
  title: string;
  reward: string;
  startDate: string;
  targetDate: string;
  photoUrl?: string;
  ritual: "card" | "writing";
  status: string;
  createdAt: string;
}

export interface GoalStatusPayload {
  goal: GoalPayload;
  day: number;
  totalDays: number;
  progress: number;
  streak: number;
  /** Total check-ins — "You have returned N times", never "you missed X days". */
  checkinCount: number;
  checkedInToday: boolean;
  todayState: CheckinState | null;
  ritualDoneToday: boolean;
  benchmark: BenchmarkLine | null;
  honestyDue: boolean;
  honestyPrompt: string;
  /** A witness invite exists for this device. */
  hasWitness: boolean;
  /** The witness opened their page today (their local ISO date ≈ ours). */
  witnessSawToday: boolean;
}

export interface CheckinPayload {
  already: boolean;
  day: number;
  streak: number;
  state: CheckinState;
  ack: string;
  benchmark: BenchmarkLine | null;
  offerRitual: boolean;
  suggestedRitual: "card" | "writing";
  offerHonesty: boolean;
  honestyDue: boolean;
  honestyOffer?: string;
  milestone: { id: MilestoneId; message: string } | null;
  summary?: GoalSummary;
  /** Two+ hard days in a row and no witness yet — the oracle may suggest one. */
  suggestWitness: boolean;
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
  /** What they wrote along the way — check-in notes + writing-ritual texts. */
  notes: string[];
  heading: string;
  outcome: "completed" | "abandoned";
}

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
    keep_line?: string | null;
    lean?: string | null;
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
      keepLine: row.keep_line ?? undefined,
      lean: row.lean ?? undefined,
      theme: row.theme as CardTheme,
      illustrationId: row.illustration_id,
      createdAt: row.created_at,
      fallback: !!row.fallback,
      followUpUsed: !!row.follow_up_used,
    };
  }

  /**
   * Reflection is for readers who write (decision: the question only appears
   * once they have opened that door themselves — a writing ritual, a heavy-day
   * note, or choosing writing as their ritual). Everyone else ends on the
   * keep-line, clean.
   */
  function isWriter(deviceId: string): boolean {
    const goal = db.getActiveGoal(deviceId);
    if (!goal) return false;
    if (goal.ritual === "writing") return true;
    if (db.listRitualEntries(goal.id).some((e) => e.user_text)) return true;
    return db.listCheckins(goal.id).some((c) => c.note);
  }

  /**
   * Quota for goal-layer premium gates: identical to the card quota, except a
   * device's goal check-in days also count as active days, so a checkin-only
   * user still ages out of the 14-day trial.
   */
  function ritualQuota(deviceId: string, localDate: string): QuotaState {
    const base = quotaState(deviceId, localDate);
    // countCheckinDays includes today once checked in, but QuotaState's
    // activeDays semantics exclude a today that has no draw yet (entitlement
    // adds it back via effectiveActiveDays) — subtract today to avoid
    // double-counting it.
    const checkinDays =
      db.countCheckinDays(deviceId) - (db.hasCheckinOn(deviceId, localDate) ? 1 : 0);
    return { ...base, activeDays: Math.max(base.activeDays, checkinDays) };
  }

  /**
   * The Reading Engine payload (spec §3.7): goal, recent check-ins, the
   * reader's own written words, honesty answers, nearby milestones — plus the
   * engine's rules. Undefined when no active goal (general reading, that day
   * only).
   */
  function activeGoalContext(deviceId: string, localDate: string): string | undefined {
    return buildReadingContext(db, deviceId, localDate);
  }

  function toGoal(row: GoalRow): GoalPayload {
    return {
      id: row.id,
      title: row.title,
      reward: row.reward,
      startDate: row.start_date,
      targetDate: row.target_date,
      photoUrl: row.photo_url ?? undefined,
      ritual: row.ritual === "writing" ? "writing" : "card",
      status: row.status,
      createdAt: row.created_at,
    };
  }

  function buildStatus(goal: GoalRow, localDate: string): GoalStatusPayload {
    const day = daysSince(goal.start_date, localDate);
    const checkins = db.listCheckins(goal.id);
    const today = db.getCheckin(goal.id, localDate);
    const lastHonesty = db.lastHonesty(goal.id);
    const invite = db.getWitnessInviteForDevice(goal.device_id);
    return {
      hasWitness: !!invite,
      witnessSawToday: (invite?.last_seen_at ?? "").slice(0, 10) === localDate,
      goal: toGoal(goal),
      day,
      totalDays: totalDays(goal.start_date, goal.target_date),
      progress: progress(goal.start_date, goal.target_date, localDate),
      streak: computeStreak(checkins.map((c) => c.local_date), localDate),
      checkinCount: checkins.length,
      checkedInToday: !!today,
      todayState: (today?.state as CheckinState) ?? null,
      ritualDoneToday: today ? !!db.getRitualForCheckin(today.id) : false,
      benchmark: benchmarkForDay(day),
      honestyDue: honestyDue({
        day,
        lastHonestyDay: lastHonesty?.day_number ?? null,
        lowRun: lowStateRun(checkins, localDate),
      }),
      honestyPrompt: HONESTY_PROMPT(Math.min(day, 21)),
    };
  }

  function buildSummary(
    goal: GoalRow,
    localDate: string,
    outcome: "completed" | "abandoned",
  ): GoalSummary {
    const checkins = db.listCheckins(goal.id);
    const rituals = db.listRitualEntries(goal.id);
    const daysHeld = daysSince(goal.start_date, localDate);
    const stateCounts = { strong: 0, barely: 0, cant: 0, exhausted: 0 } as Record<
      CheckinState,
      number
    >;
    for (const c of checkins) {
      if (c.state in stateCounts) stateCounts[c.state as CheckinState] += 1;
    }
    const notes = [
      ...checkins.filter((c) => c.note).map((c) => c.note!),
      ...rituals.filter((r) => r.user_text).map((r) => r.user_text!),
    ];
    return {
      title: goal.title,
      reward: goal.reward,
      startDate: goal.start_date,
      targetDate: goal.target_date,
      endDate: localDate,
      daysHeld,
      checkinCount: checkins.length,
      stateCounts,
      notes,
      heading:
        outcome === "completed"
          ? GOAL_COMPLETED_HEADING(daysHeld)
          : HONESTY_DONE_HEADING(daysHeld),
      outcome,
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

      // The SERVER cuts the deck for the daily card — deterministic per
      // device+day, skipping this device's last 10 daily titles so the deck
      // visibly rotates. (Letting the model choose repeated one title daily.)
      const recentTitles = new Set(
        db
          .history(deviceId, 60)
          .filter((d) => d.type === "daily")
          .slice(0, 10)
          .map((d) => d.title),
      );
      const pool = HALO_DECK.filter((c) => !recentTitles.has(c.title));
      const drawPool = pool.length ? pool : HALO_DECK;
      const seed = `${deviceId}:${localDate}`;
      let h = 0;
      for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
      const drawn: HaloCard = drawPool[Math.abs(h) % drawPool.length];
      console.log(
        `[daily] pool=${drawPool.length}/${HALO_DECK.length} drawn="${drawn.title}" date=${localDate}`,
      );

      const goalContext = activeGoalContext(deviceId, localDate);
      let gen = await generateCardText(
        { intent: "general", goalContext, forcedCard: drawn },
        { client, timeoutMs },
      );
      if (goalContext && copyRuleViolations(gen.message).length > 0) {
        gen = await generateCardText({ intent: "general", forcedCard: drawn }, { client: null });
      }
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
        reflection: isWriter(deviceId) ? gen.reflection || null : null,
        keep_line: gen.keepLine || null,
        lean: gen.lean || null,
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
      const goalContext = activeGoalContext(deviceId, localDate);
      let gen = await generateCardText({ intent, text, goalContext }, { client, timeoutMs });
      if (goalContext && copyRuleViolations(gen.message).length > 0) {
        gen = await generateCardText({ intent, text }, { client: null });
      }
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
        reflection: isWriter(deviceId) ? gen.reflection || null : null,
        keep_line: gen.keepLine || null,
        lean: gen.lean || null,
        prompt: text || null,
        parent_id: null,
        fallback: gen.fallback ? 1 : 0,
        created_at: now().toISOString(),
      };
      db.insertDraw(row);
      // The oracle notices the goal inside the question: no active goal +
      // endurance-shaped text → the reading may end with "Begin Day 1".
      const goalSeed = goalContext ? null : detectEnduranceSeed(text);
      return { kind: "card", card: toCard(row), ...(goalSeed ? { goalSeed } : {}) };
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

      // The SAME card answers — no second card, no ceremony. One or two plain
      // sentences; imagery stays in the reading. The row keeps the parent's
      // identity so history shows the answer under the same card.
      const gen = await generateFollowUpAnswer(
        { text, previous: { title: parent.title, message: parent.message } },
        { client, timeoutMs },
      );
      const row = {
        id: newId("follow"),
        device_id: deviceId,
        local_date: localDate,
        type: "followup",
        theme: parent.theme,
        illustration_id: parent.illustration_id,
        opener: "",
        title: parent.title,
        message: gen.answer,
        reflection: null,
        keep_line: null,
        lean: null,
        prompt: text || null,
        parent_id: parent.id,
        fallback: gen.fallback ? 1 : 0,
        created_at: now().toISOString(),
      };
      db.insertDraw(row);
      db.markFollowUpUsed(parent.id);
      // `answer` is the new contract; the card object keeps old clients whole.
      return { kind: "card", card: { ...toCard(row), followUpUsed: true }, answer: gen.answer };
    },

    // ------------------------------------------------------------------
    // Endurance-goal layer ("what you're holding on for")
    // ------------------------------------------------------------------

    goalStatus(deviceId: string, localDate: string): GoalStatusPayload | null {
      db.getOrCreateDevice(deviceId);
      const goal = db.getActiveGoal(deviceId);
      if (!goal) return null;
      return buildStatus(goal, localDate);
    },

    createGoal(
      deviceId: string,
      localDate: string,
      input: { title: string; reward: string; targetDate: string; photoUrl?: string; ritual?: string },
    ):
      | { kind: "exists" }
      | { kind: "invalid"; reason: string }
      | { kind: "goal"; status: GoalStatusPayload } {
      db.getOrCreateDevice(deviceId);
      if (db.getActiveGoal(deviceId)) return { kind: "exists" };
      const title = (input.title ?? "").trim().slice(0, 120);
      const reward = (input.reward ?? "").trim().slice(0, 200);
      const targetDate = (input.targetDate ?? "").trim();
      if (!title) return { kind: "invalid", reason: "missing_title" };
      if (!reward) return { kind: "invalid", reason: "missing_reward" };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate) || targetDate <= localDate) {
        return { kind: "invalid", reason: "target_date_must_be_future" };
      }
      const row = {
        id: newId("goal"),
        device_id: deviceId,
        title,
        reward,
        start_date: localDate,
        target_date: targetDate,
        photo_url: input.photoUrl?.slice(0, 500) ?? null,
        ritual: input.ritual === "writing" ? "writing" : "card",
        created_at: now().toISOString(),
      };
      db.insertGoal(row);
      return { kind: "goal", status: buildStatus(db.getGoal(row.id)!, localDate) };
    },

    /** Title / photo / ritual only — the target date is LOCKED after creation. */
    updateGoal(
      deviceId: string,
      input: { title?: string; photoUrl?: string | null; ritual?: string },
    ): { kind: "no_goal" } | { kind: "ok" } {
      const goal = db.getActiveGoal(deviceId);
      if (!goal) return { kind: "no_goal" };
      const title = (input.title ?? goal.title).trim().slice(0, 120) || goal.title;
      const photoUrl =
        input.photoUrl === undefined ? goal.photo_url : input.photoUrl?.slice(0, 500) ?? null;
      const ritual =
        input.ritual === "card" || input.ritual === "writing" ? input.ritual : goal.ritual;
      db.updateGoalMeta(goal.id, title, photoUrl, ritual);
      return { kind: "ok" };
    },

    /**
     * Close the goal. "completed" needs the target date to have arrived;
     * "abandoned" is a deliberate stop — a decision, not a failure.
     */
    closeGoal(
      deviceId: string,
      localDate: string,
      reason: "completed" | "abandoned",
    ):
      | { kind: "no_goal" }
      | { kind: "target_not_reached" }
      | { kind: "closed"; summary: GoalSummary } {
      const goal = db.getActiveGoal(deviceId);
      if (!goal) return { kind: "no_goal" };
      if (reason === "completed" && localDate < goal.target_date) {
        return { kind: "target_not_reached" };
      }
      db.setGoalStatus(goal.id, reason, now().toISOString());
      return { kind: "closed", summary: buildSummary(goal, localDate, reason) };
    },

    /**
     * The daily check-in. Idempotent per local day (DB unique index). The
     * response ADAPTS to the emotional state — see keepgoing-copy.ts.
     */
    checkin(
      deviceId: string,
      localDate: string,
      input: { state: string; note?: string },
    ):
      | { kind: "crisis"; message: string; resources: typeof CRISIS_RESOURCES.resources }
      | { kind: "no_goal" }
      | { kind: "invalid"; reason: string }
      | { kind: "checkin"; payload: CheckinPayload } {
      const note = (input.note ?? "").trim().slice(0, 500);

      // Safety first — crisis check BEFORE anything else. On a match: no day
      // count, no motivational framing, only the existing resources flow.
      if (note && detectCrisis(note).isCrisis) {
        return {
          kind: "crisis",
          message: CRISIS_RESOURCES.message,
          resources: CRISIS_RESOURCES.resources,
        };
      }

      const goal = db.getActiveGoal(deviceId);
      if (!goal) return { kind: "no_goal" };
      const state = input.state as CheckinState;
      if (!CHECKIN_STATES.includes(state)) return { kind: "invalid", reason: "invalid_state" };

      let already = false;
      const existing = db.getCheckin(goal.id, localDate);
      if (existing) {
        already = true;
      } else {
        try {
          db.insertCheckin({
            id: newId("chk"),
            goal_id: goal.id,
            device_id: deviceId,
            local_date: localDate,
            state,
            note: note || null,
            created_at: now().toISOString(),
          });
        } catch {
          already = true; // unique(goal_id, local_date) raced — day already counted
        }
      }
      const effective = db.getCheckin(goal.id, localDate)!;
      const effState = effective.state as CheckinState;
      const day = daysSince(goal.start_date, localDate);
      const checkins = db.listCheckins(goal.id);
      const streak = computeStreak(checkins.map((c) => c.local_date), localDate);

      // Gentlest mode (cant): no benchmark, no celebration, honesty offered.
      const gentle = effState === "cant";
      const support = effState === "barely" || effState === "exhausted";
      const milestoneId = gentle ? null : milestoneFor(goal.start_date, goal.target_date, localDate);
      const lastHonesty = db.lastHonesty(goal.id);
      const due = honestyDue({
        day,
        lastHonestyDay: lastHonesty?.day_number ?? null,
        lowRun: lowStateRun(checkins, localDate),
      });

      let summary: GoalSummary | undefined;
      if (milestoneId === "target") {
        db.setGoalStatus(goal.id, "completed", now().toISOString());
        summary = buildSummary(goal, localDate, "completed");
      }

      return {
        kind: "checkin",
        payload: {
          already,
          day,
          streak,
          state: effState,
          ack: ACK[effState](day),
          benchmark: support ? benchmarkForDay(day) : null,
          offerRitual: support || gentle,
          suggestedRitual: gentle ? "writing" : (goal.ritual as "card" | "writing"),
          offerHonesty: gentle || due,
          honestyDue: due,
          honestyOffer: gentle ? HONESTY_OFFER : undefined,
          milestone: milestoneId
            ? { id: milestoneId, message: MILESTONE_MESSAGES[milestoneId](day) }
            : null,
          summary,
          suggestWitness:
            (support || gentle) &&
            lowStateRun(checkins, localDate) >= 2 &&
            !db.getWitnessInviteForDevice(deviceId),
        },
      };
    },

    /** The daily ritual (premium): pull a card or write it out. */
    async ritual(
      deviceId: string,
      localDate: string,
      input: { type: string; text?: string },
    ): Promise<
      | { kind: "crisis"; message: string; resources: typeof CRISIS_RESOURCES.resources }
      | { kind: "no_goal" }
      | { kind: "no_checkin" }
      | { kind: "already_done" }
      | { kind: "invalid"; reason: string }
      | { kind: "paywall"; reason: string }
      | { kind: "card"; card: Card }
      | { kind: "reflection"; reflection: string; fallback: boolean }
    > {
      const text = (input.text ?? "").trim();
      if (text && detectCrisis(text).isCrisis) {
        return {
          kind: "crisis",
          message: CRISIS_RESOURCES.message,
          resources: CRISIS_RESOURCES.resources,
        };
      }

      const goal = db.getActiveGoal(deviceId);
      if (!goal) return { kind: "no_goal" };
      const checkin = db.getCheckin(goal.id, localDate);
      if (!checkin) return { kind: "no_checkin" };
      if (db.getRitualForCheckin(checkin.id)) return { kind: "already_done" };

      // Premium gate — same subscription infra; goal check-in days count as
      // active days so a checkin-only user still ages out of the trial.
      const state = ritualQuota(deviceId, localDate);
      if (!state.subscribed && !withinTrial(state)) {
        return { kind: "paywall", reason: "trial_over" };
      }

      const day = daysSince(goal.start_date, localDate);
      const type = input.type === "writing" ? "writing" : "card";

      if (type === "card") {
        const decision = canDraw("prompted", state);
        if (!decision.allowed) return { kind: "paywall", reason: decision.reason };
        const genInput = {
          intent: "general" as const,
          goalContext: buildReadingContext(db, deviceId, localDate),
        };
        let gen = await generateCardText(genInput, { client, timeoutMs });
        // The Copy Rule lint runs on every goal-aware AI line before display.
        if (copyRuleViolations(gen.message).length > 0) {
          gen = await generateCardText(genInput, { client: null });
        }
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
          reflection: isWriter(deviceId) ? gen.reflection || null : null,
          keep_line: gen.keepLine || null,
          lean: gen.lean || null,
          prompt: null,
          parent_id: null,
          fallback: gen.fallback ? 1 : 0,
          created_at: now().toISOString(),
        };
        db.insertDraw(row);
        db.insertRitualEntry({
          id: newId("rit"),
          checkin_id: checkin.id,
          goal_id: goal.id,
          device_id: deviceId,
          local_date: localDate,
          type,
          card_id: row.id,
          user_text: null,
          ai_reflection: null,
          created_at: now().toISOString(),
        });
        return { kind: "card", card: toCard(row) };
      }

      if (!text) return { kind: "invalid", reason: "missing_text" };
      const result = await generateReflection(
        {
          goalTitle: goal.title,
          reward: goal.reward,
          day,
          state: checkin.state as CheckinState,
          text,
          context: buildReadingContext(db, deviceId, localDate),
        },
        { client, timeoutMs },
      );
      db.insertRitualEntry({
        id: newId("rit"),
        checkin_id: checkin.id,
        goal_id: goal.id,
        device_id: deviceId,
        local_date: localDate,
        type,
        card_id: null,
        user_text: text.slice(0, 2000),
        ai_reflection: result.reflection,
        created_at: now().toISOString(),
      });
      return { kind: "reflection", reflection: result.reflection, fallback: result.fallback };
    },

    /**
     * Log an honesty-check answer. Four honest positions: continue clearly,
     * continue but adjust the method, unsure, done. Only "done" closes the
     * goal (with respect); the rest never push perseverance.
     */
    honesty(
      deviceId: string,
      localDate: string,
      answer: string,
      note?: string,
    ):
      | { kind: "no_goal" }
      | { kind: "invalid"; reason: string }
      | { kind: "ok"; summary?: GoalSummary } {
      const goal = db.getActiveGoal(deviceId);
      if (!goal) return { kind: "no_goal" };
      if (
        answer !== "continue" &&
        answer !== "adjust" &&
        answer !== "thinking" &&
        answer !== "done"
      ) {
        return { kind: "invalid", reason: "invalid_answer" };
      }
      const day = daysSince(goal.start_date, localDate);
      db.insertHonesty({
        id: newId("hon"),
        goal_id: goal.id,
        device_id: deviceId,
        local_date: localDate,
        day_number: day,
        answer,
        note: (note ?? "").trim().slice(0, 500) || null,
        created_at: now().toISOString(),
      });
      if (answer === "done") {
        db.setGoalStatus(goal.id, "abandoned", now().toISOString());
        return { kind: "ok", summary: buildSummary(goal, localDate, "abandoned") };
      }
      return { kind: "ok" };
    },

    /** The journal/history view (premium). */
    goalHistory(
      deviceId: string,
      localDate: string,
    ):
      | { kind: "no_goal" }
      | { kind: "paywall"; reason: string }
      | { kind: "history"; checkins: any[]; entries: any[]; honesty: any[] } {
      const goal = db.getActiveGoal(deviceId);
      if (!goal) return { kind: "no_goal" };
      const state = ritualQuota(deviceId, localDate);
      if (!state.subscribed && !withinTrial(state)) {
        return { kind: "paywall", reason: "trial_over" };
      }
      return {
        kind: "history",
        checkins: db.listCheckins(goal.id).map((c) => ({
          id: c.id,
          date: c.local_date,
          state: c.state,
          note: c.note ?? undefined,
        })),
        entries: db.listRitualEntries(goal.id).map((e) => ({
          id: e.id,
          date: e.local_date,
          type: e.type,
          cardId: e.card_id ?? undefined,
          userText: e.user_text ?? undefined,
          aiReflection: e.ai_reflection ?? undefined,
        })),
        honesty: db.listHonesty(goal.id).map((h) => ({
          id: h.id,
          date: h.local_date,
          day: h.day_number,
          answer: h.answer,
          note: h.note ?? undefined,
        })),
      };
    },

    /**
     * The Witness: one chosen person who sees the Day number — nothing else.
     * The invite link is the growth loop's cheapest killer test (does the
     * holder send it at all?), so it must work in a plain browser tab.
     */
    createWitnessInvite(deviceId: string): { token: string } | null {
      const goal = db.getActiveGoal(deviceId);
      if (!goal) return null;
      const existing = db.getWitnessInviteForDevice(deviceId);
      if (existing) return { token: existing.token };
      const token = `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      db.putWitnessInvite({ token, device_id: deviceId, created_at: now().toISOString() });
      return { token };
    },

    /**
     * The heavy-day signal: the holder lets their witness see that TODAY is
     * heavy — one dated flag, no words, no reply expected. The only way to
     * ask for presence that costs the sender nothing in shame.
     */
    witnessSignal(deviceId: string, localDate: string): { ok: true } | null {
      const goal = db.getActiveGoal(deviceId);
      if (!goal) return null;
      const invite = db.getWitnessInviteForDevice(deviceId);
      if (!invite) return null;
      db.setWitnessSignal(invite.token, localDate);
      return { ok: true };
    },

    /**
     * What a witness may see. Privacy is the feature: Day number, how many
     * times they have returned, whether they showed up today, and — only when
     * the holder chose to send it — that today is heavy. Never the goal
     * title, reward, check-in states, notes, or written entries.
     */
    witnessView(
      token: string,
      localDate: string,
    ): {
      active: boolean;
      day?: number;
      checkinCount?: number;
      showedUpToday?: boolean;
      heavyToday?: boolean;
    } | null {
      const invite = db.getWitnessInvite(token);
      if (!invite) return null;
      db.touchWitnessSeen(invite.token, now().toISOString());
      const goal = db.getActiveGoal(invite.device_id);
      if (!goal) return { active: false };
      return {
        active: true,
        day: daysSince(goal.start_date, localDate),
        checkinCount: db.listCheckins(goal.id).length,
        showedUpToday: !!db.getCheckin(goal.id, localDate),
        heavyToday: invite.signal_date === localDate,
      };
    },

    toCard,
  };
}

export type Service = ReturnType<typeof createService>;
