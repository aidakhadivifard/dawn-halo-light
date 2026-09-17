// Hearing what someone actually wished for.
//
// People do not write one wish. They write everything at once — a smaller
// stomach, money, exercise, two children, the company working out — and if the
// app treats that paragraph as a single wish, it draws one muddled picture and
// asks them to commit to all of it forever. That is the moment the thing stops
// feeling like it is listening.
//
// So: separate the wishes, say back what was heard, and let them choose which
// one gets the card first. The others are kept, not discarded, and the app says
// so — that sentence is the whole reason a person is willing to choose.
//
// Two rules the prompt is built around:
//   1. Never invent a wish they did not write.
//   2. Two wishes are distinct only when one could come true without the other.
//      "Lose weight and get fit" is one wish. "Lose weight and buy a house" is two.

export const MAX_WISHES = 6;

/** One wish, in two shapes: a button to press and a phrase to say back. */
export interface HeardWish {
  /** For the list of choices: "Have two children". */
  label: string;
  /** For the sentence "I hear three wishes: …": "having two children". */
  echo: string;
}

export const HEAR_SYSTEM =
  "You separate a person's wishes so they can choose one to start with. " +
  "You answer with JSON and nothing else. You never invent a wish they did not " +
  "write, and you use their own words wherever you can.";

export function hearPrompt(text: string, lang: "en" | "fa"): string {
  const language = lang === "fa" ? "Persian" : "English";
  return `Someone wrote what they wish for. Separate it into distinct wishes.

Two wishes are distinct only when one could come true without the other.
"Lose weight and get fit" is ONE wish. "Lose weight and buy a house" is TWO.
If it really is one wish, answer with one item.

Their words:
"""
${text}
"""

Answer with JSON only, in exactly this shape, at most ${MAX_WISHES} items:
{"wishes":[{"label":"…","echo":"…"}]}

label — the wish as something they could pick off a list. Their words, tidied.
  Starts with a capital, no full stop, at most 60 characters.
echo — the same wish as a phrase that can follow "I hear three wishes:".
  For example "having two children", "a smaller stomach", "seeing the company
  succeed". Lowercase, no full stop.

Write both in ${language}. Add nothing they did not write.`;
}

function tidy(s: string, max: number): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/^["'“”«»\-•*\s]+/, "")
    .replace(/["'“”«»\s]+$/, "")
    .replace(/[.。]+$/, "")
    .trim()
    .slice(0, max);
}

/** Parse the model's answer. Anything malformed returns null, never a guess. */
export function parseHeard(raw: string): HeardWish[] | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  const list = (data as { wishes?: unknown })?.wishes;
  if (!Array.isArray(list)) return null;

  const out: HeardWish[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const label = tidy(String((item as { label?: unknown })?.label ?? ""), 60);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const echo = tidy(String((item as { echo?: unknown })?.echo ?? ""), 80) || lower(label);
    out.push({ label, echo });
    if (out.length >= MAX_WISHES) break;
  }
  return out.length ? out : null;
}

/** Lowercase the first letter only — Persian has no case, so it is a no-op there. */
function lower(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/**
 * No model, or a model that answered with nonsense: split on the punctuation
 * people actually use for lists. If that finds nothing, the text is one wish —
 * and then it stays EXACTLY as they wrote it, because the app's whole promise
 * is that it does not put words in their mouth.
 */
export function fallbackHearing(text: string): HeardWish[] {
  const parts = text
    .split(/[\n\r؛;]+/)
    .map((p) => tidy(p, 60))
    .filter((p) => p.length > 1);

  const seen = new Set<string>();
  const out: HeardWish[] = [];
  for (const label of parts) {
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, echo: lower(label) });
    if (out.length >= MAX_WISHES) break;
  }
  if (out.length > 1) return out;

  const whole = tidy(text, 200);
  return [{ label: whole, echo: lower(whole) }];
}
