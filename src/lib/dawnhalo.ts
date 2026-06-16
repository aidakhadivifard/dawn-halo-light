// Dawnhalo prototype data + mocked oracle logic.
import silk from "@/assets/card-silk.jpg";
import flame from "@/assets/card-flame.jpg";
import dawn from "@/assets/card-dawn.jpg";
import hand from "@/assets/card-hand.jpg";
import moon from "@/assets/card-moon.jpg";
import bloom from "@/assets/card-bloom.jpg";
import { CARD_LIBRARY, cardsByTheme, type CardTheme } from "@/lib/cardLibrary";

export type { CardTheme } from "@/lib/cardLibrary";
export type CardArt = "silk" | "flame" | "dawn" | "hand" | "moon" | "bloom";

export const ART: Record<CardArt, string> = { silk, flame, dawn, hand, moon, bloom };

export type OracleCard = {
  id: string;
  art: CardArt;
  theme: CardTheme;
  opener: string;
  title: string;
  message: string;
  savedAt?: string;
  createdAt: string;
  prompt?: string;
};

function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Pick a library image for the card, stable across renders for the same card id. */
export function artForCard(card: { id: string; theme?: CardTheme; art?: CardArt }): string {
  if (card.theme) {
    const pool = cardsByTheme(card.theme);
    if (pool.length) return pool[hashStr(card.id) % pool.length].src;
  }
  if (card.art) return ART[card.art];
  return CARD_LIBRARY[hashStr(card.id) % CARD_LIBRARY.length].src;
}

const openers = [
  "Let me read what this card is saying about your morning…",
  "Sit with me a moment — the energy is settling in…",
  "Mm. This one stepped forward before I even shuffled…",
  "I'm catching something quiet around your question…",
  "Here — this is the card that wanted to be seen today…",
  "Let me lean in and listen to what's underneath this…",
];

const dailyCards: Omit<OracleCard, "id" | "createdAt">[] = [
  { art: "dawn",  theme: "daily_general",   title: "The Gentle Return",  opener: openers[0], message: "You don't need to rush into the noise just yet. Today asks only for your presence, not your productivity." },
  { art: "silk",  theme: "quiet_strength",  title: "The Still Point",    opener: openers[1], message: "There is a deep, quiet strength in moving at the pace of your own breath. Let the day come to meet you." },
  { art: "flame", theme: "quiet_strength",  title: "Small Steady Light", opener: openers[2], message: "You do not need to burn brighter. You only need to keep burning. That is more than enough today." },
  { art: "bloom", theme: "hope_abundance",  title: "What Wants to Open", opener: openers[3], message: "Something tender is reaching toward the light in you. Notice it without rushing to name it." },
  { art: "moon",  theme: "daily_general",   title: "The Soft Knowing",   opener: openers[4], message: "You already know. Trust the version of you who's been quietly paying attention all along." },
  { art: "hand",  theme: "exhaustion_rest", title: "The Held Hour",      opener: openers[5], message: "You are not carrying it alone, even when it feels that way. Set something down for an hour and see." },
];

export const REMINDERS = [
  "Your worth is not a production metric. You're allowed to simply exist.",
  "Drink some water. The body carries the mind's weight.",
  "One slow breath before you reply to that message.",
  "You don't owe anyone a polished version of today.",
  "Notice one warm thing on your way somewhere.",
];

export type Intent = "crisis" | "question" | "feeling" | "loneliness" | "appearance" | "general";

const CRISIS = ["suicide","suicidal","kill myself","end it","end my life","want to die","hurt myself","self harm","self-harm","hopeless","no point","can't go on"];
const LONELINESS = ["no one notices","nobody notices","no one sees me","invisible","nobody loves","alone","lonely","unseen","unlovable","wish someone would"];
const APPEARANCE = ["ugly","fat","skinny","my body","my face","look bad","look old","hate how i look","pretty","beautiful enough","not pretty"];

