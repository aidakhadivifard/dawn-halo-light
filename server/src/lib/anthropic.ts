// Claude card generation with a graceful, deterministic fallback. The API key
// lives only here (server-side); it never reaches the client.

import Anthropic from "@anthropic-ai/sdk";
import { getConfig } from "../config";
import { SYSTEM_PROMPT, buildUserPrompt, buildVowPrompt, type JourneyContext } from "./prompt";
import { pickOpener } from "./openers";
import { findHalo, halosForTheme, HALO_DECK } from "./deck";
import { TINY_STEP_SYSTEM, tinyStepPrompt, parseStep, type TinyStepInput, type StepAnswer } from "./tinystep";
import { HEAR_SYSTEM, hearPrompt, parseHeard, fallbackHearing, type HeardWish } from "./hearing";
import { READING_SYSTEM, readingPrompt, cleanReading, type ReadingInput } from "./reading";
import { CARD_THEMES, type CardTheme } from "../types";

export interface GenInput {
  intent: "question" | "feeling" | "general";
  text?: string;
  previous?: { title: string; message: string };
  /** Active vow context — when present, readings quietly acknowledge the road. */
  journey?: JourneyContext;
}

export interface GenResult {
  opener: string;
  title: string;
  message: string;
  reflection: string;
  theme: CardTheme;
  fallback: boolean;
}

const DEFAULT_TIMEOUT_MS = 12_000;

// A small, tasteful offline library used when Claude is slow/unavailable, or
// for any parse failure. Keeps the app working end-to-end without a key.
const FALLBACK: Record<
  GenInput["intent"],
  { title: string; message: string; reflection: string; theme: CardTheme }[]
> = {
  question: [
    {
      title: "The Quiet Compass",
      message:
        "This card carries an inner direction steadier than the noise around it.\n\nThe heart often leans one way long before the reasons arrive.\n\nNot every question asks for an answer; some only ask for the next small step.\n\nThe truest path is rarely the perfect one — it is the one that feels most like your own.",
      reflection: "If no one were watching, which way would you quietly lean?",
      theme: "guidance_decision",
    },
    {
      title: "The Crossing Stones",
      message:
        "This card speaks of moving across uncertain water one careful stone at a time.\n\nWhat we weigh most carefully is what matters most to us.\n\nEvery road carries its own gift, and its own cost.\n\nThe question was never which stone is perfect, but who you become as you cross.",
      reflection: "Which choice lets you be more honest with yourself?",
      theme: "guidance_decision",
    },
  ],
  feeling: [
    {
      title: "The Quiet Harbor",
      message:
        "This card is a sheltered place to set the weight down for a while.\n\nSome weariness comes not from the day, but from carrying what could not be set down.\n\nA feeling this heavy has earned its place; it need not be explained to be true.\n\nWhat must be mended can wait until the shoulders have rested.",
      reflection: "What would ease feel like, even just for an hour?",
      theme: "exhaustion_rest",
    },
    {
      title: "The Watchful Moon",
      message:
        "This card watches over what moves in the dark; nothing here goes unseen.\n\nBeneath the wish to be noticed is the older wish: simply to matter.\n\nThe one who reaches out is never as unseen as they fear.\n\nYou were seen the moment you turned toward the light.",
      reflection: "Where in your life do you already feel a little more seen?",
      theme: "feeling_unseen",
    },
  ],
  general: [
    {
      title: "The Morning Field",
      message:
        "This card is an open field at first light, asking nothing of you yet.\n\nA day does not ask us to be remarkable; it asks only that we are here for it.\n\nTo be present is its own quiet kind of enough.\n\nCarry this into the next small thing, and let it be plenty.",
      reflection: "What small thing today deserves your full attention?",
      theme: "daily_general",
    },
    {
      title: "The Quiet Return",
      message:
        "This card speaks of finding your way back to yourself.\n\nThere is an answer in you that has only been waiting for quiet enough to be heard.\n\nThe noise of the world is loud; the knowing is patient.\n\nFollow the small, honest pull you keep setting aside.",
      reflection: "What have you been quietly knowing but not saying?",
      theme: "daily_general",
    },
  ],
};

function fallbackCard(input: GenInput, rand = Math.random): GenResult {
  const pool = FALLBACK[input.intent] ?? FALLBACK.general;
  const pick = pool[Math.floor(rand() * pool.length) % pool.length];
  return {
    opener: pickOpener(undefined, rand),
    title: pick.title,
    message: pick.message,
    reflection: pick.reflection,
    theme: pick.theme,
    fallback: true,
  };
}

