// The tiny step.
//
// "Put on your running clothes. That's all. Don't exercise." Then, only if
// they want it, a little more. Then a little more.
//
// Four rules hold this whole file together:
//   1. The step is almost insultingly small — doable by a tired person at 11pm.
//   2. It is built only from what the person told us. We invent no fact about
//      their life, their job, their body, their family, their city.
//   3. When the step would need to know what a thing she named IS — "working
//      on dawnhalo" — and she never said, the app does not guess ("open the
//      dawnhalo file"). It asks her, once, in one short question, and keeps
//      the answer with the wish so it never has to ask again.
//   4. Without a model there is NO step. We would rather offer nothing than
//      offer something we made up.
//
// A finished step is recorded as an ordinary deed, so it brings color back to
// the picture exactly like any other day's answer. No separate scoring, ever.

/** The rungs one person may be offered in a single day, after their own answer. */
export const MAX_RUNGS = 3;

/** How many things the app may ask about in one day before it must just offer a step. */
export const MAX_ASKS = 2;

export const TINY_STEP_SYSTEM =
  "You suggest one very small physical action and nothing else. " +
  "You never advise, never encourage, never explain, and never invent facts about the person. " +
  "When you would have to guess what something they named is, you ask instead.";

/** One thing she explained when the app asked. */
export interface Told {
  question: string;
  answer: string;
}

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
  /** What she has explained about this wish, when asked, oldest first. */
  told?: Told[];
  /** When true the model may not ask anything more — she has answered enough. */
  noAsking?: boolean;
}

/** What comes back: a step to take, or a question we need answered first. */
export type StepAnswer = { kind: "step"; text: string } | { kind: "ask"; text: string };

function rules(noAsking: boolean): string {
  const asking = noAsking
    ? `- Do not ask them anything. If you do not know what a thing they named is, give a step that ` +
      `works without knowing — "Open whatever you were working on. Just look at it."\n`
    : `- If the step depends on knowing WHAT one of the things they named IS — a name, a ` +
      `project, a file, a place they mentioned without saying what it is — do NOT guess. ` +
      `Instead write one short question, under twelve words, asking only that. Start it with ` +
      `the exact characters "ASK:". Example — they wrote "working on dawnhalo" and you do not ` +
      `know what dawnhalo is: ASK: What is dawnhalo?\n`;
  return (
    `Rules:\n` +
    `- Use ONLY what they told you. Invent nothing about their job, family, city, body, or plans.\n` +
    asking +
    `- The step is one short sentence. Two at most, and only if the second gives permission to stop there.\n` +
    `- No advice, no encouragement, no explanation, no praise. Only the action.\n` +
    (noAsking
      ? `- Write in the same language they used.\n\n` + `Answer with the step and nothing else.`
      : `- Write in the same language they used. The marker ASK: stays in English.\n\n` +
        `Answer with the step, or with the ASK line, and nothing else.`)
  );
}

export function tinyStepPrompt(input: TinyStepInput): string {
  const ladder = input.done.length
    ? `Steps they have already taken today, in order:\n${input.done.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n`
    : "";
  const told = input.told?.length
    ? `Things they have explained when asked, in their words:\n` +
      input.told.map((t) => `- Asked "${t.question}" they said: "${t.answer}"`).join("\n") +
      `\n\n`
    : "";
  const wish = `Someone wrote down the life they wish for, in their own words:\n\n"${input.wish}"\n\n`;
  const RULES = rules(Boolean(input.noAsking));

  // They are already moving: continue it, barely.
  if (input.today) {
    return (
      wish +
      `Today they said they did this for it:\n\n"${input.today}"\n\n` +
      told +
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
    told +
    ladder +
    `Give them the SMALLEST POSSIBLE first action — so small it is almost funny. ` +
    `Under two minutes. It must require no decision, no planning, and no feeling ready: ` +
    `something the body can do while the mind is still unwilling. The classic shape is: ` +
    `"Put on your running clothes. That's all. Don't exercise."\n\n` +
    `Never refer to what they failed to do, and never imply today was wasted.\n\n` +
    RULES
  );
}

function stripLine(l: string): string {
  return l
    .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
    .replace(/^["'“”«]+/, "")
    .replace(/["'“”»]+$/, "")
    .trim();
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
    .map(stripLine)
    .filter(Boolean)
    .join(" ")
    .replace(/^["'“”«]+/, "")
    .replace(/["'“”»]+$/, "")
    .trim();
  if (!line) return null;
  // A "step" longer than this is a plan, not a step.
  return line.slice(0, 180);
}

/**
 * Read the model's answer: a step, or a question the app needs answered before
 * it can offer one. Anything empty is null — and null means "offer nothing",
 * never "make something up". (Older prompts asked for a "DONE:" line of button
 * words under the step; if a model still writes one, it is dropped.)
 */
export function parseStep(raw: string): StepAnswer | null {
  if (!raw) return null;
  const text = raw.replace(/```[a-z]*/gi, "").replace(/```/g, "").trim();
  const lines = text.split("\n").map(stripLine).filter(Boolean);
  if (!lines.length) return null;

  // A question, wherever the marker landed on the line.
  const ask = lines.find((l) => /^ask\s*:/i.test(l));
  if (ask) {
    const q = ask.replace(/^ask\s*:\s*/i, "").replace(/^["'“”«]+|["'“”»]+$/g, "").trim();
    return q.length > 1 ? { kind: "ask", text: q.slice(0, 120) } : null;
  }

  const body = lines.filter((l) => !/^done\s*:/i.test(l));
  const step = cleanStep(body.join("\n"));
  return step ? { kind: "step", text: step } : null;
}
