// Free-tier / entitlement rules (pure, DB-agnostic so they're easy to test).
//
// DECISIONS (authoritative):
//  - The daily card is FREE FOREVER.
//  - A "3 draws/day" free allowance (daily card + ask/feel draws combined)
//    applies during the first 14 ACTIVE days.
//  - After 14 active days, the daily card stays free but ask/feel (prompted)
//    draws require a subscription.
//  - Days are the user's LOCAL day (handled by the caller when it computes
//    activeDays / drawsToday).

export const FREE_DRAWS_PER_DAY = 3;
export const TRIAL_ACTIVE_DAYS = 14;

export type DrawType = "daily" | "prompted";

export interface QuotaState {
  subscribed: boolean;
  plan: "monthly" | "yearly" | null;
  /** Distinct local days with activity SO FAR (includes today only if today already has a draw). */
  activeDays: number;
  /** Draws recorded today (daily + prompted), local day. */
  drawsToday: number;
}

export type DrawReason =
  | "ok"
  | "subscribed"
  | "daily_free"
  | "daily_cap"
  | "trial_over";

export interface DrawDecision {
  allowed: boolean;
  reason: DrawReason;
}

/**
 * The number of active days this user would be on if they drew right now —
 * i.e. today counts as an active day even if it's their first draw today.
 */
export function effectiveActiveDays(state: QuotaState): number {
  return state.drawsToday > 0 ? state.activeDays : state.activeDays + 1;
}

/** Whether the user is still inside their first 14 active days. */
export function withinTrial(state: QuotaState): boolean {
  return effectiveActiveDays(state) <= TRIAL_ACTIVE_DAYS;
}

/** Decide whether a draw of the given type is allowed right now. */
export function canDraw(type: DrawType, state: QuotaState): DrawDecision {
  if (state.subscribed) return { allowed: true, reason: "subscribed" };

  // The daily card is free forever.
  if (type === "daily") return { allowed: true, reason: "daily_free" };

  // Prompted (ask / feel / draw-again) draws:
  if (withinTrial(state)) {
    if (state.drawsToday < FREE_DRAWS_PER_DAY) return { allowed: true, reason: "ok" };
    return { allowed: false, reason: "daily_cap" };
  }
  return { allowed: false, reason: "trial_over" };
}

/** Build the entitlement snapshot returned to the client. */
export function snapshot(state: QuotaState) {
  const subscribed = state.subscribed;
  const trial = withinTrial(state);
  let freeDrawsRemaining: number;
  if (subscribed) freeDrawsRemaining = -1; // -1 = unlimited
  else if (trial) freeDrawsRemaining = Math.max(0, FREE_DRAWS_PER_DAY - state.drawsToday);
  else freeDrawsRemaining = 0;

  return {
    subscribed,
    plan: state.plan,
    activeDays: effectiveActiveDays(state),
    withinTrial: trial,
    drawsToday: state.drawsToday,
    freeDrawsRemaining,
    dailyCardFree: true as const,
  };
}