// Extract the first JSON object from a model response, tolerant of code fences.
export function parseCardJson(raw: string): {
  opener?: string;
  title?: string;
  message?: string;
  reflection?: string;
  theme?: string;
} | null {
  if (!raw) return null;
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function coerce(parsed: ReturnType<typeof parseCardJson>, input: GenInput): GenResult | null {
  if (!parsed) return null;
  const { opener, title, message, reflection } = parsed;
  if (!opener || !title || !message) return null;

  // Keep titles on the fixed deck so cards recur and accrue meaning. If the
  // model chose a real deck card, trust its theme; otherwise snap the title
  // back onto a deck card of the requested theme.
  const onDeck = findHalo(title);
  const theme: CardTheme = onDeck
    ? onDeck.theme
    : (CARD_THEMES as readonly string[]).includes(parsed.theme ?? "")
      ? (parsed.theme as CardTheme)
      : defaultTheme(input.intent);
  const finalTitle = onDeck
    ? onDeck.title
    : (snapToDeck(theme, message) ?? title);

  return { opener, title: finalTitle, message, reflection: reflection ?? "", theme, fallback: false };
}

/** Pick a stable deck card for a theme (deterministic by message hash). */
function snapToDeck(theme: CardTheme, seed: string): string | undefined {
  const pool = halosForTheme(theme);
  if (!pool.length) return undefined;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return pool[Math.abs(h) % pool.length].title;
}

function defaultTheme(intent: GenInput["intent"]): CardTheme {
  if (intent === "question") return "guidance_decision";
  if (intent === "feeling") return "exhaustion_rest";
  return "daily_general";
}

// Allow tests to inject a fake client. The real client is built lazily so the
// module imports cleanly without an API key.
export interface MessagesClient {
  messages: {
    create: (args: any) => Promise<{ content: Array<{ type: string; text?: string }> }>;
  };
}

let cachedClient: MessagesClient | null = null;
export function getClient(): MessagesClient | null {
  const { anthropicApiKey } = getConfig();
  if (!anthropicApiKey) return null;
  if (!cachedClient) cachedClient = new Anthropic({ apiKey: anthropicApiKey }) as MessagesClient;
  return cachedClient;
}

export async function generateCardText(
  input: GenInput,
  opts: { client?: MessagesClient | null; timeoutMs?: number } = {},
): Promise<GenResult> {
  const client = opts.client !== undefined ? opts.client : getClient();
  if (!client) return fallbackCard(input);

  const { anthropicModel } = getConfig();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const result = await Promise.race([
      client.messages.create({
        model: anthropicModel,
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserPrompt(input) }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("anthropic_timeout")), timeoutMs),
      ),
    ]);

    const text = result.content?.find((b) => b.type === "text")?.text ?? "";
    const coerced = coerce(parseCardJson(text), input);
    return coerced ?? fallbackCard(input);
  } catch {
    // Slow, unavailable, rate-limited, or malformed — degrade gracefully.
    return fallbackCard(input);
  }
}

// ---------------------------------------------------------------------------
// The Vow — a one-time reading drawn when a journey begins. Never redrawn.

/** Endurance-flavored deck cards the offline fallback may choose from. */
const VOW_FALLBACK_TITLES = [
  "The Long Road",
  "Winter Roots",
  "The Distant Lantern",
  "The Waiting Dawn",
  "The Mountain Pass",
  "The Sleeping Seed",
  "The Far Shore",
] as const;

/**
 * Deterministic offline vow: same (enduring, hope) always draws the same card,
 * so a flaky network can never quietly change someone's vow.
 */
