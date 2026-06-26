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
  { art: "dawn",  theme: "daily_general",   title: "The Morning Field", element: "Air", number: 1, opener: openers[0],
    message: "An empty field at dawn, covered in mist and unmarked dew.\n\nThe morning arrives and waits to see how you will meet it.",
    shadow: "The field is not empty. It is full of what you have not yet named. Not everything needs to be seen all at once.",
    hidden: "What are you already carrying into this day that you have not set down yet?",
    reflection: "What would you set down before stepping into the field?" },
  { art: "silk",  theme: "quiet_strength",  title: "The Still Lake", element: "Water", number: 14, opener: openers[1],
    message: "A lake so still it reflects the sky, with small ripples near the edge.\n\nCalm is not the absence of depth.",
    shadow: "Something in you has been holding still — not because it is at peace, but because it is waiting for permission. That ripple at the edge is yours.",
    hidden: "The lake does not need to be disturbed to be deep. But it does need to be entered.",
    reflection: "What have you kept beneath the surface that is ready to rise?" },
  { art: "flame", theme: "quiet_strength",  title: "The Last Ember", element: "Fire", number: 2, opener: openers[2],
    message: "One glowing coal in a cold fireplace.\n\nWhat is almost gone is not yet gone.",
    shadow: "This ember survived not by burning bright but by knowing when to glow quietly. Not everything that endures does so by fighting.",
    hidden: "Something you thought had gone out — it hasn't. It is not asking you to build a bonfire. It is asking: do you still want warmth, or have you gotten used to the cold?",
    reflection: "Do you still want warmth, or have you gotten used to the cold?" },
  { art: "bloom", theme: "hope_abundance",  title: "The Sleeping Seed", element: "Earth", number: 8, opener: openers[3],
    message: "A seed buried in dark soil. Above it, morning light begins without the seed seeing it.\n\nWhat is not visible is not absent.",
    shadow: "The seed does not know the sun has risen. It only knows the soil is warmer. Sometimes you are the last to know something has already begun to change.",
    hidden: "Something is growing in you. You cannot see it because you keep looking in the wrong place. The seed does not check the sky — it trusts the warmth beneath it.",
    reflection: "What has already begun to change that you haven't noticed yet?" },
  { art: "moon",  theme: "daily_general",   title: "The Watchful Moon", element: "Spirit", number: 18, opener: openers[4],
    message: "A full moon over a dark field, illuminating without explaining.\n\nTo be seen is sometimes enough.",
    shadow: "You have been performing for an audience that is not there. The moon shines on an empty field and does not call it a waste.",
    hidden: "Stop explaining yourself to people who are not in the room.",
    reflection: "Who are you still explaining yourself to?" },
  { art: "hand",  theme: "exhaustion_rest", title: "The Quiet Harbor", element: "Water", number: 14, opener: openers[5],
    message: "A harbor at dusk. Boats are tied, the water is still, and no one is leaving.\n\nRest is not waiting. Rest is a destination.",
    shadow: "A harbor is not a pause — it is a place. The ropes are not holding you back. They are holding you steady.",
    hidden: "You are more tired than you have admitted — the kind that comes from carrying something you forgot you picked up. Put it down. Not forever. Just here.",
    reflection: "What have you been carrying that you forgot you picked up?" },
];

const ACTIONS: string[] = [
  "Drink water.",
  "Take a short walk.",
  "Finish one small task today.",
  "Sit without your phone for 5 minutes.",
  "Message someone you care about.",
  "Have a quiet cup of tea or coffee.",
  "Take one deep breath.",
  "Learn one new thing today.",
  "Start something you've been putting off.",
  "Tell yourself: I am okay.",
  "Look at the sky.",
  "Write down one good thing that happened today.",
  "Stretch your body.",
  "Write a short list of what you did today.",
  "Help someone with something small.",
  "Listen to a calm song.",
  "Open a window and breathe fresh air.",
  "Tell yourself: I am enough.",
  "Eat something nice, slowly.",
  "End the day with one deep breath.",
];

export const REMINDERS = ACTIONS;

