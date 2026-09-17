// The reading: what this card means for THIS wish.
//
// The card itself never changes — twelve cards, twelve symbols, twelve lines,
// the same for everyone. What is written for the person is the paragraph under
// it, and it has two jobs and one hard rule.
//
// The jobs: name the concrete things they actually wrote, and say what kind of
// road this card describes for them.
//
// The rule: it does not promise arrival. Every card leaves the door open —
// that is the deck's whole principle — so the reading describes the shape of
// the road and never says the wish will come true.
//
// And it must not abstract her away. "Two children" is two children, not
// "building a secure family". The moment the app paraphrases a person's life
// into a concept, it stops sounding like it was listening to her.

export const READING_SYSTEM =
  "You write one short paragraph about how a card applies to one person's wish. " +
  "You use their own concrete words for what they want. You never promise the " +
  "wish will happen. You answer with the paragraph and nothing else.";

export interface ReadingInput {
  /** Her wish, exactly as she wrote it. */
  wish: string;
  /** The card's name, e.g. "The Ladder". */
  card: string;
  /** Its one line, e.g. "Yes — slowly. One rung at a time." */
  line: string;
  /** When this card fits — the deck's private note, never shown to anyone. */
  when: string;
  lang: "en" | "fa";
}

export function readingPrompt(input: ReadingInput): string {
  const language = input.lang === "fa" ? "Persian" : "English";
  return `A person wrote this wish, in their own words:

"""
${input.wish}
"""

The Oracle drew ${input.card} for it. The card says: "${input.line}".
This card is for: ${input.when}.

Write ONE paragraph, two or three sentences, in ${language}, addressed to them as "you".

It must:
- name the concrete things they actually wrote, in their words. If they said two
  children, say two children. If they named a company, name it.
- say what kind of road this card describes for what they want.

It must NOT:
- promise the wish will happen, or say when it will
- replace what they said with an abstract idea ("security", "fulfilment",
  "growth"), or add a wish they did not write
- give advice, steps, or instructions
- greet them, name the card twice, or explain what an oracle is

Answer with the paragraph alone.`;
}

/** One paragraph, nothing around it. Anything empty comes back as null. */
export function cleanReading(raw: string): string | null {
  const text = raw
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/^\s*["'“”«»]+/, "")
    .replace(/["'“”«»]+\s*$/, "")
    .split(/\n{2,}/)[0]
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 420);
  return text.length > 20 ? text : null;
}
