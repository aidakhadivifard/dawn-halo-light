// The road cards.
//
// Every card says the same thing — it CAN happen. What differs is the SHAPE of
// the road: near, slow, helped, unclear, heavy. That is the honest part: we
// never promise arrival, but we never say no either. Each card reduces to one
// small object — a badge — that sits on the corner of the wish from then on.
//
// The deck is fixed and small on purpose: twelve names a person can remember,
// twelve lines short enough to translate by hand into every language.

export interface RoadCard {
  /** Stable id — the badge glyph and every translation key hang off this. */
  id: string;
  /** English name. Other languages translate in the client. */
  name: string;
  /** One line, English. Never a promise of arrival. */
  line: string;
  /** When this card fits — read by the model, never shown to anyone. */
  when: string;
}

export const ROAD_CARDS: RoadCard[] = [
  { id: "key", name: "The Key", line: "It's near. What you need is already in your hand.",
    when: "the wish is small, specific, or clearly within reach; one decision or one act away" },
  { id: "bridge", name: "The Bridge", line: "Someone carries part of the way. Ask.",
    when: "it needs another person — a partner, a customer, an investor, a teacher, a family member" },
  { id: "ladder", name: "The Ladder", line: "Yes — slowly. One rung at a time.",
    when: "a big wish made of many stages: a business, a degree, a house, wealth" },
  { id: "lantern", name: "The Lantern", line: "You can't see the end. You don't need to.",
    when: "the wish is clear but the route is genuinely unknown, or the person sounds lost" },
  { id: "boat", name: "The Boat", line: "It's moving. Row, and the current helps.",
    when: "a move, a journey, emigration, leaving something, a fresh start" },
  { id: "seed", name: "The Seed", line: "Growing where you can't see it yet.",
    when: "body, health, a craft, art, study — anything that only time can finish" },
  { id: "compass", name: "The Compass", line: "The direction is right. The route will bend.",
    when: "work, a career, a decision between paths, a change of direction" },
  { id: "hammer", name: "The Hammer", line: "The tool has come. Now build.",
    when: "they already have the skill or the thing, and what remains is the making" },
  { id: "mountain", name: "The Mountain", line: "Hard — and yours.",
    when: "a heavy, long wish that will cost real endurance; they sound tired or afraid" },
  { id: "crown", name: "The Crown", line: "You'll carry this one yourself. Stand tall.",
    when: "wishes about the self: beauty, confidence, respect, being one's own person" },
  { id: "door", name: "The Door", line: "It opens from your side.",
    when: "a home, a new chapter, a relationship, something waiting to be walked into" },
  { id: "sun", name: "The Sun", line: "Already begun. Warmer every day.",
    when: "after a hard season; a wish that has quietly already started" },
];

export const CARD_IDS = ROAD_CARDS.map((c) => c.id);

export function findCard(id: string | null | undefined): RoadCard | undefined {
  return ROAD_CARDS.find((c) => c.id === id);
}

/** The prompt that picks ONE card for a wish. Nothing is written by the model. */
export function cardPrompt(wish: string): string {
  const list = ROAD_CARDS.map((c) => `${c.id} — ${c.name}: ${c.when}`).join("\n");
  return (
    `A person wrote down the life they wish for, in their own words (any language):\n\n` +
    `"${wish}"\n\n` +
    `Choose the ONE card below whose shape of road best matches this wish. Every card ` +
    `means the wish CAN happen — they differ only in how the road runs. Read the ` +
    `feeling as much as the facts: if the person sounds tired or afraid, that matters; ` +
    `if they already have what they need, that matters.\n\n${list}\n\n` +
    `Answer with ONLY the id, lowercase, nothing else.`
  );
}

/**
 * Deterministic fallback when no model is available: the same wish always gets
 * the same card, so a flaky network can never change someone's card.
 */
export function fallbackCard(wish: string): RoadCard {
  let h = 0;
  for (let i = 0; i < wish.length; i++) h = (h * 31 + wish.charCodeAt(i)) | 0;
  return ROAD_CARDS[Math.abs(h) % ROAD_CARDS.length];
}
