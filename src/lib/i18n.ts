// Languages.
//
// One file, one dictionary per language, one flat key space — small enough to
// read top to bottom, so nobody has to hunt for the sentence they want to
// change. Farsi is not a translation of the English: it is how the thing would
// be said in Farsi, which is not always the same sentence.
//
// The card names and lines live here too, keyed by the card id the server
// sends. The server never writes prose in any language; it only ever answers
// with an id, so every word a person reads was written by a human.

export type Lang = "en" | "fa";
export const LANGS: { code: Lang; label: string; dir: "ltr" | "rtl" }[] = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "fa", label: "فارسی", dir: "rtl" },
];

export function dirOf(lang: Lang): "ltr" | "rtl" {
  return lang === "fa" ? "rtl" : "ltr";
}

const EN = {
  // The wish
  wishAsk: "What do you wish for?",
  wishHint: "In your own words. However you'd say it out loud.",
  wishPlaceholder: "I wish for…",
  wishSave: "This is my wish",
  wishEdit: "Change my words",
  wishSealed: "These words are sealed now.",
  drawing: "Drawing your wish…",

  // What was heard. People write everything at once; the app says it back and
  // lets them choose which wish gets the card. The rest are kept.
  heardOne: (echo: string) => `I hear one wish: ${echo}.`,
  heardMany: (echoes: string[]) =>
    `I hear ${countEn(echoes.length)} wishes: ${listEn(echoes)}.`,
  /** When it only split on punctuation: say the count, and let her own lines speak. */
  heardCount: (n: number) => `I hear ${countEn(n)} wishes in this.`,
  whichFirst: (n: number) =>
    `These sound like ${countEn(n)} wishes. Which one should we make a card for first?`,
  nothingLost: "Nothing is lost. We'll keep the others here for later.",
  waiting: "Waiting their turn",
  drawingWait: "It takes a minute. You can go on; it will be here.",

  // The card. The Oracle does not compute odds — it says what KIND of road
  // this is: slow, steep, unclear, one that asks for patience.
  wishTookShape: "Your wish has taken shape.",
  cardAsk: "Shall we ask the Oracle what kind of path lies ahead?",
  cardDraw: "Draw my card",
  notNow: "Not now",
  askOracle: "Ask the Oracle",
  // Not a warning. The same commitment, said in a way that does not frighten
  // someone who thinks they made a typo.
  cardWarn: "When you draw, this wish becomes the one this card will stay with.",
  cardWarnCalm: "You can always begin another wish later.",
  cardKeep: "Keep it",
  cardAll: "Every card says it can happen. They only differ in how the road runs.",

  // The day
  todayAsk: "What did you do today for your wish?",
  todayStayed: "I endured and kept going",
  todayDid: "I did one small thing",
  todayStuck: "I did nothing, and it bothers me",
  // What the app says the moment someone admits they couldn't. Acknowledgment
  // first — always. A task offered before this line would say: your sadness is
  // a productivity problem.
  stuckAck: "I know. Coming here and saying it was something, today.",
  stuckOffer: "Want to do one very small thing together? Small enough to be funny.",
  stuckNo: "No, I just wanted to say it",
  todayWhat: "What was it? Tell me.",
  todayPlaceholder: "Today I…",
  todaySave: "Save",
  todayDone: "That counts. It always counts.",
  // The headline over the picture once today has been answered.
  aliveLine: "A little more alive.",
  // The witness's line, in his hand. Third person, no name yet — never praise.
  sawDid: "One small step today. I saw it.",
  sawStayed: "Stayed today. I saw it.",
  sawStuck: "Came today, and said it. I saw it.",
  todayAlready: "You already answered today.",
  bothCount: "Both count the same.",

  // The tiny step — offered only after "I did one small thing", never after
  // "I endured". Put on your running clothes. That's all. Don't exercise.
  stepOffer: "Want to take one more, right now? A tiny one.",
  stepYes: "Alright, tell me",
  stepNo: "No, that's enough",
  stepDid: "Did it",
  stepEnough: "Enough for today",
  stepMore: "A little more?",
  stepClosed: "That's plenty. You showed up today.",
  stepThinking: "Thinking of something small…",

  // The witness
  witnessAsk: "Would you like someone to see this?",
  witnessYes: "Yes, show someone",
  witnessNo: "Not today",
  witnessEdit: "You can change every word before it goes.",
  witnessSendNow: "Send now",
  witnessWait: "Wait a week",
  witnessUntilColor: "Wait until the picture has its colors",
  witnessMessage: (deed: string) => `Today I ${deed}, and I'm proud of myself. I wanted you to know.`,

  // The shell
  navWish: "Wish",
  navNotebook: "Notebook",
  tellToday: "Tell me about today",
  switchLang: "فارسی",

  // The notebook — every line the witness has written, each one a card she can send.
  notebookTitle: "What he wrote",
  notebookEmpty: "Nothing written yet. The first line comes the first day you answer.",
  nthTime: (n: number) => `The ${ordinalEn(n)} time she came for it. I saw it.`,
  share: "Send this",
  shared: "Sent",

  // Misc
  language: "Language",
  back: "Back",
  crisisTitle: "You don't have to hold this alone",
};

