import { describe, it, expect } from "vitest";
import {
  canDraw,
  withinTrial,
  snapshot,
  effectiveActiveDays,
  FREE_DRAWS_PER_DAY,
  TRIAL_ACTIVE_DAYS,
  type QuotaState,
} from "../src/lib/entitlement";

const base = (over: Partial<QuotaState> = {}): QuotaState => ({
  subscribed: false,
  plan: null,
  activeDays: 0,
  drawsToday: 0,
  ...over,
});

describe("daily card is free forever", () => {
  it("allowed during trial", () => {
    expect(canDraw("daily", base({ activeDays: 3, drawsToday: 0 })).allowed).toBe(true);
  });
  it("allowed after trial (day 200)", () => {
    expect(canDraw("daily", base({ activeDays: 200, drawsToday: 0 })).allowed).toBe(true);
  });
  it("allowed even after hitting the daily cap", () => {
    expect(canDraw("daily", base({ activeDays: 2, drawsToday: 3 })).allowed).toBe(true);
  });
});

describe("free prompted draws during the first 14 active days", () => {
  it("allows up to 3 draws/day", () => {
    expect(canDraw("prompted", base({ activeDays: 1, drawsToday: 0 }))).toEqual({
      allowed: true,
      reason: "ok",
    });
    expect(canDraw("prompted", base({ activeDays: 1, drawsToday: 2 })).allowed).toBe(true);
  });
  it("blocks the 4th prompted draw in a day (daily cap)", () => {
    expect(canDraw("prompted", base({ activeDays: 1, drawsToday: 3 }))).toEqual({
      allowed: false,
      reason: "daily_cap",
    });
  });
});

describe("14 active-day boundary", () => {
  it("day 14 (already active today) still within trial", () => {
    const s = base({ activeDays: 14, drawsToday: 1 });
    expect(withinTrial(s)).toBe(true);
    expect(canDraw("prompted", s).allowed).toBe(true);
  });
  it("first draw of a brand-new 15th active day -> trial over", () => {
    // 14 active days so far, today not yet active (drawsToday 0) -> this draw is day 15
    const s = base({ activeDays: 14, drawsToday: 0 });
    expect(effectiveActiveDays(s)).toBe(15);
    expect(withinTrial(s)).toBe(false);
    expect(canDraw("prompted", s)).toEqual({ allowed: false, reason: "trial_over" });
  });
  it("after trial, daily card still free but prompted gated", () => {
    const s = base({ activeDays: 30, drawsToday: 0 });
    expect(canDraw("daily", s).allowed).toBe(true);
    expect(canDraw("prompted", s).allowed).toBe(false);
  });
});

describe("inactive-then-return edge case", () => {
  it("counts only active days, not calendar gaps", () => {
    // User has been active on exactly 5 days spread over months; today is a 6th.
    const s = base({ activeDays: 5, drawsToday: 0 });
    expect(effectiveActiveDays(s)).toBe(6);
    expect(withinTrial(s)).toBe(true);
    expect(canDraw("prompted", s).allowed).toBe(true);
  });
});

describe("subscribers", () => {
  it("unlimited prompted draws regardless of day/count", () => {
    const s = base({ subscribed: true, plan: "yearly", activeDays: 999, drawsToday: 50 });
    expect(canDraw("prompted", s)).toEqual({ allowed: true, reason: "subscribed" });
    expect(canDraw("daily", s).allowed).toBe(true);
  });
});

describe("snapshot", () => {
  it("free trial user shows remaining draws", () => {
    const s = snapshot(base({ activeDays: 2, drawsToday: 1 }));
    expect(s.freeDrawsRemaining).toBe(FREE_DRAWS_PER_DAY - 1);
    expect(s.withinTrial).toBe(true);
    expect(s.subscribed).toBe(false);
    expect(s.dailyCardFree).toBe(true);
  });
  it("post-trial free user shows 0 remaining", () => {
    const s = snapshot(base({ activeDays: 40, drawsToday: 0 }));
    expect(s.freeDrawsRemaining).toBe(0);
    expect(s.withinTrial).toBe(false);
  });
  it("subscriber shows unlimited (-1)", () => {
    const s = snapshot(base({ subscribed: true, plan: "monthly", activeDays: 5, drawsToday: 9 }));
    expect(s.freeDrawsRemaining).toBe(-1);
  });
  it("TRIAL_ACTIVE_DAYS is 14", () => {
    expect(TRIAL_ACTIVE_DAYS).toBe(14);
  });
});
