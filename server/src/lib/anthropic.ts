// Claude card generation with a graceful, deterministic fallback. The API key
// lives only here (server-side); it never reaches the client.

import Anthropic from "@anthropic-ai/sdk";
import { getConfig } from "../config";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import { pickOpener } from "./openers";
import { CARD_THEMES, type CardTheme } from "../types";

export interface GenInput {
  intent: "question" | "feeling" | "general";
  text?: string;
  previous?: { title: string; message: string };
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
      title: "The Patient Choice",
      message:
        "The heart often leans one way long before the reasons arrive.\n\nNot every question asks for an answer; some only ask for the next small step.\n\nThe truest path is rarely the perfect one — it is the one that feels most like your own.",
      reflection: "If no one were watching, which way would you quietly lean?",
      theme: "guidance_decision",
    },
    {
      title: "Two Doors, One You",
      message:
        "What we weigh most carefully is what matters most to us.\n\nEvery road carries its own gift, and its own cost.\n\nThe question was never which door is right, but who you wish to become as you walk through it.",
      reflection: "Which choice lets you be more honest with yourself?",
      theme: "guidance_decision",
    },
  ],
  feeling: [
    {
      title: "It Makes Sense",
      message:
        "Some weariness comes not from the day, but from carrying what could not be set down.\n\nA feeling this heavy has earned its place; it need not be explained to be true.\n\nWhat must be mended can wait until the shoulders have rested.",
      reflection: "What would ease feel like, even just for an hour?",
      theme: "exhaustion_rest",
    },
    {
      title: "You Are Seen Here",
      message:
        "Beneath the wish to be noticed is the older wish: simply to matter.\n\nThe one who reaches out is never as unseen as they fear.\n\nYou were seen the moment you turned toward the light.",
      reflection: "Where in your life do you already feel a little more seen?",
      theme: "feeling_unseen",
    },
  ],
  general: [
    {
      title: "A Little Light",
      message:
        "A day does not ask us to be remarkable; it asks only that we are here for it.\n\nTo be present is its own quiet kind of enough.\n\nCarry this into the next small thing, and let it be plenty.",
      reflection: "What small thing today deserves your full attention?",
      theme: "daily_general",
    },
    {
      title: "The Soft Knowing",
      message:
        "There is an answer in you that has only been waiting for quiet enough to be heard.\n\nThe noise of the world is loud; the knowing is patient.\n\nFollow the small, honest pull you keep setting aside.",
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
  const theme = (CARD_THEMES as readonly string[]).includes(parsed.theme ?? "")
    ? (parsed.theme as CardTheme)
    : defaultTheme(input.intent);
  return { opener, title, message, reflection: reflection ?? "", theme, fallback: false };
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
function getClient(): MessagesClient | null {
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

export { fallbackCard };