/** Every language fills exactly this shape — a missing key is a build error. */
type Dict = typeof EN;

const FA: Dict = {
  wishAsk: "چه آرزویی داری؟",
  wishHint: "با کلمات خودت. همان‌طور که بلند می‌گویی.",
  wishPlaceholder: "آرزو می‌کنم…",
  wishSave: "این آرزوی من است",
  wishEdit: "کلمه‌هایم را عوض کن",
  wishSealed: "این کلمه‌ها دیگر ثبت شده‌اند.",
  drawing: "دارم آرزویت را می‌کشم…",

  heardOne: (echo: string) => `یک آرزو می‌شنوم: ${echo}.`,
  heardMany: (echoes: string[]) => `${countFa(echoes.length)} آرزو می‌شنوم: ${listFa(echoes)}.`,
  heardCount: (n: number) => `${countFa(n)} آرزو در این می‌شنوم.`,
  whichFirst: (n: number) =>
    `این‌ها ${countFa(n)} آرزوی جداگانه‌اند. اول برای کدام کارت بکشیم؟`,
  nothingLost: "هیچ‌کدام از دست نمی‌رود. بقیه را همین‌جا نگه می‌داریم برای بعد.",
  waiting: "منتظر نوبتشان",
  drawingWait: "یک دقیقه طول می‌کشد. برو به کارت برس؛ همین‌جا می‌ماند.",

  wishTookShape: "آرزویت شکل گرفت.",
  cardAsk: "از اوراکل بپرسیم چه راهی در پیش است؟",
  cardDraw: "کارتم را بکش",
  notNow: "الان نه",
  askOracle: "از اوراکل بپرس",
  cardWarn: "وقتی بکشی، این کارت با همین آرزو می‌ماند.",
  cardWarnCalm: "هر وقت خواستی می‌توانی آرزوی دیگری را شروع کنی.",
  cardKeep: "نگهش می‌دارم",
  cardAll: "همهٔ کارت‌ها می‌گویند می‌شود. فقط راهش با هم فرق دارد.",

  todayAsk: "امروز برای آرزویت چه کردی؟",
  todayStayed: "تحمل کردم و ادامه دادم",
  todayDid: "یک کار کوچک کردم",
  todayStuck: "کاری نکردم و ناراحتم",
  stuckAck: "می‌دانم. همین که امروز آمدی و گفتی، خودش چیزی بود.",
  stuckOffer: "می‌خواهی یک کار خیلی کوچک با هم انجام دهیم؟ آن‌قدر کوچک که خنده‌دار باشد.",
  stuckNo: "نه، فقط خواستم بگویم",
  todayWhat: "چه کار کردی؟ برایم بنویس.",
  todayPlaceholder: "امروز…",
  todaySave: "ثبت کن",
  todayDone: "این به حساب می‌آید. همیشه به حساب می‌آید.",
  aliveLine: "یک کم زنده‌تر.",
  sawDid: "امروز یک قدم کوچک. دیدم.",
  sawStayed: "امروز ماند. دیدم.",
  sawStuck: "امروز آمد و گفت. دیدم.",
  todayAlready: "امروز جوابت را داده‌ای.",
  bothCount: "هر دو یک‌اندازه به حساب می‌آیند.",

  stepOffer: "می‌خوای همین حالا یکی دیگه هم برداری؟ خیلی کوچیک.",
  stepYes: "باشه، بگو",
  stepNo: "نه، همین کافیه",
  stepDid: "انجامش دادم",
  stepEnough: "برای امروز بس است",
  stepMore: "یک کم بیشتر؟",
  stepClosed: "همین کافی است. امروز آمدی، و همین مهم بود.",
  stepThinking: "دارم یک چیز کوچک پیدا می‌کنم…",

  witnessAsk: "دوست داری کسی این تلاشت را ببیند؟",
  witnessYes: "بله، به کسی نشان بده",
  witnessNo: "امروز نه",
  witnessEdit: "قبل از فرستادن، هر کلمه‌اش را می‌توانی عوض کنی.",
  witnessSendNow: "همین حالا بفرست",
  witnessWait: "یک هفته صبر کن",
  witnessUntilColor: "صبر کن تا تصویر رنگی شود",
  witnessMessage: (deed: string) => `امروز ${deed} و از خودم راضی‌ام. خواستم تو هم بدانی.`,

  navWish: "آرزو",
  navNotebook: "دفتر",
  tellToday: "از امروز بگو",
  switchLang: "English",

  notebookTitle: "آنچه او نوشت",
  notebookEmpty: "هنوز چیزی نوشته نشده. اولین خط، اولین روزی می‌آید که جواب بدهی.",
  nthTime: (n: number) => `${ordinalFa(n)} بار برای آرزویش آمد. دیدم.`,
  share: "این را بفرست",
  shared: "فرستاده شد",

  language: "زبان",
  back: "بازگشت",
  crisisTitle: "لازم نیست این را تنها نگه داری",
};

