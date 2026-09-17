// The reading: what this card means for THIS wish.
//
// The card itself never changes — thirteen cards, thirteen symbols, thirteen
// lines, the same for everyone. What is written for the person is the short
// paragraph under it, and it has one shape and two hard rules.
//
// The shape is a reading, not an analysis. It does not take her wish apart
// ("your wish holds two things: A and B"), and it never talks about itself
// ("what the card sees is…"). It speaks the way a card would if it could: it
// says what kind of road this is, in her own concrete words, and ends with
// what the card asks. Fifty to eighty words. This is the model to follow:
//
//   The Ladder appears when progress must be built, not found. Your career may
//   begin to rise before wealth follows — or the first signs of wealth may
//   appear before recognition does. Do not measure the whole distance today.
//   Look for the next rung. One rung is enough for today.
//
// The two rules pull against each other on purpose. It does not promise
// arrival — it never says the wish will come true, or when. And it never says
// the opposite either: not impossible, not going to fail, not time to let it
// go. It leaves a person with hope and somewhere to put their feet.
//
// The card was DRAWN, not chosen for this wish, so sometimes it will not
// obviously fit. That is the reading's job: find what is true in it. It never
// says the card does not suit the wish, and it never mentions the draw.
//
// And it must not abstract her away. "Two children" is two children, not
// "building a secure family". The moment the app paraphrases a person's life
// into a concept, it stops sounding like it was listening to her.

export const READING_SYSTEM =
  "You write the short reading under an oracle card, for one person's wish. " +
  "You speak plainly, in their own concrete words, in fifty to eighty words. " +
  "You never promise the wish will happen and never say it will not. " +
  "You answer with the reading and nothing else.";

export interface ReadingInput {
  /** Her wish, exactly as she wrote it. */
  wish: string;
  /** The card's name, e.g. "The Ladder". */
  card: string;
  /** Its one line, e.g. "The way rises slowly. One rung at a time." */
  line: string;
  /** When this card fits — the deck's private note, never shown to anyone. */
  when: string;
  lang: "en" | "fa";
}

/** The reading every other reading is measured against. Shown to the model, never to her. */
export const EXAMPLE_READING =
  "The Ladder appears when progress must be built, not found. Your career may begin to rise " +
  "before wealth follows — or the first signs of wealth may appear before recognition does. " +
  "Do not measure the whole distance today. Look for the next rung. One rung is enough for today.";

export function readingPrompt(input: ReadingInput): string {
  const language = input.lang === "fa" ? "Persian" : "English";
  return `A person wrote this wish, in their own words:

"""
${input.wish}
"""

The Oracle drew ${input.card} for it. The card says: "${input.line}".
This card is for: ${input.when}.

Write the reading that goes under the card, in ${language}, addressed to them as "you".
Fifty to eighty words. One paragraph. Short sentences.

Here is a reading of the right shape, written for someone who wished for their
career taking off and being wealthy, when The Ladder was drawn:

"""
${EXAMPLE_READING}
"""

It must:
- begin with what the card is for, in one sentence — "The Ladder appears when…"
- use the concrete things they actually wrote, in their words. If they said two
  children, say two children. If they named a company, name it.
- if their wish holds several different things, let the reading show that those
  things will not move at the same speed — without listing them or counting them.
- end with what this card asks of them, in the card's own terms — the next rung,
  asking someone, staying in the boat, putting one thing down.

It must NOT:
- promise the wish will happen, or say when it will
- say the wish is impossible, unlikely, too much, or out of reach; predict that
  it will fail; or suggest letting it go or wanting something smaller
- take the wish apart: no "your wish holds two things", no "A and B are not one
  thing but two", no listing what they want back to them
- talk about itself: no "what the card sees", "the card suggests", "this reading",
  "the Oracle"
- say that the card does not fit their wish, or mention how the card was chosen
- replace what they said with an abstract idea ("security", "fulfilment",
  "growth"), or add a wish they did not write
- give advice about their actual life: no plans, no steps, no numbers, no
  timetable, nothing they should go and do today
- greet them, or explain what an oracle is

This card was drawn, not picked to match their wish, so it may not fit at first
glance. Find what is true in it for them and write from that. They should
finish reading with hope and somewhere to put their feet.

Answer with the reading alone.`;
}

/** The longest a reading may run — eighty words of English, with room for Persian. */
export const READING_MAX_CHARS = 560;

/**
 * One paragraph, nothing around it, and never cut mid-sentence: if the model
 * ran long, the reading ends at the last full stop that fits. Anything empty
 * comes back as null.
 */
export function cleanReading(raw: string): string | null {
  const text = raw
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/^\s*["'“”«»]+/, "")
    .replace(/["'“”«»]+\s*$/, "")
    .split(/\n{2,}/)[0]
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= 20) return null;
  if (text.length <= READING_MAX_CHARS) return text;
  const cut = text.slice(0, READING_MAX_CHARS);
  // End on a sentence, in either script. Falling back to the hard cut only if
  // there is no sentence end at all in the first half.
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("."), cut.lastIndexOf("؟"), cut.lastIndexOf("!"));
  return end > READING_MAX_CHARS / 2 ? cut.slice(0, end + 1).trim() : cut.trim();
}
