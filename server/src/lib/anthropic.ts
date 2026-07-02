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

type FallbackEntry = { title: string; message: string; reflection: string; theme: CardTheme };

// Domain-aware fallbacks for questions, so "will I get rich" and "when will my
// baby come" never receive the same card. Matched in order; first hit wins.
const QUESTION_DOMAINS: { pattern: RegExp; cards: FallbackEntry[] }[] = [
  {
    // money / wealth / debt
    pattern: /\b(rich|money|wealth|salary|income|debt|broke|financ|lottery|invest|business|afford)\b/i,
    cards: [
      {
        title: "The Gathering Harvest",
        message:
          "This card is reward that arrives slowly, through staying.\n\nThe card leans yes — the kind of wealth that gathers, not the kind that strikes. What fills the barn is the years you do not walk away.\n\nIt asks one thing: do not scatter what you have started.",
        reflection: "Which seed you already hold would grow if you fed it?",
        theme: "hope_abundance",
      },
    ],
  },
  {
    // children / pregnancy / family growth
    pattern: /\b(baby|babies|child|children|pregnan|conceive|kid|son|daughter|family grow)\b/i,
    cards: [
      {
        title: "The Sleeping Seed",
        message:
          "This card is life not yet visible, already alive.\n\nNot this season — the card speaks of ground still being made ready. It does not say no. It says the door has not closed.\n\nWhat is meant to grow gathers itself in the dark first.",
        reflection: "What would you want ready, the day the waiting ends?",
        theme: "hope_abundance",
      },
    ],
  },
  {
    // another person's heart / love / return
    pattern: /\b(love|marry|marriage|wedding|boyfriend|girlfriend|husband|wife|crush|soulmate|think(s)? (about|of) me|come back|miss(es)? me|text me|ex\b)\b/i,
    cards: [
      {
        title: "The Distant Bell",
        message:
          "This card is a call that carries farther than we know.\n\nThe card leans yes — a bell rung once keeps humming, and something of you lingers where you were. What no card can see is whether that thread should be pulled or released.\n\nThat part was always yours to decide.",
        reflection: "If the answer were yes, what would you do with it?",
        theme: "feeling_unseen",
      },
    ],
  },
  {
    // work / career / study
    pattern: /\b(job|work|career|promotion|boss|interview|exam|study|degree|college|hired|fired|quit)\b/i,
    cards: [
      {
        title: "The Climbing Path",
        message:
          "This card is effort that gains ground, step over step.\n\nThe card leans yes — but by the climb, not the leap. What you are building holds more weight than it shows from where you stand.\n\nThe pass opens to the one still walking.",
        reflection: "What is one stretch of this climb you can finish this week?",
        theme: "guidance_decision",
      },
    ],
  },
  {
    // bare timing questions that matched no other domain
    pattern: /\b(when will|how long|how soon|what year|which month)\b/i,
    cards: [
      {
        title: "The Waiting Dawn",
        message:
          "This card is the light that always returns after a long night.\n\nSooner than fear says, later than longing wants. The card gives seasons, not dates — and this season is for what must fill first.\n\nDawn has never once forgotten a horizon.",
        reflection: "What would you begin now, if you knew it was coming?",
        theme: "hope_abundance",
      },
    ],
  },
];

// A small, tasteful offline library used when Claude is slow/unavailable, or
// for any parse failure. Keeps the app working end-to-end without a key.
const FALLBACK: Record<
  GenInput["intent"],
  FallbackEntry[]
> = {
  question: [
    {
      title: "The Quiet Compass",
      message:
        "This card carries an inner direction steadier than the noise around it.\n\nThe card leans toward the way you were already facing — the heart often leans long before the reasons arrive.\n\nThe truest path is rarely the perfect one; it is the one that feels most like your own.",
      reflection: "If no one were watching, which way would you quietly lean?",
      theme: "guidance_decision",
    },
    {
      title: "The Crossing Stones",
      message:
        "This card speaks of crossing uncertain water one stone at a time.\n\nThe card leans yes — but only stone by stone. Every road carries its own gift and its own cost.\n\nThe question was never which stone is perfect, but who you become as you cross.",
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
  let pool = FALLBACK[input.intent] ?? FALLBACK.general;
  if (input.intent === "question" && input.text) {
    const domain = QUESTION_DOMAINS.find((d) => d.pattern.test(input.text!));
    if (domain) pool = domain.cards;
  }
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
