import { describe, it, expect } from "vitest";
import {
  CATALOG,
  TOTAL_IMAGES,
  imagesForTheme,
  selectIllustration,
} from "../src/lib/illustrations";

describe("catalog", () => {
  it("contains exactly 50 images", () => {
    expect(TOTAL_IMAGES).toBe(50);
    expect(CATALOG.length).toBe(50);
  });
  it("has unique ids", () => {
    const ids = new Set(CATALOG.map((c) => c.id));
    expect(ids.size).toBe(50);
  });
  it("ids follow the card-<theme>-NN convention", () => {
    for (const c of CATALOG) {
      expect(c.id).toMatch(/^card-[a-z_]+-\d{2}$/);
      expect(c.id).toContain(c.theme);
    }
  });
});

describe("selectIllustration — no-repeat window", () => {
  it("never returns a recently-shown id while options remain", () => {
    const theme = "exhaustion_rest";
    const pool = imagesForTheme(theme).map((c) => c.id);
    // Exclude all but one; selection must return the remaining one.
    const recent = pool.slice(1);
    const picked = selectIllustration(theme, recent, () => 0.999);
    expect(picked).toBe(pool[0]);
  });

  it("falls back to the full pool when everything is excluded", () => {
    const theme = "self_image";
    const pool = imagesForTheme(theme).map((c) => c.id);
    const picked = selectIllustration(theme, pool, () => 0);
    expect(pool).toContain(picked);
  });

  it("is deterministic with a seeded rand", () => {
    const a = selectIllustration("hope_abundance", [], () => 0.5);
    const b = selectIllustration("hope_abundance", [], () => 0.5);
    expect(a).toBe(b);
  });

  it("spreads across the pool over many draws (excluding recents)", () => {
    const theme = "daily_general";
    const seen = new Set<string>();
    let rotating: string[] = [];
    let r = 0;
    for (let i = 0; i < 30; i++) {
      const id = selectIllustration(theme, rotating, () => (r++ % 7) / 7);
      seen.add(id);
      rotating = [...rotating, id].slice(-3); // simulate a small recent window
    }
    // Should have touched most of the 6 images in the theme.
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });
});