export function classifyInput(raw: string): Intent {
  const t = raw.toLowerCase();
  if (CRISIS.some(k => t.includes(k))) return "crisis";
  if (LONELINESS.some(k => t.includes(k))) return "loneliness";
  if (APPEARANCE.some(k => t.includes(k))) return "appearance";
  if (t.trim().endsWith("?") || /\b(should i|will i|can i|do i|is it)\b/.test(t)) return "question";
  if (/\b(i feel|i'm|im |i am|i had|fight|tired|exhausted|sad|angry|anxious|scared|overwhelmed)\b/.test(t)) return "feeling";
  return "general";
}

const responses: Record<Exclude<Intent, "crisis">, Omit<OracleCard, "id" | "createdAt" | "prompt">[]> = {
  question: [
    { art: "moon", theme: "guidance_decision", opener: "Let me lean in — your question has weight to it…", title: "The Patient Choice",
      message: "This isn't a yes-or-no answer; it's a next step. Ask what you'd choose if no one were watching, then take the smallest version of that today." },
    { art: "dawn", theme: "guidance_decision", opener: "Mm. This card stepped forward the moment you asked…", title: "Two Doors, One You",
      message: "Either path holds something for you. The real question is which version of yourself you want to practice being." },
  ],
  feeling: [
    { art: "hand", theme: "exhaustion_rest", opener: "Let me sit with what you just said for a moment…", title: "It Makes Sense",
      message: "Of course you feel this way — anyone would, in your shoes. Let it be true first. Reframing can wait until your shoulders drop." },
    { art: "silk", theme: "exhaustion_rest", opener: "I'm catching something tender underneath this…", title: "Soften, Don't Solve",
      message: "Nothing here needs fixing in the next ten minutes. Put a hand on your chest and breathe with it. The next step will show up when you're warmer." },
  ],
  loneliness: [
    { art: "bloom", theme: "feeling_unseen", opener: "I want to read this one slowly with you…", title: "You Are Seen Here",
      message: "Right now, in this small quiet moment, you are noticed — by this card, and by the part of you that reached for it. You are not as invisible as today felt." },
  ],
  appearance: [
    { art: "flame", theme: "self_image", opener: "Let me move past the surface of what you said…", title: "Tend the Light, Not the Lamp",
      message: "What does today actually ask of you — rest, courage, softness? Let's start there. That's the part of you the world is really meeting." },
  ],
  general: [
    { art: "dawn", theme: "daily_general", opener: "Here — this is the card that wanted to be seen today…", title: "A Little Light",
      message: "You're doing better than you think. Take this with you into the next small thing." },
    { art: "moon", theme: "daily_general", opener: "Mm. The deck settled on this one quickly…", title: "Trust the Quiet Lead",
      message: "Follow the small impulse you've been brushing aside. It's the most honest thing in the room." },
  ],
};

let idCounter = 0;
const newId = () => `c_${Date.now().toString(36)}_${(idCounter++).toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

export type OracleResult = { kind: "crisis" } | { kind: "card"; card: OracleCard };

export function drawDailyCard(seedDate: Date = new Date()): OracleCard {
  const idx = (seedDate.getFullYear() * 1000 + seedDate.getMonth() * 31 + seedDate.getDate()) % dailyCards.length;
  const base = dailyCards[idx];
  return { ...base, id: `daily_${seedDate.toDateString()}`, createdAt: seedDate.toISOString() };
}

export function drawRandomCard(prompt?: string): OracleCard {
  const base = dailyCards[Math.floor(Math.random() * dailyCards.length)];
  return { ...base, id: newId(), createdAt: new Date().toISOString(), prompt };
}

export function askOracle(prompt: string): OracleResult {
  const intent = classifyInput(prompt);
  if (intent === "crisis") return { kind: "crisis" };
  const pool = responses[intent];
  const base = pool[Math.floor(Math.random() * pool.length)];
  return { kind: "card", card: { ...base, id: newId(), createdAt: new Date().toISOString(), prompt } };
}

const SAVED_KEY = "dawnhalo:saved";
const HISTORY_KEY = "dawnhalo:history";
const DRAW_COUNT_KEY = "dawnhalo:drawCount";
const SETTINGS_KEY = "dawnhalo:settings";

const isBrowser = () => typeof window !== "undefined";

export function loadSaved(): OracleCard[] {
  if (!isBrowser()) return [];
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"); } catch { return []; }
}
export function saveCard(card: OracleCard) {
  if (!isBrowser()) return;
  const list = loadSaved();
  if (list.some(c => c.id === card.id)) return;
  localStorage.setItem(SAVED_KEY, JSON.stringify([{ ...card, savedAt: new Date().toISOString() }, ...list]));
}
export function removeSaved(id: string) {
  if (!isBrowser()) return;
  localStorage.setItem(SAVED_KEY, JSON.stringify(loadSaved().filter(c => c.id !== id)));
}
export function isSaved(id: string): boolean {
  return loadSaved().some(c => c.id === id);
}

export function loadHistory(): OracleCard[] {
  if (!isBrowser()) return [];
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}
export function recordHistory(card: OracleCard) {
  if (!isBrowser()) return;
  const list = loadHistory();
  if (list.some(c => c.id === card.id)) return;
  localStorage.setItem(HISTORY_KEY, JSON.stringify([card, ...list].slice(0, 200)));
}

export function getDrawCount(): number {
  if (!isBrowser()) return 0;
  return Number(localStorage.getItem(DRAW_COUNT_KEY) || "0");
}
export function bumpDrawCount() { if (isBrowser()) localStorage.setItem(DRAW_COUNT_KEY, String(getDrawCount() + 1)); }
export function resetDrawCount() { if (isBrowser()) localStorage.setItem(DRAW_COUNT_KEY, "0"); }

export const FREE_DRAWS = 3;

export type Settings = { reminderTime: string; notificationsOn: boolean };
export function loadSettings(): Settings {
  if (!isBrowser()) return { reminderTime: "07:30", notificationsOn: true };
  try {
    return { reminderTime: "07:30", notificationsOn: true, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch { return { reminderTime: "07:30", notificationsOn: true }; }
}
export function saveSettings(s: Settings) { if (isBrowser()) localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

export function computeStreak(history: OracleCard[]): number {
  if (history.length === 0) return 0;
  const days = new Set(history.map(c => new Date(c.createdAt).toDateString()));
  let streak = 0;
  const cursor = new Date();
  while (days.has(cursor.toDateString())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function cardsByDay(history: OracleCard[]): Record<string, OracleCard[]> {
  const map: Record<string, OracleCard[]> = {};
  for (const c of history) {
    const key = new Date(c.createdAt).toDateString();
    (map[key] ||= []).push(c);
  }
  return map;
}

export function encodeShare(card: OracleCard, note?: string): string {
  const payload = { t: card.title, o: card.opener, m: card.message, a: card.art, th: card.theme, n: note || "" };
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}
export function decodeShare(token: string): { title: string; opener: string; message: string; art: CardArt; theme: CardTheme; note: string } | null {
  try {
    const o = JSON.parse(decodeURIComponent(escape(atob(token))));
    return { title: o.t, opener: o.o, message: o.m, art: o.a, theme: (o.th ?? "daily_general") as CardTheme, note: o.n || "" };
  } catch { return null; }
}
