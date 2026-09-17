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
  whichFirst: "Which one should we make a card for first?",
  nothingLost: "Nothing is lost. We'll keep the others here for later.",
  waiting: "Waiting their turn",
  drawingWait: "It takes a minute. You can go on; it will be here.",

  // The wishes she keeps. Some are being lived, some are still waiting; the
  // road repeats for each of them.
  yourWishes: "Your wishes",
  noCardYet: "No card drawn yet",
  anotherWish: "Begin another wish",
  backToWishes: "All my wishes",
  daysCount: (n: number) => (n === 1 ? "one day" : `${countEn(n)} days`),
  answeredTodayShort: "answered today",

  // The card. The Oracle does not compute odds — it says what KIND of road
  // this is: slow, steep, unclear, one that asks for patience.
  wishTookShape: "Your wish has taken shape.",
  cardAsk: "Shall we see what the Oracle draws for it?",
  cardDraw: "Draw my card",
  notNow: "Not now",
  askOracle: "Ask the Oracle",
  // Not a warning. The same commitment, said in a way that does not frighten
  // someone who thinks they made a typo.
  cardWarn: "When you draw, this wish becomes the one this card will stay with.",
  cardWarnCalm: "You can always begin another wish later.",
  cardKeep: "Keep this card",
  cardBelongs: (name: string) => `${name} now belongs to your wish.`,
  beginToday: "Begin with today",

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
  // "I endured". The Oracle sees her first, asks permission, and only then
  // offers one step. Put on your running clothes. That's all. Don't exercise.
  stepOffer: "Want one tiny step before you go?",
  stepYes: "Give me one",
  stepNo: "I've done enough today",
  // Said while the step is being found, and left standing above it.
  stepIntro: "Let's make the next step almost too small to refuse.",
  // The fallback for the button when the step did not bring its own words.
  stepDone: "It's done",
  stepEnough: "That's enough for today",
  stepMore: "One more, even smaller?",
  stepClosed: "That's plenty. You showed up today.",
  stepThinking: "Finding something small…",
  // When the app does not know what a thing she named is, it asks — it does
  // not decide that "dawnhalo" is a file.
  stepAskLead: "One thing I'd rather not guess at.",
  stepAskPlaceholder: "In a few words",
  stepAskSend: "That's it",

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

  // The notebook — every line the witness has written, each one a card she can send.
  notebookTitle: "What he wrote",
  notebookEmpty: "Nothing written yet. The first line comes the first day you answer.",
  nthTime: (n: number) => `The ${ordinalEn(n)} time she came for it. I saw it.`,
  /** The first line in the book, written by him the day a wish took its shape. */
  sawShape: "She gave her wish a shape. I was here.",
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
  whichFirst: "اول برای کدام کارت بکشیم؟",
  nothingLost: "هیچ‌کدام از دست نمی‌رود. بقیه را همین‌جا نگه می‌داریم برای بعد.",
  waiting: "منتظر نوبتشان",
  drawingWait: "یک دقیقه طول می‌کشد. برو به کارت برس؛ همین‌جا می‌ماند.",

  yourWishes: "آرزوهای تو",
  noCardYet: "هنوز کارتی کشیده نشده",
  anotherWish: "یک آرزوی دیگر شروع کن",
  backToWishes: "همهٔ آرزوهایم",
  daysCount: (n: number) => (n === 1 ? "یک روز" : `${countFa(n)} روز`),
  answeredTodayShort: "امروز جواب داده",

  wishTookShape: "آرزویت شکل گرفت.",
  cardAsk: "ببینیم اوراکل برایش چه کارتی می‌کشد؟",
  cardDraw: "کارتم را بکش",
  notNow: "الان نه",
  askOracle: "از اوراکل بپرس",
  cardWarn: "وقتی بکشی، این کارت با همین آرزو می‌ماند.",
  cardWarnCalm: "هر وقت خواستی می‌توانی آرزوی دیگری را شروع کنی.",
  cardKeep: "این کارت را نگه می‌دارم",
  cardBelongs: (name: string) => `${name} حالا مال آرزوی توست.`,
  beginToday: "از امروز شروع کن",

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

  stepOffer: "قبل از رفتن، یک قدم خیلی کوچک می‌خواهی؟",
  stepYes: "یکی بده",
  stepNo: "برای امروز کافی است",
  stepIntro: "بگذار قدم بعدی آن‌قدر کوچک باشد که نشود به آن نه گفت.",
  stepDone: "انجام شد",
  stepEnough: "برای امروز همین کافی است",
  stepMore: "یکی دیگر، حتی کوچک‌تر؟",
  stepClosed: "همین کافی است. امروز آمدی، و همین مهم بود.",
  stepThinking: "دارم یک چیز کوچک پیدا می‌کنم…",
  stepAskLead: "یک چیز را نمی‌خواهم حدس بزنم.",
  stepAskPlaceholder: "در چند کلمه",
  stepAskSend: "همین",

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

  notebookTitle: "آنچه او نوشت",
  notebookEmpty: "هنوز چیزی نوشته نشده. اولین خط، اولین روزی می‌آید که جواب بدهی.",
  nthTime: (n: number) => `${ordinalFa(n)} بار برای آرزویش آمد. دیدم.`,
  sawShape: "به آرزویش شکل داد. من اینجا بودم.",
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
/**
 * The deck, in each language.
 *
 * `line` is what is printed ON the card. `appears` is the sentence under it —
 * what this card is FOR, written by a person and the same for everyone. The
 * paragraph after that is the only part written for the individual, and it
 * comes from the server.
 */
