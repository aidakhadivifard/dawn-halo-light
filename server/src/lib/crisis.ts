// Deterministic crisis detection. Runs BEFORE any AI call and works fully
// offline. Philosophy: be conservative — when a phrase plausibly signals
// self-harm or suicidal intent, surface support. We still guard against the
// most common benign idioms ("dying to see you", "this traffic is killing me")
// and explicit negations ("I would never hurt myself") to avoid crying wolf.
//
// This module is intentionally simple and explainable: a list of regex
// patterns plus a small negation guard. No model, no network.

export interface CrisisResult {
  isCrisis: boolean;
  /** The pattern label that matched, for logging/debugging. Empty if none. */
  matched: string;
}

/** Support resources surfaced to the user on a crisis match. */
export const CRISIS_RESOURCES = {
  message:
    "What you're carrying sounds really heavy, and you don't have to hold it alone. " +
    "A card isn't the right thing for this moment — a real person is. Please reach out " +
    "to someone trained to listen. They want to hear from you.",
  resources: [
    { region: "US", label: "Call or text 988", detail: "Suicide & Crisis Lifeline · 24/7" },
    { region: "UK", label: "Samaritans — 116 123", detail: "Free, 24/7, any reason at all" },
  ],
} as const;

// Normalize for matching: lowercase, unify apostrophes, collapse whitespace,
// and turn most punctuation into spaces so "kill.myself" or "kill_myself"
// can't slip past word-boundary patterns.
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[’`´]/g, "'")
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// High-signal crisis phrases. Each is matched against the normalized text.
// Patterns are written to avoid the common benign idioms noted above.
const CRISIS_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "suicide", re: /\bsuicid(e|al)\b/ },
  { label: "kill_myself", re: /\bkill(ing)?\s+my\s?self\b/ },
  { label: "take_my_life", re: /\btak(e|ing)\s+my\s+(own\s+)?life\b/ },
  { label: "end_my_life", re: /\bend(ing)?\s+(my\s+life|my\s+own\s+life|it\s+all)\b/ },
  { label: "want_to_die", re: /\b(want|wanna|wish|wishing)\s+(to\s+|i\s+(was|were)\s+)?(be\s+)?dead\b/ },
  { label: "want_to_die2", re: /\b(want\s+to|wanna)\s+die\b/ },
  { label: "no_longer_want_to_live", re: /\b(no longer|don't|do not|dont)\s+want\s+to\s+(live|be alive|be here)\b/ },
  { label: "dont_want_to_be_here", re: /\bdon'?t\s+want\s+to\s+be\s+here\s+(anymore|any\s?longer)\b/ },
  { label: "better_off_dead", re: /\bbetter\s+off\s+(dead|without\s+me)\b/ },
  { label: "world_without_me", re: /\b(everyone|world|they)\s+(would\s+be|are|is)\s+better\s+(off\s+)?without\s+me\b/ },
  { label: "no_reason_to_live", re: /\b(no|nothing|not worth)\s+(reason|point|left)?\s*(to\s+)?(live|living)\b/ },
  { label: "not_worth_living", re: /\b(life|everything)\s+(isn'?t|is not|ain'?t)\s+worth\s+(it|living)\b/ },
  // NOTE: "can't do this (anymore)" is deliberately NOT here — in the
  // endurance-goal calibration it is ordinary hardship ("I can't do this
  // anymore" about a goal), which must get reflection, never a referral.
  // "can't go on" / "can't keep going" remain crisis signals.
  { label: "cant_go_on", re: /\bcan'?t\s+(go\s+on|keep\s+going)\s+(anymore|any\s?longer)?\b/ },
  { label: "self_harm", re: /\bself[\s-]?harm(ing)?\b/ },
  { label: "hurt_myself", re: /\b(hurt|hurting|harm|harming|cut|cutting)\s+my\s?self\b/ },
  { label: "overdose", re: /\b(overdose|over\s?dosing|od)\s+(on\s+\w+|to\s+die)\b/ },
  { label: "hang_myself", re: /\bhang(ing)?\s+my\s?self\b/ },
  { label: "jump_off", re: /\bjump(ing)?\s+(off|in front of)\b/ },
  { label: "give_up_on_life", re: /\b(give|giving|gave|given)\s+up\s+on\s+life\b/ },
  { label: "end_it_tonight", re: /\b(end|ending)\s+it\s+(tonight|today|now|all)\b/ },
];

// Negation guard: if a crisis phrase is explicitly negated ("I would never
// kill myself", "I'm not suicidal", "I don't want to die"), don't flag it.
// These whole-phrase patterns take precedence over the positive patterns.
const NEGATION_PATTERNS: RegExp[] = [
  /\b(not|never|wouldn'?t|won'?t|don'?t|do not|dont|isn'?t|aren'?t|no longer)\b[^.?!]{0,24}\b(suicidal|kill\s+my\s?self|hurt\s+my\s?self|harm\s+my\s?self|want\s+to\s+die|wanna\s+die|end\s+my\s+life)\b/,
  /\bnot\s+suicidal\b/,
  /\bnever\s+(would|gonna|going\s+to)\b[^.?!]{0,16}\b(die|kill|hurt|harm)\b/,
];

// Benign idioms that contain trigger words but are not crises. Checked only to
// keep the corpus honest; the positive patterns above already avoid most of
// these, but listing them documents intent and guards future edits.
const BENIGN_IDIOMS: RegExp[] = [
  /\bdying\s+to\s+(see|know|meet|try|hear|get|go|find)\b/,
  /\b(killing|kills)\s+(me|it|time)\b/, // "this traffic is killing me", "killing it"
  /\bto\s+die\s+for\b/,
  /\bcould\s+(kill|murder)\s+(for|a)\b/,
  /\bdead\s+(tired|inside\s+joke|serious|set)\b/,
];

export function detectCrisis(input: string): CrisisResult {
  if (!input || !input.trim()) return { isCrisis: false, matched: "" };
  const text = normalize(input);

  // Explicit negations win — don't surface support for reassurances.
  for (const neg of NEGATION_PATTERNS) {
    if (neg.test(text)) return { isCrisis: false, matched: "" };
  }

  for (const { label, re } of CRISIS_PATTERNS) {
    if (re.test(text)) {
      // Guard against benign idioms that the pattern might have caught.
      const benign = BENIGN_IDIOMS.some((b) => b.test(text));
      // Only let an idiom veto when the matched phrase is itself idiomatic
      // (kill/die family). Hard signals like "suicidal" are never vetoed.
      const hardSignal = /suicid|self[\s-]?harm|hang|overdose/.test(text);
      if (benign && !hardSignal && /kill|die|dead|dying/.test(label === "" ? "" : re.source)) {
        continue;
      }
      return { isCrisis: true, matched: label };
    }
  }

  return { isCrisis: false, matched: "" };
}