export function fallbackVow(args: { enduring: string; hope: string }): GenResult {
  const seed = `${args.enduring}::${args.hope}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const title = VOW_FALLBACK_TITLES[Math.abs(h) % VOW_FALLBACK_TITLES.length];
  const card = HALO_DECK.find((c) => c.title === title) ?? HALO_DECK[0];
  return {
    opener: "This is the card that stepped forward to walk with you…",
    title: card.title,
    message:
      `What you are carrying is real, and it is heavy.\n\n` +
      `This card holds the hope you named — it does not promise it. No card can. ` +
      `It promises only that the road is still a road.\n\n` +
      `What holds is not the outcome. It is you, staying. That is the vow.`,
    reflection: "On the hardest night, what will you want to remember about why you began?",
    theme: card.theme,
    fallback: true,
  };
}

/** Generate the one-time vow reading. Falls back deterministically. */
export async function generateVowText(
  args: { enduring: string; hope: string; horizon?: string | null },
  opts: { client?: MessagesClient | null; timeoutMs?: number } = {},
): Promise<GenResult> {
  const client = opts.client !== undefined ? opts.client : getClient();
  if (!client) return fallbackVow(args);

  const { anthropicModel } = getConfig();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const result = await Promise.race([
      client.messages.create({
        model: anthropicModel,
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildVowPrompt(args) }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("anthropic_timeout")), timeoutMs),
      ),
    ]);
    const text = result.content?.find((b) => b.type === "text")?.text ?? "";
    const coerced = coerce(parseCardJson(text), { intent: "general" });
    return coerced ?? fallbackVow(args);
  } catch {
    return fallbackVow(args);
  }
}

export { fallbackCard };

/**
 * One tiny next step, built only from the person's own words — or, when the
 * step would need to know what a thing she named is, one short question.
 *
 * There is deliberately NO fallback. If the model is missing, slow or
 * unreachable we return null and the app simply doesn't offer a step — far
 * better than inventing something about a life we know nothing about.
 */
export async function nextTinyStep(
  input: TinyStepInput,
  opts: { client?: MessagesClient | null; timeoutMs?: number } = {},
): Promise<StepAnswer | null> {
  const client = opts.client !== undefined ? opts.client : getClient();
  if (!client) return null;

  const { anthropicModel } = getConfig();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  try {
    const result = await Promise.race([
      client.messages.create({
        model: anthropicModel,
        max_tokens: 160,
        system: TINY_STEP_SYSTEM,
        messages: [{ role: "user", content: tinyStepPrompt(input) }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("anthropic_timeout")), timeoutMs),
      ),
    ]);
    const out = parseStep(result.content?.find((b) => b.type === "text")?.text ?? "");
    // Told not to ask and asked anyway: nothing, rather than a guess.
    if (out?.kind === "ask" && input.noAsking) return null;
    return out;
  } catch {
    return null;
  }
}

/**
 * Pick the ONE road card for a wish. The model only chooses an id from the
 * fixed deck — it writes nothing. Falls back deterministically, so the same
 * wish always gets the same card even with no network.
 */
export async function hearWishes(
  text: string,
  lang: "en" | "fa",
  opts: { client?: MessagesClient | null; timeoutMs?: number } = {},
): Promise<{ wishes: HeardWish[]; fallback: boolean }> {
  const client = opts.client !== undefined ? opts.client : getClient();
  if (!client) return { wishes: fallbackHearing(text), fallback: true };

  const { anthropicModel } = getConfig();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  try {
    const result = await Promise.race([
      client.messages.create({
        model: anthropicModel,
        max_tokens: 500,
        system: HEAR_SYSTEM,
        messages: [{ role: "user", content: hearPrompt(text, lang) }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("anthropic_timeout")), timeoutMs),
      ),
    ]);
    const raw = result.content?.find((b) => b.type === "text")?.text ?? "";
    const wishes = parseHeard(raw);
    return wishes ? { wishes, fallback: false } : { wishes: fallbackHearing(text), fallback: true };
  } catch {
    return { wishes: fallbackHearing(text), fallback: true };
  }
}

/**
 * What this card means for this wish.
 *
 * Returns null with no model, on a slow one, or on an empty answer — and null
 * is fine: the card still has its own line and the deck's own sentence about
 * when it appears. Both of those were written by a person. We would rather say
 * less than invent a reading of someone's life.
 */
export async function cardReading(
  input: ReadingInput,
  opts: { client?: MessagesClient | null; timeoutMs?: number } = {},
): Promise<string | null> {
  const client = opts.client !== undefined ? opts.client : getClient();
  if (!client) return null;

  const { anthropicModel } = getConfig();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  try {
    const result = await Promise.race([
      client.messages.create({
        model: anthropicModel,
        max_tokens: 300,
        system: READING_SYSTEM,
        messages: [{ role: "user", content: readingPrompt(input) }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("anthropic_timeout")), timeoutMs),
      ),
    ]);
    return cleanReading(result.content?.find((b) => b.type === "text")?.text ?? "");
  } catch {
    return null;
  }
}
