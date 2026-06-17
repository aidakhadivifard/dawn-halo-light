import { describe, it, expect } from "vitest";
import { computeStreak, addDays, groupByDay } from "../src/lib/streak";

describe("addDays", () => {
  it("handles month boundaries", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });
});

describe("computeStreak", () => {
  it("0 for no activity", () => {
    expect(computeStreak([], "2026-06-17")).toBe(0);
  });
  it("counts consecutive days ending today", () => {
    expect(computeStreak(["2026-06-15", "2026-06-16", "2026-06-17"], "2026-06-17")).toBe(3);
  });
  it("does not break if today has no activity yet (counts through yesterday)", () => {
    expect(computeStreak(["2026-06-15", "2026-06-16"], "2026-06-17")).toBe(2);
  });
  it("breaks on a gap", () => {
    expect(computeStreak(["2026-06-10", "2026-06-16", "2026-06-17"], "2026-06-17")).toBe(2);
  });
  it("returns 0 when the most recent activity is older than yesterday", () => {
    expect(computeStreak(["2026-06-10"], "2026-06-17")).toBe(0);
  });
});

describe("groupByDay", () => {
  it("groups rows by local_date", () => {
    const rows = [
      { local_date: "2026-06-17", id: 1 },
      { local_date: "2026-06-17", id: 2 },
      { local_date: "2026-06-16", id: 3 },
    ];
    const g = groupByDay(rows);
    expect(g["2026-06-17"].length).toBe(2);
    expect(g["2026-06-16"].length).toBe(1);
  });
});
