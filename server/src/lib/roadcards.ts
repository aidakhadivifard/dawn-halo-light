// The road cards.
//
// The deck's principle, which is for us and never for the person reading:
// EVERY CARD POINTS TOWARD POSSIBILITY, BUT NOT EVERY CARD PROMISES AN EASY
// ROAD. None of them says no. None of them says yes either. What differs is
// the shape of the road — open, slow, steep, helped, unclear, or one that
// asks for something to be put down first.
//
// We do not tell anyone that. A person who is told the deck is kind stops
// believing the card, and the card is the whole point. So the app never says
// "there is no bad card" — it just never deals one.
//
// The card is DRAWN, not chosen. Nothing reads the wish and decides what it
// deserves; that would make the Oracle a judge, and the deck a verdict on a
// life. It is a fixed deck and a real draw, and only the reading underneath
// is written for the person.
//
// The deck is fixed and small on purpose: a handful of names a person can
// remember, and lines short enough to translate by hand into every language.

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
  { id: "key", name: "The Key", line: "The way is short. What opens it is in your hand.",
    when: "the wish is small, specific, or clearly within reach; one decision or one act away" },
  { id: "bridge", name: "The Bridge", line: "Someone carries part of the way. Ask.",
    when: "it needs another person — a partner, a customer, an investor, a teacher, a family member" },
  { id: "ladder", name: "The Ladder", line: "The way rises slowly. One rung at a time.",
    when: "a big wish made of many stages: a business, a degree, a house, wealth" },
  { id: "lantern", name: "The Lantern", line: "You can't see the end. You don't need to.",
    when: "the wish is clear but the route is genuinely unknown, or the person sounds lost" },
  { id: "boat", name: "The Boat", line: "The water is moving. Row, and the current helps.",
    when: "a move, a journey, emigration, leaving something, a fresh start" },
  { id: "seed", name: "The Seed", line: "Roots first, where no one can see.",
    when: "body, health, a craft, art, study — anything that only time can finish" },
  { id: "compass", name: "The Compass", line: "The direction holds. The route will bend.",
    when: "work, a career, a decision between paths, a change of direction" },
  { id: "hammer", name: "The Hammer", line: "The tool has come. Now build.",
    when: "they already have the skill or the thing, and what remains is the making" },
  { id: "mountain", name: "The Mountain", line: "The way is steep. It is yours to climb.",
    when: "a heavy, long wish that will cost real endurance; they sound tired or afraid" },
  { id: "crown", name: "The Crown", line: "You'll carry this one yourself. Stand tall.",
    when: "wishes about the self: beauty, confidence, respect, being one's own person" },
  { id: "door", name: "The Door", line: "It opens from your side.",
    when: "a home, a new chapter, a relationship, something waiting to be walked into" },
  { id: "sun", name: "The Sun", line: "It has already begun. Stand where the light falls.",
    when: "after a hard season; a wish that has quietly already started" },
  { id: "stone", name: "The Stone", line: "Put one thing down. The road opens after.",
    when: "something has to be released, ended or set down before the wish can move — " +
      "an obligation, a grudge, a plan being gripped, someone else's expectations" },
];

/** A card cannot come back until this many other cards have been drawn. */
export const NO_REPEAT_WITHIN = 3;

/**
 * Cards that read as the same idea. Two of these back to back feels like a
 * repeat even though the ids differ — which makes the draw look rigged.
 */
const KIN: Record<string, string[]> = {
  key: ["door"],
  door: ["key"],
  ladder: ["mountain"],
  mountain: ["ladder"],
  lantern: ["sun", "compass"],
  sun: ["lantern", "seed"],
  seed: ["sun"],
  compass: ["lantern"],
  boat: ["bridge"],
  bridge: ["boat"],
  hammer: [],
  crown: [],
  stone: [],
};

/**
 * Draw one. A real draw from a fixed deck — the wish is never read here.
 *
 * Two things keep it from feeling mechanical: a card cannot repeat until three
 * others have been drawn, and it will not follow a card that means nearly the
 * same thing. If those rules leave nothing, they relax in that order, because
 * a card must always come.
 */
export function pickRoadCard(
  /** The ids drawn before, newest first. */
  recent: string[] = [],
  random: () => number = Math.random,
): RoadCard {
  const tooSoon = new Set(recent.slice(0, NO_REPEAT_WITHIN));
  const kin = new Set(KIN[recent[0] ?? ""] ?? []);
  const fresh = ROAD_CARDS.filter((c) => !tooSoon.has(c.id));
  const pool = fresh.filter((c) => !kin.has(c.id));
  const deck = pool.length ? pool : fresh.length ? fresh : ROAD_CARDS;
  return deck[Math.min(deck.length - 1, Math.floor(random() * deck.length))];
}

export const CARD_IDS = ROAD_CARDS.map((c) => c.id);

export function findCard(id: string | null | undefined): RoadCard | undefined {
  return ROAD_CARDS.find((c) => c.id === id);
}

/**
 * A card from the wish alone, with no randomness — used only where a draw has
 * to be reproducible (a lost card_id, a test). Never the normal path.
 */
export function fallbackCard(wish: string): RoadCard {
  let h = 0;
  for (let i = 0; i < wish.length; i++) h = (h * 31 + wish.charCodeAt(i)) | 0;
  return ROAD_CARDS[Math.abs(h) % ROAD_CARDS.length];
}