export const CARD_TEXT: Record<Lang, Record<string, { name: string; line: string; appears: string; carry: string }>> = {
  en: {
    key: { name: "The Key", line: "The way is short. What opens it is in your hand.",
      appears: "The Key appears when what you need is already with you, not still to be found.",
      carry: "It is nearer today than it looks." },
    bridge: { name: "The Bridge", line: "Someone carries part of the way. Ask.",
      appears: "The Bridge appears when the way across is crossed with someone, not alone.",
      carry: "Today you are allowed to ask." },
    ladder: { name: "The Ladder", line: "The way rises slowly. One rung at a time.",
      appears: "The Ladder appears when progress must be built, not found.",
      carry: "One rung is enough for today." },
    lantern: { name: "The Lantern", line: "You can't see the end. You don't need to.",
      appears: "The Lantern appears when the way is walked before it is seen.",
      carry: "Seeing the next step is enough." },
    boat: { name: "The Boat", line: "The water is moving. Row, and the current helps.",
      appears: "The Boat appears when the movement has already started and you are in it.",
      carry: "You are already moving today." },
    seed: { name: "The Seed", line: "Roots first, where no one can see.",
      appears: "The Seed appears when the work is done long before anything shows.",
      carry: "Today counts even if nothing shows." },
    compass: { name: "The Compass", line: "The direction holds. The route will bend.",
      appears: "The Compass appears when the direction is settled and the route is not.",
      carry: "A bend today is not a wrong turn." },
    hammer: { name: "The Hammer", line: "The tool has come. Now build.",
      appears: "The Hammer appears when what is left is making, not finding.",
      carry: "Today, one small part of it." },
    mountain: { name: "The Mountain", line: "The way is steep. It is yours to climb.",
      appears: "The Mountain appears when the way is heavy and still worth the weight.",
      carry: "Heavy today is still forward." },
    crown: { name: "The Crown", line: "You'll carry this one yourself. Stand tall.",
      appears: "The Crown appears when the thing must be carried, not given.",
      carry: "Today, carry it as yours." },
    door: { name: "The Door", line: "It opens from your side.",
      appears: "The Door appears when what you want is waiting, not missing.",
      carry: "It is still waiting today." },
    sun: { name: "The Sun", line: "It has already begun. Stand where the light falls.",
      appears: "The Sun appears when it began before you noticed it had.",
      carry: "Today is not the beginning. It already began." },
    stone: { name: "The Stone", line: "Put one thing down. The road opens after.",
      appears: "The Stone appears when the way opens by setting something down, not by carrying more.",
      carry: "Today, set one thing down." },
  },
  fa: {
    key: { name: "کلید", line: "راه کوتاه است. آنچه بازش می‌کند در دست توست.",
      appears: "کلید وقتی می‌آید که آنچه لازم داری همراهت است، نه هنوز پیدا نشده.",
      carry: "امروز نزدیک‌تر از آن است که به نظر می‌رسد." },
    bridge: { name: "پل", line: "یک نفر بخشی از راه را می‌برد. بخواه.",
      appears: "پل وقتی می‌آید که این راه با کسی رد می‌شود، نه تنها.",
      carry: "امروز اجازه داری بخواهی." },
    ladder: { name: "نردبان", line: "راه آرام بالا می‌رود. پله به پله.",
      appears: "نردبان وقتی می‌آید که پیشرفت ساخته می‌شود، نه پیدا.",
      carry: "یک پله برای امروز کافی است." },
    lantern: { name: "فانوس", line: "آخر راه را نمی‌بینی. لازم هم نیست ببینی.",
      appears: "فانوس وقتی می‌آید که راه پیش از دیده‌شدن، رفته می‌شود.",
      carry: "دیدنِ قدم بعدی کافی است." },
    boat: { name: "قایق", line: "آب در حرکت است. پارو بزن، جریان کمکت می‌کند.",
      appears: "قایق وقتی می‌آید که حرکت از قبل شروع شده و تو درونش هستی.",
      carry: "امروز هم در حرکتی." },
    seed: { name: "بذر", line: "اول ریشه، جایی که هیچ‌کس نمی‌بیند.",
      appears: "بذر وقتی می‌آید که کار خیلی پیش‌تر از دیده‌شدنش انجام می‌شود.",
      carry: "امروز به حساب می‌آید، حتی اگر چیزی پیدا نباشد." },
    compass: { name: "قطب‌نما", line: "جهت سر جایش است. مسیر خم می‌شود.",
      appears: "قطب‌نما وقتی می‌آید که جهت معلوم است و مسیر نه.",
      carry: "خم‌شدنِ مسیر، اشتباه‌رفتن نیست." },
    hammer: { name: "چکش", line: "ابزارش آمده. حالا بساز.",
      appears: "چکش وقتی می‌آید که آنچه مانده ساختن است، نه پیداکردن.",
      carry: "امروز، یک تکهٔ کوچکش." },
    mountain: { name: "کوه", line: "راه سربالاست. و بالا رفتنش مال توست.",
      appears: "کوه وقتی می‌آید که راه سنگین است و باز هم ارزش این وزن را دارد.",
      carry: "سنگینیِ امروز هم جلو رفتن است." },
    crown: { name: "تاج", line: "این یکی را خودت می‌بری. سرت را بالا بگیر.",
      appears: "تاج وقتی می‌آید که این بار باید برداشته شود، نه گرفته.",
      carry: "امروز آن را مال خودت بردار." },
    door: { name: "در", line: "از سمت تو باز می‌شود.",
      appears: "در وقتی می‌آید که آنچه می‌خواهی منتظر است، نه گم‌شده.",
      carry: "امروز هم منتظر است." },
    sun: { name: "خورشید", line: "شروع شده است. جایی بایست که نور می‌افتد.",
      appears: "خورشید وقتی می‌آید که پیش از آنکه بفهمی، شروع شده بود.",
      carry: "امروز شروع نیست. از قبل شروع شده بود." },
    stone: { name: "سنگ", line: "یک چیز را زمین بگذار. راه بعدش باز می‌شود.",
      appears: "سنگ وقتی می‌آید که راه با زمین‌گذاشتن باز می‌شود، نه با بیشتر برداشتن.",
      carry: "امروز یک چیز را زمین بگذار." },
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

export function cardText(
  lang: Lang,
  id: string,
): { name: string; line: string; appears: string; carry: string } {
  return CARD_TEXT[lang]?.[id] ?? CARD_TEXT.en[id] ?? { name: id, line: "", appears: "", carry: "" };
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
  // Nothing chosen yet: take the phone's own language, and English when the
  // phone does not say — an app that opens in a language you cannot read is
  // worse than one that opens in the language everyone half-knows.
  const nav =
    typeof navigator !== "undefined"
      ? [...(navigator.languages ?? []), navigator.language ?? ""]
      : [];
  for (const raw of nav) {
    const code = (raw ?? "").toLowerCase();
    const match = LANGS.find((l) => code === l.code || code.startsWith(`${l.code}-`));
    if (match) return match.code;
  }
  return "en";
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem(LS_LANG, lang);
  } catch {
    /* private mode */
  }
}
