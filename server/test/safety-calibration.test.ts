// The acceptance-level safety calibration for the endurance-goal layer.
// BOTH failure modes count as failures:
//   1. referring an ordinarily-tired user to professional help (over-referral)
//   2. responding to crisis language with motivation (under-referral)
// The labeled corpus lives in safety-calibration.json — run this on every
// system-prompt or crisis-pattern change.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { detectCrisis } from "../src/lib/crisis";
import { REFLECTION_SYSTEM_PROMPT } from "../src/lib/reflect";
import { FALLBACK_REFLECTIONS, ACK } from "../src/lib/keepgoing-copy";
import { COPY_RULE } from "../src/lib/copyrule";
import type { CheckinState } from "../src/lib/keepgoing";

interface Case {
  text: string;
  expected: "reflect" | "resources";
}

const CASES: Case[] = JSON.parse(
  readFileSync(new URL("./safety-calibration.json", import.meta.url), "utf-8"),
).cases;

const REFERRAL_LANGUAGE =
  /\b(therap(y|ist)|counsel(or|ing|ling)?|professional help|seek help|talk to (a|your) (doctor|professional)|mental health (professional|provider))\b/i;

describe("safety calibration (tests/safety-calibration.json)", () => {
  it("has a meaningful corpus with both labels", () => {
    expect(CASES.length).toBeGreaterThanOrEqual(30);
    expect(CASES.some((c) => c.expected === "reflect")).toBe(true);
    expect(CASES.some((c) => c.expected === "resources")).toBe(true);
  });

  it("ordinary hardship gets reflection — ZERO referrals to the resources flow", () => {
    for (const c of CASES.filter((x) => x.expected === "reflect")) {
      expect(detectCrisis(c.text).isCrisis, `over-referral: "${c.text}"`).toBe(false);
    }
  });

  it("genuine crisis gets the resources flow — ZERO motivational responses", () => {
    for (const c of CASES.filter((x) => x.expected === "resources")) {
      expect(detectCrisis(c.text).isCrisis, `under-referral: "${c.text}"`).toBe(true);
    }
  });
});

describe("the reflection prompt permits staying with hard emotions", () => {
  it("contains the explicit anti-over-referral permission verbatim", () => {
    expect(REFLECTION_SYSTEM_PROMPT).toContain("The user is a capable adult.");
    expect(REFLECTION_SYSTEM_PROMPT).toContain(
      "Your job is to witness and reflect, not to redirect to professional help.",
    );
    expect(REFLECTION_SYSTEM_PROMPT).toContain(
      "Suggesting therapy/counseling for ordinary tiredness is a failure.",
    );
  });

  it("states the Copy Rule verbatim", () => {
    expect(REFLECTION_SYSTEM_PROMPT).toContain(COPY_RULE);
  });
});

describe("offline copy never refers ordinary hardship out", () => {
  const states: CheckinState[] = ["strong", "barely", "cant", "exhausted"];

  it("fallback reflections contain no referral language", () => {
    for (const s of states) {
      const line = FALLBACK_REFLECTIONS[s]("stay at this job until January");
      expect(REFERRAL_LANGUAGE.test(line), line).toBe(false);
    }
  });

  it("check-in acknowledgments contain no referral language", () => {
    for (const s of states) {
      const line = ACK[s](47);
      expect(REFERRAL_LANGUAGE.test(line), line).toBe(false);
    }
  });
});
