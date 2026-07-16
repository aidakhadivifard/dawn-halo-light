import { describe, it, expect } from "vitest";
import { BENCHMARKS, benchmarkForDay } from "../src/lib/benchmarks";

describe("benchmark engine", () => {
  it("NEVER ships a line without a real source (name + url)", () => {
    expect(BENCHMARKS.length).toBeGreaterThan(0);
    for (const b of BENCHMARKS) {
      expect(b.text.trim().length, b.id).toBeGreaterThan(10);
      expect(b.sourceName.trim().length, b.id).toBeGreaterThan(3);
      expect(b.sourceUrl, b.id).toMatch(/^https:\/\//);
      expect(b.tags.length, b.id).toBeGreaterThan(0);
    }
  });

  it("ids are unique", () => {
    const ids = BENCHMARKS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("rotation is deterministic — the same day always shows the same line", () => {
    expect(benchmarkForDay(1)).toBe(benchmarkForDay(1));
    expect(benchmarkForDay(1)!.id).toBe(BENCHMARKS[0].id);
    expect(benchmarkForDay(BENCHMARKS.length + 1)!.id).toBe(BENCHMARKS[0].id);
  });

  it("rotates through the whole table before repeating", () => {
    const seen = new Set<string>();
    for (let d = 1; d <= BENCHMARKS.length; d++) seen.add(benchmarkForDay(d)!.id);
    expect(seen.size).toBe(BENCHMARKS.length);
  });

  it("tolerates day 0 / negative input without crashing", () => {
    expect(benchmarkForDay(0)).toBeTruthy();
    expect(benchmarkForDay(-5)).toBeTruthy();
  });
});
