// The Halo Deck — a fixed, symbolic deck the oracle draws from. Titles are
// stable so they recur across a person's life and accrue personal meaning;
// the *interpretation* changes with the question and the moment, never the
// name. The "essence" is a short anchor that keeps each card's meaning
// consistent every time it appears. Themes drive illustration selection.

import type { CardTheme } from "../types";

export interface HaloCard {
  title: string;
  theme: CardTheme;
  /** A short, stable symbolic meaning that anchors every interpretation. */
  essence: string;
}

export const HALO_DECK: HaloCard[] = [
  { title: "The Long Road", theme: "guidance_decision", essence: "progress that continues even when it feels invisible" },
  { title: "The Open Gate", theme: "hope_abundance", essence: "an opening newly available; permission to step through" },
  { title: "The Distant Lantern", theme: "guidance_decision", essence: "a far but real light; the future quietly calling you on" },
  { title: "The River Keeps Moving", theme: "release_change", essence: "change that carries you forward whether or not you push" },
  { title: "Winter Roots", theme: "quiet_strength", essence: "unseen growth during a dormant, difficult season" },
  { title: "The Sleeping Seed", theme: "hope_abundance", essence: "potential not yet visible; patience before the bloom" },
  { title: "The Gathering Harvest", theme: "hope_abundance", essence: "reward arriving slowly through persistence" },
  { title: "The Turning Door", theme: "release_change", essence: "a threshold; one chapter closing as another opens" },
  { title: "The Quiet Compass", theme: "guidance_decision", essence: "an inner direction that is steadier than the noise" },
  { title: "The Last Ember", theme: "quiet_strength", essence: "a small remaining warmth that can still rekindle" },
  { title: "The Unfinished Horizon", theme: "hope_abundance", essence: "a story still unfolding; no ending has been written" },
  { title: "The Weight of Becoming", theme: "release_change", essence: "the heaviness that comes with real growth" },
  { title: "The Bridge Being Built", theme: "guidance_decision", essence: "a path still under construction; trust the building of it" },
  { title: "The Place Between", theme: "release_change", essence: "the in-between; no longer there, not yet here" },
  { title: "The Path With No Shortcut", theme: "guidance_decision", essence: "a necessary slowness; no step can be skipped" },
  { title: "The Light Beyond", theme: "hope_abundance", essence: "hope that waits past the present difficulty" },
  { title: "The Slow Arrival", theme: "exhaustion_rest", essence: "things coming in their own unhurried time" },
  { title: "The Orchard", theme: "hope_abundance", essence: "abundance that was tended patiently over time" },
  { title: "The Returning Tide", theme: "release_change", essence: "what left will return; the turning of cycles" },
  { title: "The Empty Chair", theme: "feeling_unseen", essence: "an absence; a longing for what or who is missing" },
  { title: "The First Step", theme: "guidance_decision", essence: "a beginning; the small courage it takes to start" },
  { title: "The Mountain Pass", theme: "quiet_strength", essence: "a hard crossing that nonetheless has a way through" },
  { title: "The Hidden Spring", theme: "hope_abundance", essence: "an unseen source of renewal within you" },
  { title: "The Lantern in Fog", theme: "guidance_decision", essence: "a small, sufficient clarity amid uncertainty" },
  { title: "The Fire That Waits", theme: "quiet_strength", essence: "patient power not yet ready to be spent" },
  { title: "The Quiet Return", theme: "exhaustion_rest", essence: "a coming back to yourself after being away" },
  { title: "The Sheltering Tree", theme: "quiet_strength", essence: "steadiness and refuge; something that holds" },
  { title: "The Crossing Stones", theme: "guidance_decision", essence: "one careful step at a time across uncertain water" },
  { title: "The Morning Field", theme: "daily_general", essence: "a fresh, open day not yet asking anything of you" },
  { title: "The Tended Flame", theme: "self_image", essence: "keeping your own light lit; quiet self-worth" },
  { title: "The Far Shore", theme: "hope_abundance", essence: "a destination still being reached, but real" },
  { title: "The Patient Garden", theme: "hope_abundance", essence: "growth that cannot and need not be rushed" },
  { title: "The Open Hand", theme: "release_change", essence: "letting go; loosening a grip that has tired you" },
  { title: "The Still Lake", theme: "quiet_strength", essence: "calm beneath the surface; clear reflection" },
  { title: "The Northern Star", theme: "guidance_decision", essence: "a fixed point to steer by when the way is dark" },
  { title: "The Threshold", theme: "release_change", essence: "standing at the edge of something new" },
  { title: "The Gentle Current", theme: "release_change", essence: "being carried softly forward without forcing" },
  { title: "The Watchful Moon", theme: "feeling_unseen", essence: "being seen and accompanied even in the dark" },
  { title: "The Climbing Path", theme: "guidance_decision", essence: "effort that gains elevation; worth the climb" },
  { title: "The Quiet Harbor", theme: "exhaustion_rest", essence: "rest; a safe place to set down the weight" },
  { title: "The Unopened Letter", theme: "hope_abundance", essence: "news or possibility not yet known" },
  { title: "The Steady Hands", theme: "quiet_strength", essence: "you are more able to hold this than you feel" },
  { title: "The Wandering Path", theme: "guidance_decision", essence: "meaning found even in the detours" },
  { title: "The Waiting Dawn", theme: "hope_abundance", essence: "the light that always returns after a long night" },
  { title: "The Deep Well", theme: "self_image", essence: "inner resources greater than they appear" },
  { title: "The Two Rivers", theme: "relationship_tension", essence: "two lives meeting; both connection and friction" },
  { title: "The Shared Fire", theme: "relationship_tension", essence: "warmth between people; the wish to belong" },
  { title: "The Distant Bell", theme: "feeling_unseen", essence: "a call that wishes to be heard and answered" },
  { title: "The Open Window", theme: "hope_abundance", essence: "fresh air; a new way of seeing the same room" },
  { title: "The Roots and the Sky", theme: "self_image", essence: "who you have been and who you are becoming, held together" },
];

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