const CARD_BRIDGES: Record<string, string[]> = {
  "The Morning Field": [
    "The field is still fresh — let something good in.",
    "Step into the day gently, like the mist does.",
    "The morning is not asking much. Neither should you.",
  ],
  "The Still Lake": [
    "Let the stillness do its work.",
    "Depth does not require motion.",
    "The surface is calm — trust what is beneath.",
  ],
  "The Last Ember": [
    "Something in you is still glowing. Feed it gently.",
    "Not everything needs to burn bright to be alive.",
    "Warmth does not need to be loud.",
  ],
  "The Sleeping Seed": [
    "Something is growing that you cannot see yet.",
    "Trust the warmth beneath the surface.",
    "Not everything announces its arrival.",
  ],
  "The Watchful Moon": [
    "You are already seen.",
    "You do not need to explain yourself today.",
    "The light is already here — you just need to stand in it.",
  ],
  "The Quiet Harbor": [
    "Rest is not waiting — it is a destination.",
    "You are allowed to stop here.",
    "The ropes are not holding you back. They are holding you steady.",
  ],
  "The Quiet Compass": [
    "You already know the direction.",
    "Trust the pull, not the map.",
    "The compass is not broken — you are just afraid of where it points.",
  ],
  "The Crossing Stones": [
    "One step is enough for today.",
    "The path is made by the feet that trust it.",
    "You do not need to see the last stone to step on the first.",
  ],
  "The Open Hand": [
    "Your hand is open — let something good in today.",
    "Letting go is not losing. It is making room.",
    "What comes next needs a different shape.",
  ],
  "The Cracked Mirror": [
    "You are more than what the glass shows.",
    "Turn away from the mirror for a moment — just breathe.",
    "The crack was never yours.",
  ],
  "The Quiet Return": [
    "What you left has not necessarily left you.",
    "Home is something you carry.",
    "You do not need to go back to bring something forward.",
  ],
};

const THEME_BRIDGES: Record<string, string[]> = {
  daily_general: ["The day is open. So are you.", "Today does not need to be perfect."],
  guidance_decision: ["Trust what you already know.", "The next step is closer than you think."],
  exhaustion_rest: ["Rest is not giving up.", "You have done enough for now."],
  quiet_strength: ["Strength does not always look like motion.", "Stillness is its own kind of power."],
  hope_abundance: ["Something good is on its way.", "Not everything announces its arrival."],
  feeling_unseen: ["You are visible — even now.", "You do not need to be noticed to matter."],
  self_image: ["You are more than what you see.", "Be gentle with yourself today."],
  release_change: ["Let it go gently.", "Change does not always mean loss."],
  relationship_tension: ["Give it space. Space is not distance.", "Some knots loosen on their own."],
};

const REMINDER_HISTORY_KEY = "dawnhalo:reminderHistory";

