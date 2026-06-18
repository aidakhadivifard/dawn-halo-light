// Varied, italic "reader settling in" openers. Rule 6: every card opens with a
// one-line opener and we never reuse the exact same line back-to-back. The AI
// normally writes the opener; these power the offline fallback and guarantee
// variety.

const OPENERS: string[] = [
  "Let me read what this card is saying about your question…",
  "I'm reading the energy of today's card for you…",
  "Sit with me a moment — this one's settling into focus…",
  "Mm. This card stepped forward before I even finished shuffling…",
  "Let me lean in and listen to what's underneath this…",
  "Here — this is the card that wanted to be seen right now…",
  "I'm catching something quiet around what you brought me…",
  "Give me a breath with this one; it's speaking softly…",
  "The deck settled on this almost the moment you asked…",
  "Let me hold your question up to the light for a second…",
];

/** Pick an opener, avoiding the exact line passed as `avoid`. */
export function pickOpener(avoid?: string, rand: () => number = Math.random): string {
  const pool = avoid ? OPENERS.filter((o) => o !== avoid) : OPENERS;
  const choices = pool.length ? pool : OPENERS;
  return choices[Math.floor(rand() * choices.length) % choices.length];
}

export { OPENERS };
