// Card illustration catalog + selection with a per-user 2-week no-repeat rule.
//
// The backend tracks only illustration IDs (e.g. "card-exhaustion_rest-02").
// The frontend maps those IDs to the actual imported image URLs from its
// bundled asset library, so the binaries never need to live on the server.
//
// This catalog mirrors the 50 images under src/assets/cards/. Keep in sync if
// images are added/removed (see scripts or README for verification).

import type { CardTheme } from "../types";
import { CARD_THEMES } from "../types";

// Number of images per theme, matching the files in src/assets/cards/.
const THEME_COUNTS: Record<CardTheme, number> = {
  daily_general: 6,
  guidance_decision: 6,
  exhaustion_rest: 5,
  relationship_tension: 5,
  feeling_unseen: 6,
  self_image: 5,
  hope_abundance: 6,
  release_change: 6,
  quiet_strength: 5,
};

export interface CatalogImage {
  id: string;
  theme: CardTheme;
}

function buildCatalog(): CatalogImage[] {
  const out: CatalogImage[] = [];
  for (const theme of CARD_THEMES) {
    for (let i = 1; i <= THEME_COUNTS[theme]; i++) {
      const n = String(i).padStart(2, "0");
      out.push({ id: `card-${theme}-${n}`, theme });
    }
  }
  return out;
}

export const CATALOG: CatalogImage[] = buildCatalog();

export const TOTAL_IMAGES = CATALOG.length;

export function imagesForTheme(theme: CardTheme): CatalogImage[] {
  return CATALOG.filter((c) => c.theme === theme);
}

/** The no-repeat window in days. */
export const NO_REPEAT_WINDOW_DAYS = 14;

/**
 * Pick an illustration for a theme, excluding any IDs the user has seen within
 * the no-repeat window. If every image in the theme is excluded, fall back to
 * the full theme pool (so we never fail to return a card). Deterministic when a
 * `rand` function is supplied (used by tests).
 */
export function selectIllustration(
  theme: CardTheme,
  recentlyShownIds: Iterable<string>,
  rand: () => number = Math.random,
): string {
  const pool = imagesForTheme(theme);
  const recent = new Set(recentlyShownIds);
  const available = pool.filter((c) => !recent.has(c.id));
  const choices = available.length > 0 ? available : pool;
  const idx = Math.floor(rand() * choices.length) % choices.length;
  return choices[idx].id;
}
