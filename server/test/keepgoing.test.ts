import { describe, it, expect } from "vitest";
import {
  daysSince,
  totalDays,
  progress,
  milestoneFor,
  lowStateRun,
  honestyDue,
} from "../src/lib/keepgoing";

describe("daysSince (days since commitment)", () => {
  it("the creation day is Day 1", () => {
    expect(daysSince("2026-07-01", "2026-07-01")).toBe(1);
  });

  it("counts calendar days inclusively", () => {
    expect(daysSince("2026-07-01", "2026-07-02")).toBe(2);
    expect(daysSince("2026-07-01", "2026-08-16")).toBe(47);
  });

  it("missing days never reset the count — it is pure calendar math", () => {
    // No check-ins involved at all: day count depends only on dates.
    expect(daysSince("2026-01-01", "2026-12-31")).toBe(365);
  });

  it("crosses month and DST-ish boundaries without drift (UTC date math)", () => {
    expect(daysSince("2026-02-27", "2026-03-02")).toBe(4); // 2026 not a leap year
    expect(daysSince("2026-03-07", "2026-03-09")).toBe(3); // US DST weekend
  });

  it("never returns less than 1, even if the clock moved backwards a day", () => {
    expect(daysSince("2026-07-02", "2026-07-01")).toBe(1);
  });
});

describe("milestones (rare celebrations only)", () => {
  // 100-day goal: percent milestones at day 25 / 50 / 75.
  const start = "2026-01-01";
  const target = "2026-04-10"; // totalDays = 100
  const on = (day: number) => {
    const d = new Date(Date.UTC(2026, 0, 1) + (day - 1) * 86_400_000);
    return d.toISOString().slice(0, 10);
  };

  it("total days sanity", () => {
    expect(totalDays(start, target)).toBe(100);
  });

  it("celebrates exactly day 3, 7, 30, 25%, 50%, 75%, target", () => {
    expect(milestoneFor(start, target, on(3))).toBe("day3");
    expect(milestoneFor(start, target, on(7))).toBe("day7");
    expect(milestoneFor(start, target, on(30))).toBe("day30");
    expect(milestoneFor(start, target, on(25))).toBe("quarter");
    expect(milestoneFor(start, target, on(50))).toBe("half");
    expect(milestoneFor(start, target, on(75))).toBe("three_quarters");
    expect(milestoneFor(start, target, on(100))).toBe("target");
  });

  it("every other day is quiet (no over-celebration)", () => {
    for (const day of [1, 2, 4, 8, 29, 31, 49, 76, 99]) {
      expect(milestoneFor(start, target, on(day))).toBeNull();
    }
  });

  it("when a fixed day collides with a percent day, only ONE milestone fires", () => {
    // 12-day goal: 25% = day 3 → the percent label wins, still one celebration.
    expect(milestoneFor("2026-07-01", "2026-07-12", "2026-07-03")).toBe("quarter");
  });

  it("past the target date it stays 'target' (goal end)", () => {
    expect(milestoneFor(start, target, on(101))).toBe("target");
  });

  it("progress is clamped to [0, 1]", () => {
    expect(progress(start, target, on(50))).toBeCloseTo(0.5);
    expect(progress(start, target, on(200))).toBe(1);
  });
});

describe("lowStateRun (consecutive hard days)", () => {
  const c = (date: string, state: string) => ({ local_date: date, state });

  it("counts consecutive cant/exhausted days ending today", () => {
    const checkins = [
      c("2026-07-01", "strong"),
      c("2026-07-02", "cant"),
      c("2026-07-03", "exhausted"),
      c("2026-07-04", "cant"),
    ];
    expect(lowStateRun(checkins, "2026-07-04")).toBe(3);
  });

  it("a missed day breaks the run", () => {
    const checkins = [c("2026-07-01", "cant"), c("2026-07-02", "cant"), c("2026-07-04", "cant")];
    expect(lowStateRun(checkins, "2026-07-04")).toBe(1);
  });

  it("a strong/barely day breaks the run", () => {
    const checkins = [
      c("2026-07-02", "cant"),
      c("2026-07-03", "barely"),
      c("2026-07-04", "exhausted"),
    ];
    expect(lowStateRun(checkins, "2026-07-04")).toBe(1);
  });

  it("zero when today has no low check-in", () => {
    expect(lowStateRun([c("2026-07-03", "cant")], "2026-07-04")).toBe(0);
  });
});

describe("honestyDue (every 21 days, early on 3 hard days in a row)", () => {
  it("due on day 21, 42, 63 …", () => {
    expect(honestyDue({ day: 20, lastHonestyDay: null, lowRun: 0 })).toBe(false);
    expect(honestyDue({ day: 21, lastHonestyDay: null, lowRun: 0 })).toBe(true);
    expect(honestyDue({ day: 41, lastHonestyDay: 21, lowRun: 0 })).toBe(false);
    expect(honestyDue({ day: 42, lastHonestyDay: 21, lowRun: 0 })).toBe(true);
    expect(honestyDue({ day: 63, lastHonestyDay: 42, lowRun: 0 })).toBe(true);
  });

  it("never nags between checks", () => {
    expect(honestyDue({ day: 22, lastHonestyDay: 21, lowRun: 0 })).toBe(false);
    expect(honestyDue({ day: 35, lastHonestyDay: 21, lowRun: 2 })).toBe(false);
  });

  it("triggers EARLY after 3 consecutive cant/exhausted days", () => {
    expect(honestyDue({ day: 10, lastHonestyDay: null, lowRun: 3 })).toBe(true);
  });

  it("does not re-trigger daily while the same low run continues past an answer", () => {
    // Answered on day 10 inside the run; day 11 continues the run (lowRun 4).
    expect(honestyDue({ day: 11, lastHonestyDay: 10, lowRun: 4 })).toBe(false);
  });
});
