// Claude card generation with a graceful, deterministic fallback. The API key
// lives only here (server-side); it never reaches the client.

import Anthropic from "@anthropic-ai/sdk";
import { getConfig } from "../config";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import { pickOpener } from "./openers";
import { findHalo, halosForTheme } from "./deck";
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
      title: "The Quiet Compass",
      message:
        "The direction you need is felt before it is known.\n\nThe compass does not point north. It points toward something only you can feel.\n\nBut inner knowing can be hard to hear when every outside voice sounds urgent.",
      reflection: "If your compass pointed to a place that does not exist yet, would you follow it?",
      theme: "guidance_decision",
    },
    {
      title: "The Crossing Stones",
      message:
        "The crossing is made one stone at a time.\n\nEach stone asks for your full weight before it reveals the next.\n\nBut looking too far ahead can make the stone beneath you disappear.",
      reflection: "What is the next stone, not the whole crossing?",
      theme: "guidance_decision",
    },
  ],
  feeling: [
    {
      title: "The Quiet Harbor",
      message:
        "Rest is not waiting. Rest is a destination.\n\nThe boats are tied. The water is still. No one is leaving.\n\nBut a harbor can protect you from the sea and from your own next voyage.",
      reflection: "If rest were the destination, what would change?",
      theme: "exhaustion_rest",
    },
    {
      title: "The Watchful Moon",
      message:
        "To be seen is sometimes enough.\n\nThe moon illuminates without explaining.\n\nBut being witnessed can feel like judgment when you are used to hiding.",
      reflection: "What changes when you let something in you be seen without explaining it?",
      theme: "feeling_unseen",
    },
  ],
  general: [
    {
      title: "The Morning Field",
      message:
        "The morning arrives and waits to see how you will meet it.\n\nAn empty field at dawn, covered in mist and unmarked dew.\n\nA blank field can feel like freedom or pressure, depending on what you think it demands.",
      reflection: "If nothing was required of you yet, how would you move?",
      theme: "daily_general",
    },
    {
      title: "The Quiet Return",
      message:
        "What you left has not necessarily left you.\n\nThe path leads back to a house once left, with smoke rising from its chimney.\n\nBut returning is not the same as becoming who you used to be.",
      reflection: "What would it mean to return without going backward?",
      theme: "exhaustion_rest",
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
