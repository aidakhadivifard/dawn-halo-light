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
  reflection?: string;
  element?: string;
  number?: number;
  shadow?: string;
  hidden?: string;
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
  "This one turned face-up before I reached for it…",
  "The deck went still. Then this card slid forward…",
  "Something in the air shifted. This is what appeared…",
  "I did not choose this card. It chose the moment…",
  "Three cards fell. Only this one landed face-up…",
  "The deck resisted twice. Then offered this…",
];

const dailyCards: Omit<OracleCard, "id" | "createdAt">[] = [
  { art: "dawn",  theme: "daily_general",   title: "The Morning Field", element: "Air", number: 1, opener: openers[0], message: "An empty field at dawn, covered in mist and unmarked dew.\n\nThe morning arrives and waits to see how you will meet it.", shadow: "A blank field can feel like freedom or pressure, depending on what you think it demands.", hidden: "An empty field at dawn. The Freshness speaks: what you see on the surface is not the full shape. If nothing was required of you yet, how would you move?", reflection: "If nothing was required of you yet, how would you move?" },
  { art: "silk",  theme: "quiet_strength",  title: "The Still Lake", element: "Water", number: 14, opener: openers[1], message: "A lake so still it reflects the sky, with small ripples near the edge.\n\nCalm is not the absence of depth.", shadow: "Stillness can hide what needs to move.", hidden: "A lake so still it reflects the sky. The Depth speaks: what you see on the surface is not the full shape. What moves beneath your stillness?", reflection: "What moves beneath your stillness?" },
  { art: "flame", theme: "quiet_strength",  title: "The Last Ember", element: "Fire", number: 2, opener: openers[2], message: "One glowing coal in a cold fireplace.\n\nWhat is almost gone is not yet gone.", shadow: "Not every ember is meant to be revived. Some warmth is only memory.", hidden: "One glowing coal in a cold fireplace. The Revival speaks: what you see on the surface is not the full shape. If you blew on this ember, what would you be trying to bring back?", reflection: "If you blew on this ember, what would you be trying to bring back?" },
  { art: "bloom", theme: "hope_abundance",  title: "The Sleeping Seed", element: "Earth", number: 8, opener: openers[3], message: "A seed buried in dark soil. Above it, morning light begins without the seed seeing it.\n\nWhat is not visible is not absent.", shadow: "Waiting can become numbness if you forget the seed still needs tending.", hidden: "A seed buried in dark soil. The Potential speaks: what you see on the surface is not the full shape. If the seed could speak, would it call itself dead or waiting?", reflection: "If the seed could speak, would it call itself dead or waiting?" },
  { art: "moon",  theme: "daily_general",   title: "The Watchful Moon", element: "Spirit", number: 18, opener: openers[4], message: "A full moon over a dark field, illuminating without explaining.\n\nTo be seen is sometimes enough.", shadow: "Being witnessed can feel like judgment when you are used to hiding.", hidden: "A full moon over a dark field. The Witness speaks: what you see on the surface is not the full shape. What changes when you let something in you be seen without explaining it?", reflection: "What changes when you let something in you be seen without explaining it?" },
  { art: "hand",  theme: "exhaustion_rest", title: "The Quiet Harbor", element: "Water", number: 14, opener: openers[5], message: "A harbor at dusk. Boats are tied, the water is still, and no one is leaving.\n\nRest is not waiting. Rest is a destination.", shadow: "A harbor can protect you from the sea and from your own next voyage.", hidden: "A harbor at dusk. The Rest speaks: what you see on the surface is not the full shape. If rest were the destination, what would change?", reflection: "If rest were the destination, what would change?" },
];

export const REMINDERS = [
  "Drink water.",
  "Take a short walk.",
  "Finish one small task today.",
  "Sit without your phone for 5 minutes.",
  "Message someone you care about.",
  "Have a quiet cup of tea or coffee.",
  "Take one deep breath.",
  "Learn one new thing today.",
  "Start something you’ve been putting off.",
  "Tell yourself “I am okay.”",
  "Look at the sky.",
  "Write down one good thing that happened today.",
  "Stretch your body.",
  "Write a short list of what you did today.",
  "Help someone with something small.",
  "Listen to a calm song.",
  "Open a window and breathe fresh air.",
  "Tell yourself “I am enough.”",
  "Eat something nice — slowly.",
  "End the day with one deep breath.",
];

const REMINDER_HISTORY_KEY = "dawnhalo:reminderHistory";

