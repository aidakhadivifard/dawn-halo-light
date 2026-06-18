// Lightweight, deterministic input classification used to steer AI prompting.
// Crisis is handled separately (crisis.ts) and ALWAYS takes precedence — this
// classifier is only consulted for non-crisis text.
//
// Output is one of: "question" (wants guidance + a next step), "feeling"
// (a feeling/situation to validate then gently reframe), or "general".

import { normalize } from "./crisis";
import type { Intent } from "../types";

const QUESTION_LEADS =
  /^(should|shall|will|would|could|can|do|does|did|is|are|am|was|were|have|has|what|how|when|where|why|who|which|whom)\b/;

const QUESTION_PHRASES =
  /\b(should i|shall i|will i|can i|could i|would i|do i|is it|are they|what (should|do|if)|how (do|can|should)|help me decide|what's the right|whats the right)\b/;

const FEELING_MARKERS =
  /\b(i feel|i'm feeling|im feeling|i am feeling|feeling|i'm so|im so|i am so|i feel like|i've been|ive been|i have been|i had|no one|nobody|no-one|everyone|i can't stop|i keep)\b/;

const FEELING_WORDS =
  /\b(tired|exhausted|drained|burnt? out|sad|down|low|empty|numb|angry|furious|frustrated|anxious|anxiety|scared|afraid|worried|stressed|overwhelmed|lonely|alone|unseen|invisible|unloved|unwanted|hopeless|lost|stuck|heartbroken|hurt|ugly|worthless|not enough|insecure|jealous|guilty|ashamed|fight|argument|broke up|breakup)\b/;

/**
 * Classify a non-crisis input. Question detection wins when the text is
 * phrased as a question; otherwise feeling markers/words; otherwise general.
 */
export function classifyInput(raw: string): Exclude<Intent, "crisis"> {
  const t = normalize(raw);
  if (!t) return "general";

  const looksLikeQuestion =
    /\?\s*$/.test(raw.trim()) || QUESTION_LEADS.test(t) || QUESTION_PHRASES.test(t);

  // A clear feeling statement that merely ends in a question mark
  // (e.g. "why do I feel so empty?") is still better served as a feeling.
  const looksLikeFeeling = FEELING_MARKERS.test(t) || FEELING_WORDS.test(t);

  if (looksLikeQuestion && !startsWithWhyFeeling(t)) {
    // Decision/guidance questions take the question path even if they mention
    // a feeling ("should I quit? I'm miserable").
    if (QUESTION_LEADS.test(t) || QUESTION_PHRASES.test(t) || !looksLikeFeeling) {
      return "question";
    }
  }

  if (looksLikeFeeling) return "feeling";
  if (looksLikeQuestion) return "question";
  return "general";
}

// "Why do I feel..." / "How come I'm so..." are emotional check-ins phrased as
// questions — route them to the feeling (validate-then-reframe) path.
function startsWithWhyFeeling(t: string): boolean {
  return /^(why|how come)\b/.test(t) && FEELING_WORDS.test(t);
}
