// The Halo Deck — a fixed, symbolic deck the oracle draws from. Titles are
// stable so they recur across a person's life and accrue personal meaning;
// the *interpretation* changes with the question and the moment, never the
// name. The "essence" is a short anchor that keeps each card's meaning
// consistent every time it appears. Themes drive illustration selection.
//
// To edit the cards, open deck.json in this same folder.

import type { CardTheme } from "../types";
import deckData from "./deck.json";

export interface HaloCard {
  title: string;
  theme: CardTheme;
  /** A short, stable symbolic meaning that anchors every interpretation. */
  essence: string;
}

export const HALO_DECK: HaloCard[] = deckData as HaloCard[];

const BY_TITLE = new Map(HALO_DECK.map((c) => [c.title.toLowerCase(), c]));
const BY_THEME = HALO_DECK.reduce<Record<string, HaloCard[]>>((acc, c) => {
  (acc[c.theme] ||= []).push(c);
  return acc;
}, {});

/** Exact (case-insensitive) lookup of a deck card by title. */
export function findHalo(title: string | undefined): HaloCard | undefined {
  if (!title) return undefined;
  return BY_TITLE.get(title.trim().toLowerCase());
}

/** All deck cards for a theme (for snapping an off-deck title back onto the deck). */
export function halosForTheme(theme: CardTheme): HaloCard[] {
  return BY_THEME[theme] ?? [];
}

/** The deck rendered for the model, as "Title — essence" lines. */
export function deckListing(): string {
  return HALO_DECK.map((c) => `- ${c.title} — ${c.essence}`).join("\n");
}