export function todayReminder(): string {
  const today = new Date().toDateString();
  let history: { date: string; index: number }[] = [];
  if (isBrowser()) {
    try { history = JSON.parse(localStorage.getItem(REMINDER_HISTORY_KEY) || "[]"); } catch { history = []; }
  }
  const existing = history.find(h => h.date === today);
  if (existing) return REMINDERS[existing.index];
  const recentIndices = new Set(history.slice(-5).map(h => h.index));
  const available = REMINDERS.map((_, i) => i).filter(i => !recentIndices.has(i));
  const pool = available.length > 0 ? available : REMINDERS.map((_, i) => i);
  const pick = pool[Math.floor(Math.random() * pool.length)];
  history.push({ date: today, index: pick });
  if (history.length > 30) history = history.slice(-30);
  if (isBrowser()) localStorage.setItem(REMINDER_HISTORY_KEY, JSON.stringify(history));
  return REMINDERS[pick];
}

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
    { art: "moon", theme: "guidance_decision", element: "Spirit", number: 5, opener: "This one turned face-up before I reached for it…", title: "The Quiet Compass",
      message: "A compass that does not point north. It points toward something only you can feel.\n\nThe direction you need is felt before it is known.",
      shadow: "Inner knowing can be hard to hear when every outside voice sounds urgent.",
      hidden: "A compass that does not point north. The Inner Direction speaks: what you see on the surface is not the full shape. If your compass pointed to a place that does not exist yet, would you follow it?",
      reflection: "If your compass pointed to a place that does not exist yet, would you follow it?" },
    { art: "dawn", theme: "guidance_decision", element: "Water", number: 5, opener: "The deck went still. Then this card slid forward…", title: "The Crossing Stones",
      message: "Flat stones across a stream, each just wide enough for one foot.\n\nThe crossing is made one stone at a time.",
      shadow: "Looking too far ahead can make the stone beneath you disappear.",
      hidden: "Flat stones across a stream. The Stepwise Passage speaks: what you see on the surface is not the full shape. What is the next stone, not the whole crossing?",
      reflection: "What is the next stone, not the whole crossing?" },
  ],
  feeling: [
    { art: "hand", theme: "exhaustion_rest", element: "Water", number: 14, opener: "Something in the air shifted. This is what appeared…", title: "The Quiet Harbor",
      message: "A harbor at dusk. Boats are tied, the water is still, and no one is leaving.\n\nRest is not waiting. Rest is a destination.",
      shadow: "A harbor can protect you from the sea and from your own next voyage.",
      hidden: "A harbor at dusk. The Rest speaks: what you see on the surface is not the full shape. If rest were the destination, what would change?",
      reflection: "If rest were the destination, what would change?" },
    { art: "silk", theme: "exhaustion_rest", element: "Air", number: 5, opener: "I did not choose this card. It chose the moment…", title: "The Open Hand",
      message: "An open hand with nothing in it, the fingers relaxed.\n\nLetting go is not losing. It is making room.",
      shadow: "An open hand can still fear what may never arrive.",
      hidden: "An open hand with nothing in it. The Release speaks: what you see on the surface is not the full shape. What could come into your hand only if it stayed open?",
      reflection: "What could come into your hand only if it stayed open?" },
  ],
  loneliness: [
    { art: "bloom", theme: "feeling_unseen", element: "Spirit", number: 18, opener: "Three cards fell. Only this one landed face-up…", title: "The Watchful Moon",
      message: "A full moon over a dark field, illuminating without explaining.\n\nTo be seen is sometimes enough.",
      shadow: "Being witnessed can feel like judgment when you are used to hiding.",
      hidden: "A full moon over a dark field. The Witness speaks: what you see on the surface is not the full shape. What changes when you let something in you be seen without explaining it?",
      reflection: "What changes when you let something in you be seen without explaining it?" },
  ],
  appearance: [
    { art: "flame", theme: "self_image", element: "Air", number: 19, opener: "The deck resisted twice. Then offered this…", title: "The Cracked Mirror",
      message: "A mirror split by one clean crack. Every piece still reflects the same face differently.\n\nSometimes what breaks is the image, not the self.",
      shadow: "You may be mistaking one distorted reflection for the whole truth.",
      hidden: "A mirror split by one clean crack. The Distorted Seeing speaks: what you see on the surface is not the full shape. Which reflection have you been treating as the only one?",
      reflection: "Which reflection have you been treating as the only one?" },
  ],
  general: [
    { art: "dawn", theme: "daily_general", element: "Air", number: 1, opener: "This one turned face-up before I reached for it…", title: "The Morning Field",
      message: "An empty field at dawn, covered in mist and unmarked dew.\n\nThe morning arrives and waits to see how you will meet it.",
      shadow: "A blank field can feel like freedom or pressure, depending on what you think it demands.",
      hidden: "An empty field at dawn. The Freshness speaks: what you see on the surface is not the full shape. If nothing was required of you yet, how would you move?",
      reflection: "If nothing was required of you yet, how would you move?" },
    { art: "moon", theme: "daily_general", element: "Spirit", number: 6, opener: "The deck went still. Then this card slid forward…", title: "The Quiet Return",
      message: "A path leading back to a house once left, with smoke rising from its chimney.\n\nWhat you left has not necessarily left you.",
      shadow: "Returning is not the same as becoming who you used to be.",
      hidden: "A path leading back to a house once left. The Homecoming speaks: what you see on the surface is not the full shape. What would it mean to return without going backward?",
      reflection: "What would it mean to return without going backward?" },
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
