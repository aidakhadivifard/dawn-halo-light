// The Halo Deck — a fixed, symbolic deck the oracle draws from. Titles are
// stable so they recur across a person's life and accrue personal meaning;
// the *interpretation* changes with the question and the moment, never the
// name. The "essence" is a short anchor that keeps each card's meaning
// consistent every time it appears. Themes drive illustration selection.

import type { CardTheme } from "../types";

export type HaloElement = "Fire" | "Water" | "Earth" | "Air" | "Spirit";

export interface HaloCard {
  title: string;
  theme: CardTheme;
  symbol?: string;
  /** A cryptic, poetic anchor — like a whisper from an oracle. */
  essence: string;
  element?: HaloElement;
  number?: number;
  color?: string;
  reflection?: string;
}

export const HALO_DECK: HaloCard[] = [
  {
    title: "The Long Road",
    theme: "guidance_decision",
    symbol: "A dirt road disappearing into fog, with footprints that seem to appear just ahead of the walker, not behind them.",
    essence: "The path is not found — it is made by the feet that trust it.",
    element: "Earth",
    number: 7,
    color: "Muted green-grey",
    reflection: "If you follow this road to its end, what will you have left behind without noticing?",
  },
  {
    title: "The Open Gate",
    theme: "hope_abundance",
    symbol: "A wooden gate standing alone in an open field, no fence attached to either side. Beyond it, the air shimmers as if the world on the other side is slightly different.",
    essence: "The gate was never locked — you were the one who kept looking for the key.",
    element: "Air",
    number: 3,
    color: "Gold-tinged white",
    reflection: "If you step through without knowing what is on the other side, who will you become on the way?",
  },
  {
    title: "The Distant Lantern",
    theme: "guidance_decision",
    symbol: "A single light far across a dark valley — too far to read by, but close enough to walk toward. The ground between here and there is invisible.",
    essence: "You do not need to see the whole path — only the next step toward the light.",
    element: "Fire",
    number: 11,
    color: "Amber against deep black",
    reflection: "If the lantern were suddenly gone, would you still walk in that direction?",
  },
  {
    title: "The River Keeps Moving",
    theme: "release_change",
    symbol: "A wide river at night, carrying leaves and branches — all of them moving, none of them struggling. The moon lays a silver road across the surface that nothing can walk on.",
    essence: "You are not the one who moves the water. You are the one who learns to float.",
    element: "Water",
    number: 4,
    color: "Deep blue-grey",
    reflection: "What would you stop fighting if you truly believed you were already being carried?",
  },
  {
    title: "Winter Roots",
    theme: "quiet_strength",
    symbol: "A bare tree in snow — nothing above ground, but beneath the frost, roots are spreading wider than the tree ever was. The soil is warm where they reach.",
    essence: "The most important growth happens when no one is watching — not even you.",
    element: "Earth",
    number: 9,
    color: "White-grey with deep brown beneath",
    reflection: "If you could not see your own progress for one full year, would you still trust the work?",
  },
  {
    title: "The Sleeping Seed",
    theme: "hope_abundance",
    symbol: "A single seed buried in dark soil — not yet cracked, not yet watered. Above it, the sun is rising, but the seed cannot see it yet.",
    essence: "What is not yet visible is not yet absent.",
    element: "Earth",
    number: 8,
    color: "Deep brown with a thread of gold",
    reflection: "If the seed could speak, would it call itself dead — or waiting?",
  },
  {
    title: "The Gathering Harvest",
    theme: "hope_abundance",
    symbol: "A stone table at the edge of a wheat field, piled with fruit no one remembers planting. The wind carries the scent of grain and something older — an offering left for no one in particular.",
    essence: "What was forgotten still ripened. What was abandoned still bore fruit.",
    element: "Earth",
    number: 18,
    color: "Burnished gold and deep ochre",
    reflection: "What have you stopped tending — that has been quietly growing without you?",
  },
  {
    title: "The Turning Door",
    theme: "release_change",
    symbol: "A heavy wooden door, half open, light pouring from the side you are leaving and shadow pooling on the side you are entering. The hinges are silent, as if the door has been turning for longer than you noticed.",
    essence: "The door does not close behind you — it turns. And what you hear on the other side is the sound of your own footsteps, already there.",
    element: "Spirit",
    number: 13,
    color: "Warm bronze fading into cool violet",
    reflection: "What is the room you keep returning to in your mind — the one you have already left?",
  },
  {
    title: "The Quiet Compass",
    theme: "guidance_decision",
    symbol: "A small, old compass — but the needle does not point north. It points toward something only the owner can feel. The glass is cracked, but the needle is steady.",
    essence: "The direction you need is not on any map. It is felt before it is known.",
    element: "Spirit",
    number: 5,
    color: "Silver and deep blue",
    reflection: "If your inner compass pointed toward a place that did not exist yet — would you still follow it?",
  },
  {
    title: "The Last Ember",
    theme: "quiet_strength",
    symbol: "A fire pit at dawn, all logs turned to ash — except one coal, still glowing faintly orange at its center. No one is tending it. The wind has not found it yet.",
    essence: "What remains is not what survived the fire — it is what the fire could not finish.",
    element: "Fire",
    number: 15,
    color: "Burnt orange in a field of ash-grey",
    reflection: "If this ember is the last warmth you carry — what would you choose to light with it?",
  },
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
  return HALO_DECK.map((c) => {
    let line = `- ${c.title} — ${c.essence}`;
    if (c.element) line += ` [${c.element}, ${c.number}]`;
    return line;
  }).join("\n");
}
