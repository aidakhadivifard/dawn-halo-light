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
  drawingWait: "It takes a minute. You can go on; it will be here.",

  // The card
  cardAsk: "Want to draw a card and see how possible it is?",
  cardDraw: "Draw my card",
  cardWarn: "Once the card is drawn, your words are sealed — they can't be changed after that.",
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
  drawingWait: "یک دقیقه طول می‌کشد. برو به کارت برس؛ همین‌جا می‌ماند.",

  cardAsk: "می‌خواهی یک کارت بکشی، ببینی چقدر شدنی است؟",
  cardDraw: "کارتم را بکش",
  cardWarn: "با کشیدن کارت، کلمه‌هایت ثبت می‌شوند — بعد از آن دیگر عوض نمی‌شوند.",
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

  language: "زبان",
  back: "بازگشت",
  crisisTitle: "لازم نیست این را تنها نگه داری",
};

const DICTS: Record<Lang, Dict> = { en: EN, fa: FA };

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