const DICTS: Record<Lang, Dict> = { en: EN, fa: FA };

/** Counting in words, because the witness never writes digits. */
function countEn(n: number): string {
  const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  return words[n] ?? String(n);
}
function countFa(n: number): string {
  const words = ["صفر", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه", "ده"];
  return words[n] ?? n.toLocaleString("fa-IR");
}

/** "a, b, and c" — with the comma, the way it is said out loud. */
function listEn(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
function listFa(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} و ${items[1]}`;
  return `${items.slice(0, -1).join("، ")}، و ${items[items.length - 1]}`;
}

function ordinalEn(n: number): string {
  const words = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth",
    "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth", "nineteenth", "twentieth"];
  if (n < words.length) return words[n];
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
function ordinalFa(n: number): string {
  const words = ["", "اولین", "دومین", "سومین", "چهارمین", "پنجمین", "ششمین", "هفتمین", "هشتمین", "نهمین", "دهمین",
    "یازدهمین", "دوازدهمین", "سیزدهمین", "چهاردهمین", "پانزدهمین", "شانزدهمین", "هفدهمین", "هجدهمین", "نوزدهمین", "بیستمین"];
  if (n < words.length) return words[n];
  return `${n.toLocaleString("fa-IR")}مین`;
}

/** The deck, in each language. Keyed by the card id the server returns. */
export const CARD_TEXT: Record<Lang, Record<string, { name: string; line: string }>> = {
  en: {
    key: { name: "The Key", line: "It's near. What you need is already in your hand." },
    bridge: { name: "The Bridge", line: "Someone carries part of the way. Ask." },
    ladder: { name: "The Ladder", line: "Yes — slowly. One rung at a time." },
    lantern: { name: "The Lantern", line: "You can't see the end. You don't need to." },
    boat: { name: "The Boat", line: "It's moving. Row, and the current helps." },
    seed: { name: "The Seed", line: "Growing where you can't see it yet." },
    compass: { name: "The Compass", line: "The direction is right. The route will bend." },
    hammer: { name: "The Hammer", line: "The tool has come. Now build." },
    mountain: { name: "The Mountain", line: "Hard — and yours." },
    crown: { name: "The Crown", line: "You'll carry this one yourself. Stand tall." },
    door: { name: "The Door", line: "It opens from your side." },
    sun: { name: "The Sun", line: "Already begun. Warmer every day." },
  },
  fa: {
    key: { name: "کلید", line: "نزدیک است. چیزی که لازم داری همین حالا دستت است." },
    bridge: { name: "پل", line: "یک نفر بخشی از راه را می‌برد. بخواه." },
    ladder: { name: "نردبان", line: "بله — آرام. پله به پله." },
    lantern: { name: "فانوس", line: "آخر راه را نمی‌بینی. لازم هم نیست ببینی." },
    boat: { name: "قایق", line: "در حرکت است. پارو بزن، جریان کمکت می‌کند." },
    seed: { name: "بذر", line: "دارد رشد می‌کند، جایی که هنوز نمی‌بینی." },
    compass: { name: "قطب‌نما", line: "جهت درست است. مسیر خم می‌شود." },
    hammer: { name: "چکش", line: "ابزارش آمده. حالا بساز." },
    mountain: { name: "کوه", line: "سخت است — و مال توست." },
    crown: { name: "تاج", line: "این یکی را خودت می‌بری. سرت را بالا بگیر." },
    door: { name: "در", line: "از سمت تو باز می‌شود." },
    sun: { name: "خورشید", line: "شروع شده. هر روز گرم‌تر." },
  },
};

/** The badge glyph for a card — one small mark, the same in every language. */
export const CARD_GLYPH: Record<string, string> = {
  key: "⚷", bridge: "⌒", ladder: "⌗", lantern: "✦", boat: "⛵", seed: "❁",
  compass: "✧", hammer: "⚒", mountain: "⛰", crown: "♕", door: "⌸", sun: "☀",
};

export function dict(lang: Lang): Dict {
  return DICTS[lang] ?? EN;
}

export function cardText(lang: Lang, id: string): { name: string; line: string } {
  return CARD_TEXT[lang]?.[id] ?? CARD_TEXT.en[id] ?? { name: id, line: "" };
}

const LS_LANG = "dawnhalo:lang";

/** The language to start in: what they chose before, else what the phone is set to. */
export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LS_LANG);
    if (saved === "en" || saved === "fa") return saved;
  } catch {
    /* private mode */
  }
  const nav = typeof navigator !== "undefined" ? navigator.language ?? "" : "";
  return nav.toLowerCase().startsWith("fa") ? "fa" : "en";
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem(LS_LANG, lang);
  } catch {
    /* private mode */
  }
}