export function todayReminder(card?: { title?: string; theme?: string }): string {
  const today = new Date().toDateString();
  let history: { date: string; index: number }[] = [];
  if (isBrowser()) {
    try { history = JSON.parse(localStorage.getItem(REMINDER_HISTORY_KEY) || "[]"); } catch { history = []; }
  }

  let actionIdx: number;
  const existing = history.find(h => h.date === today);
  if (existing) {
    actionIdx = existing.index;
  } else {
    const recentIndices = new Set(history.slice(-5).map(h => h.index));
    const available = ACTIONS.map((_, i) => i).filter(i => !recentIndices.has(i));
    const pool = available.length > 0 ? available : ACTIONS.map((_, i) => i);
    actionIdx = pool[Math.floor(Math.random() * pool.length)];
    history.push({ date: today, index: actionIdx });
    if (history.length > 30) history = history.slice(-30);
    if (isBrowser()) localStorage.setItem(REMINDER_HISTORY_KEY, JSON.stringify(history));
  }

  const action = ACTIONS[actionIdx];

  if (!card) return action;

  const bridges = (card.title && CARD_BRIDGES[card.title]) ||
    (card.theme && THEME_BRIDGES[card.theme]) ||
    null;

  if (!bridges) return action;

  const bridge = bridges[hashStr(today + action) % bridges.length];
  return `${action} ${bridge}`;
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
      shadow: "You already know which way to go. The reason you are asking is not that you are lost — it is that the direction frightens you.",
      hidden: "The compass does not give you a new direction. It shows you the one you have been avoiding.",
      reflection: "What are you afraid will happen if you follow where you already know to go?" },
    { art: "dawn", theme: "guidance_decision", element: "Water", number: 5, opener: "The deck went still. Then this card slid forward…", title: "The Crossing Stones",
      message: "Flat stones across a stream, each just wide enough for one foot.\n\nThe crossing is made one stone at a time.",
      shadow: "You are trying to see the last stone before stepping on the first. The danger is not falling in — it is standing on the bank so long you convince yourself the water is an ocean.",
      hidden: "You already know the next step. Not the whole path — just the next stone. Step. Then look again.",
      reflection: "What is the one next step you already know but keep postponing?" },
  ],
  feeling: [
    { art: "hand", theme: "exhaustion_rest", element: "Water", number: 14, opener: "Something in the air shifted. This is what appeared…", title: "The Quiet Harbor",
      message: "A harbor at dusk. Boats are tied, the water is still, and no one is leaving.\n\nRest is not waiting. Rest is a destination.",
      shadow: "A harbor is not a pause — it is a place. The ropes are not holding you back. They are holding you steady.",
      hidden: "You are more tired than you have admitted — the kind that comes from carrying something you forgot you picked up. Put it down. Not forever. Just here.",
      reflection: "What have you been carrying that you forgot you picked up?" },
    { art: "silk", theme: "exhaustion_rest", element: "Air", number: 5, opener: "I did not choose this card. It chose the moment…", title: "The Open Hand",
      message: "An open hand with nothing in it, the fingers relaxed.\n\nLetting go is not losing. It is making room.",
      shadow: "Your hand has been open a long time, but you keep checking whether something has arrived. The hand is not empty because you lost something. It is empty because you are ready.",
      hidden: "You are not grieving the thing — you are grieving the grip. Let the hand soften. What comes next needs a different shape.",
      reflection: "What shape has your grip left behind?" },
  ],
  loneliness: [
    { art: "bloom", theme: "feeling_unseen", element: "Spirit", number: 18, opener: "Three cards fell. Only this one landed face-up…", title: "The Watchful Moon",
      message: "A full moon over a dark field, illuminating without explaining.\n\nTo be seen is sometimes enough.",
      shadow: "You have been waiting for someone specific to see you. But the light is already here. The question is not who will notice you — it is what you do when no one is watching.",
      hidden: "You are visible. Right now. The field is not empty because no one came — it is empty because you are the only one who needs to be here.",
      reflection: "What part of you are you waiting for someone else to see first?" },
  ],
  appearance: [
    { art: "flame", theme: "self_image", element: "Air", number: 19, opener: "The deck resisted twice. Then offered this…", title: "The Cracked Mirror",
      message: "A mirror split by one clean crack. Every piece still reflects the same face differently.\n\nSometimes what breaks is the image, not the self.",
      shadow: "You have been looking in a mirror someone else cracked. The distortion is not yours — it was placed there.",
      hidden: "Turn away from the glass. How do you feel when no mirror is present — when there is only you, in a room, breathing? That feeling is closer to real.",
      reflection: "How do you feel about yourself when no mirror is present?" },
  ],
  general: [
    { art: "dawn", theme: "daily_general", element: "Air", number: 1, opener: "This one turned face-up before I reached for it…", title: "The Morning Field",
      message: "An empty field at dawn, covered in mist and unmarked dew.\n\nThe morning arrives and waits to see how you will meet it.",
      shadow: "The field is not empty. It is full of what you have not yet named. Not everything needs to be seen all at once.",
      hidden: "What are you already carrying into this day that you have not set down yet?",
      reflection: "What would you set down before stepping into the field?" },
    { art: "moon", theme: "daily_general", element: "Spirit", number: 6, opener: "The deck went still. Then this card slid forward…", title: "The Quiet Return",
      message: "A path leading back to a house once left, with smoke rising from its chimney.\n\nWhat you left has not necessarily left you.",
      shadow: "The smoke means someone kept the fire going while you were away. Not everything you walked away from was a mistake.",
      hidden: "Home is not a place you return to — it is something you carry. You have been homesick for a version of yourself, not a place.",
      reflection: "What part of who you used to be do you miss the most?" },
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
