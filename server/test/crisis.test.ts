import { describe, it, expect } from "vitest";
import { detectCrisis, normalize } from "../src/lib/crisis";

// Highest-priority safety tests. The corpus is intentionally broad: every
// true-positive MUST flag, and every true-negative MUST NOT, so that crisis
// detection is both safe and not so trigger-happy it breaks normal use.

const TRUE_POSITIVES = [
  "I want to kill myself",
  "i wanna kill my self tonight",
  "thinking about killing myself",
  "I'm suicidal",
  "feeling suicidal lately",
  "I have thought about suicide",
  "I want to die",
  "i just wanna die",
  "I wish I was dead",
  "I wish I were dead",
  "I want to be dead",
  "I don't want to live anymore",
  "I no longer want to live",
  "I don't want to be here anymore",
  "everyone would be better off without me",
  "the world would be better without me",
  "I'd be better off dead",
  "there's no reason to live",
  "nothing to live for",
  "life isn't worth living",
  "I can't go on anymore",
  "I can't keep going any longer",
  "I want to end my life",
  "I'm going to end it all",
  "ending it tonight",
  "I've been cutting myself",
  "I keep hurting myself",
  "I want to harm myself",
  "this is self-harm",
  "I self harm when stressed",
  "I'm going to hang myself",
  "thinking of taking my own life",
  "I might overdose on pills to die",
  "I just want to jump off a bridge",
  "I've given up on life",
  // formatting / obfuscation variants
  "KILL MYSELF",
  "kill.myself",
  "i  want   to   die",
  "I’m suicidal", // smart apostrophe
];

const TRUE_NEGATIVES = [
  "I'm so tired today",
  "I'm exhausted and overwhelmed",
  "no one notices me at work",
  "I feel invisible lately",
  "Should I take the job offer?",
  "I'm dying to see you again",
  "I'm dying to know what happens next",
  "this traffic is killing me",
  "my feet are killing me",
  "you're killing it lately",
  "that dessert is to die for",
  "I could kill for a coffee right now",
  "I'm dead tired",
  "lol I'm dead 😂",
  "I would never kill myself, I just feel low",
  "I'm not suicidal, just sad",
  "I don't want to die, I'm scared",
  "I had a fight with my partner",
  "I feel ugly today",
  "I want to live my best life",
  "this deadline is brutal",
  "the meeting ran late and I'm drained",
  "I'm worried about my future",
  "kill the lights please",
  "I aced the exam, killed it",
  "",
  "   ",
];

describe("crisis detection — true positives", () => {
  for (const text of TRUE_POSITIVES) {
    it(`flags: ${JSON.stringify(text)}`, () => {
      expect(detectCrisis(text).isCrisis).toBe(true);
    });
  }
});

describe("crisis detection — true negatives", () => {
  for (const text of TRUE_NEGATIVES) {
    it(`allows: ${JSON.stringify(text)}`, () => {
      expect(detectCrisis(text).isCrisis).toBe(false);
    });
  }
});

describe("normalize", () => {
  it("lowercases, unifies apostrophes, collapses whitespace", () => {
    expect(normalize("I’M   Suicidal!!")).toBe("i'm suicidal");
  });
  it("turns punctuation into separators", () => {
    expect(normalize("kill.myself")).toBe("kill myself");
  });
});

describe("crisis result shape", () => {
  it("returns the matched label for positives", () => {
    expect(detectCrisis("I want to kill myself").matched).toBe("kill_myself");
  });
  it("returns empty matched for negatives", () => {
    expect(detectCrisis("I'm just tired").matched).toBe("");
  });
});
