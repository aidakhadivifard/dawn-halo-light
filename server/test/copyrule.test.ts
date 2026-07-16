import { describe, it, expect } from "vitest";
import { copyRuleViolations, enforceCopyRule } from "../src/lib/copyrule";
import { ACK, MILESTONE_MESSAGES, FALLBACK_REFLECTIONS, HONESTY_DONE_HEADING, GOAL_COMPLETED_HEADING, HONESTY_OFFER, EFFORT_LINE } from "../src/lib/keepgoing-copy";
import { BENCHMARKS } from "../src/lib/benchmarks";
import type { CheckinState, MilestoneId } from "../src/lib/keepgoing";

describe("the Copy Rule lint", () => {
  it("flags outcome promises", () => {
    const bad = [
      "You will succeed.",
      "Keep going and you'll get rich.",
      "The universe is rewarding you soon.",
      "Success is guaranteed if you persist.",
      "I promise it gets better.",
      "You are destined for this.",
      "Keep manifesting your dream.",
      "Everything will be fine by spring.",
      "It will all work out.",
      "Your effort will pay off.",
    ];
    for (const line of bad) {
      expect(copyRuleViolations(line).length, line).toBeGreaterThan(0);
    }
  });

  it("passes effort-affirming lines", () => {
    const good = [
      "Day 47. You chose to stay, again.",
      "Most people quit by day 3. You didn't.",
      "Being tired IS part of holding on.",
      "You wrote about running from something. What's applying the most pressure this week?",
      "Choosing to stop is a decision, not a failure.",
    ];
    for (const line of good) {
      expect(copyRuleViolations(line), line).toEqual([]);
    }
  });

  it("enforceCopyRule swaps a violating line for the safe fallback", () => {
    const r = enforceCopyRule("You will succeed, I promise.", "Day 12. Still here.");
    expect(r.violated).toBe(true);
    expect(r.text).toBe("Day 12. Still here.");
    const ok = enforceCopyRule("Day 12. Still here.", "unused");
    expect(ok.violated).toBe(false);
    expect(ok.text).toBe("Day 12. Still here.");
  });
});

describe("every reviewed static line obeys the Copy Rule", () => {
  const states: CheckinState[] = ["strong", "barely", "cant", "exhausted"];
  const milestones: MilestoneId[] = [
    "day3",
    "day7",
    "day30",
    "quarter",
    "half",
    "three_quarters",
    "target",
  ];

  it("check-in acknowledgments", () => {
    for (const s of states) expect(copyRuleViolations(ACK[s](47))).toEqual([]);
  });

  it("milestone messages", () => {
    for (const m of milestones) expect(copyRuleViolations(MILESTONE_MESSAGES[m](47))).toEqual([]);
  });

  it("fallback reflections", () => {
    for (const s of states) {
      expect(copyRuleViolations(FALLBACK_REFLECTIONS[s]("stay at this job"))).toEqual([]);
    }
  });

  it("summaries, offers, effort line", () => {
    expect(copyRuleViolations(HONESTY_DONE_HEADING(30))).toEqual([]);
    expect(copyRuleViolations(GOAL_COMPLETED_HEADING(90))).toEqual([]);
    expect(copyRuleViolations(HONESTY_OFFER)).toEqual([]);
    expect(copyRuleViolations(EFFORT_LINE)).toEqual([]);
  });

  it("benchmark lines", () => {
    for (const b of BENCHMARKS) expect(copyRuleViolations(b.text), b.id).toEqual([]);
  });

  it("no guilt language in the 'done' path", () => {
    const done = HONESTY_DONE_HEADING(30).toLowerCase();
    for (const word of ["quit", "gave up", "shame", "wasted", "should have", "only "]) {
      expect(done.includes(word), word).toBe(false);
    }
    expect(done).toContain("a decision, not a failure");
  });
});
