import { describe, it, expect } from "vitest";
import { detectDreamSymbols, dreamAnchors, DREAM_BOOK } from "../src/lib/dreambook";
import { buildUserPrompt } from "../src/lib/prompt";

describe("the Dream Book", () => {
  it("every entry has a non-empty symbol and anchor", () => {
    for (const s of DREAM_BOOK) {
      expect(s.symbol.length).toBeGreaterThan(0);
      expect(s.anchor.length).toBeGreaterThan(20);
    }
  });

  it("no anchor forecasts doom", () => {
    for (const s of DREAM_BOOK) {
      expect(s.anchor.toLowerCase()).not.toMatch(/\b(you will die|bad luck|misfortune is coming|omen of death)\b/);
    }
  });

  const cases: [string, string][] = [
    ["I had a dream: my teeth were falling out", "teeth"],
    ["I dreamed I was being chased through a forest", "chased"],
    ["in my dream I was falling from a building", "falling"],
    ["I dreamt of a huge snake in my kitchen", "snake"],
    ["I had a dream my late mother came to visit me", "dead_relative"],
    ["I dreamed I was pregnant", "pregnancy"],
    ["I dreamed my husband was cheating on me", "cheating"],
    ["I was naked in front of my whole office", "naked"],
    ["I missed the train in my dream and kept running", "late"],
    ["I dreamt about an exam I hadn't studied for", "exam"],
    ["I dreamed our house was on fire", "fire"],
    ["I dreamt of a flood rising in the streets", "flood"],
  ];
  for (const [text, id] of cases) {
    it(`detects ${id} in ${JSON.stringify(text)}`, () => {
      expect(detectDreamSymbols(text).map((s) => s.id)).toContain(id);
    });
  }

  it("detects multiple symbols but caps at three", () => {
    const hits = detectDreamSymbols(
      "I dreamed of a snake in the water near a burning house while being chased by a dog",
    );
    expect(hits.length).toBe(3);
  });

  it("returns nothing for a symbol-free telling", () => {
    expect(detectDreamSymbols("I had a dream about a quiet purple fog")).toEqual([]);
  });

  it("injects anchors into the dream user prompt", () => {
    const p = buildUserPrompt({ intent: "dream", text: "I had a dream: my teeth were falling out" });
    expect(p).toContain("SYMBOL ANCHORS");
    expect(p).toContain("losing hold");
  });

  it("adds no anchor block when nothing matches", () => {
    expect(dreamAnchors("a quiet purple fog")).toBe("");
  });
});
