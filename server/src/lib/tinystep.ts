// The tiny step.
//
// "Put on your running clothes. That's all. Don't exercise." Then, only if
// they want it, a little more. Then a little more.
//
// Three rules hold this whole file together:
//   1. The step is almost insultingly small — doable by a tired person at 11pm.
//   2. It is built only from what the person told us. We invent no fact about
//      their life, their job, their body, their family, their city.
//   3. Without a model there is NO step. We would rather offer nothing than
//      offer something we made up.
//
// A finished step is recorded as an ordinary deed, so it brings color back to
// the picture exactly like any other day's answer. No separate scoring, ever.

/** The rungs one person may be offered in a single day, after their own answer. */
export const MAX_RUNGS = 3;

export const TINY_STEP_SYSTEM =
  "You suggest one very small physical action and nothing else. " +
  "You never advise, never encourage, never explain, and never invent facts about the person.";

export interface TinyStepInput {
  /** The wish, in the person's own words. Never paraphrased. */
  wish: string;
  /**
   * What they said they did today, in their words — or null when they said
   * they couldn't do anything and it bothers them. The two ask for very
   * different steps: one continues a movement, the other starts one.
   */
  today: string | null;
  /** Steps already taken in this sitting, oldest first. */
  done: string[];
}

const RULES =
  `Rules:\n` +
  `- Use ONLY what they told you. Invent nothing about their job, family, city, body, or plans.\n` +
  `- No advice, no encouragement, no explanation, no praise. Only the action.\n` +
  `- One short sentence. Two at most, and only if the second gives permission to stop there.\n` +
  `- Write in the same language they used.\n\n` +
  `Answer with the action only.`;

export function tinyStepPrompt(input: TinyStepInput): string {
  const ladder = input.done.length
    ? `Steps they have already taken today, in order:\n${input.done.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n`
    : "";
  const wish = `Someone wrote down the life they wish for, in their own words:\n\n"${input.wish}"\n\n`;

  // They are already moving: continue it, barely.
  if (input.today) {
    return (
      wish +
      `Today they said they did this for it:\n\n"${input.today}"\n\n` +
      ladder +
      `Give them ONE next action that is almost insultingly small — under two minutes, ` +
      `something a tired person at 11pm could still do. The classic shape is: ` +
      `"Put on your running clothes. That's all. Don't exercise."\n\n` +
      `Each step may be slightly larger than the one before, but never large.\n\n` +
      RULES
    );
  }

  // They could not start, and it bothers them. This is the match, not the fire.
  return (
    wish +
    `Today they could not do anything for it, and that bothers them. They are not lazy ` +
    `and they are not asking to be motivated — they are stuck, and they said so.\n\n` +
    ladder +
    `Give them the SMALLEST POSSIBLE first action — so small it is almost funny. ` +
    `Under two minutes. It must require no decision, no planning, and no feeling ready: ` +
    `something the body can do while the mind is still unwilling. The classic shape is: ` +
    `"Put on your running clothes. That's all. Don't exercise."\n\n` +
    `Never refer to what they failed to do, and never imply today was wasted.\n\n` +
    RULES
  );
}

/**
 * Tidy a model answer into one line. Strips fences, quotes, list markers and
 * any second paragraph — whatever arrives, the person sees one small thing.
 */
export function cleanStep(raw: string): string | null {
  if (!raw) return null;
  const text = raw
    .replace(/```[a-z]*/gi, "")
    .replace(/```/g, "")
    .trim();
  const firstBlock = text.split(/\n\s*\n/)[0] ?? "";
  const line = firstBlock
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/^["'“”«]+/, "")
    .replace(/["'“”»]+$/, "")
    .trim();
  if (!line) return null;
  // A "step" longer than this is a plan, not a step.
  return line.slice(0, 180);
}
