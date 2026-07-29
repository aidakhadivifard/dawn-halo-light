// The oracle notices the goal inside the question. When a card-drawing user
// with no active goal brings a question or feeling that is really about
// WAITING for or ENDURING something, the reading may end with an invitation
// to give it a day count. Detection is deterministic (like classify.ts and
// crisis.ts) — never AI, never on crisis paths (crisis is checked first and
// returns before any card is drawn).

// A timing frame: the question is about how long something will take.
const TIMING = /\b(when will|how long|how soon|until|till|what year|which month|how much longer|still waiting|keep waiting)\b/i;

// An endurance verb/noun: the text names a thing being carried or worked
// toward. Deliberately narrow — longing questions ("does he think of me")
// must NOT trigger; endurance is about a road, not another person's heart.
const ENDURANCE =
  /\b(hold(ing)? on|get through|getting through|survive|surviving|endure|enduring|quit(ting)?|sober|giving up (smoking|drinking|sugar)|finish(ing)?|graduat\w*|visa|immigration|green card|citizenship|residency|exam|thesis|dissertation|degree|diet|marathon|training|recover\w*|heal(ing)?|rehab|chemo|treatment|surgery|pay(ing)? off|debt|save (up|enough)|saving (up|for)|mortgage|deposit|divorce|custody|court|lawsuit|probation|deployment|apart from|long distance|waiting for (the )?(results|news|answer|approval|decision)|job (offer|search)|unemploy\w*|interview results)\b/i;

const MAX_SEED_LEN = 80;

/**
 * Returns the user's own words (trimmed) when the text is endurance-shaped,
 * else null. The seed prefills the goal title so Day 1 is one tap away —
 * their words, not our copy.
 */
export function detectEnduranceSeed(text: string | undefined): string | null {
  const t = (text ?? "").trim();
  if (t.length < 8) return null;
  if (!TIMING.test(t) && !ENDURANCE.test(t)) return null;
  // Strip a leading question scaffold so the seed reads like a goal title.
  const seed = t
    .replace(/^(when will|how long (until|till|before)|will|can|do you think|i wonder if|i am|i'm)\s+/i, "")
    .replace(/\?+\s*$/, "")
    .trim();
  if (!seed) return null;
  return seed.length > MAX_SEED_LEN ? `${seed.slice(0, MAX_SEED_LEN).trimEnd()}…` : seed;
}
