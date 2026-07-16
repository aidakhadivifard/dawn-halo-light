// The Copy Rule, enforced: every generated line must affirm the effort and
// never promise the outcome. This is the unit-testable lint applied to AI
// output BEFORE display; on violation the caller falls back to a safe static
// line. Patterns are kept tight to avoid mangling honest reflections.

export const COPY_RULE = `Every piece of text must affirm the effort, never promise the outcome. ALLOWED: "Day 47. You chose to stay, again." / "Most people quit by day 3. You didn't." FORBIDDEN: "You will succeed." / "The universe is rewarding you soon." / "Keep going and you'll get rich." / any prediction of results, health outcomes, weight numbers, or financial returns.`;

const FORBIDDEN: { pattern: RegExp; label: string }[] = [
  { pattern: /\byou will\b/i, label: "you will" },
  { pattern: /\byou'll\b/i, label: "you'll" },
  { pattern: /\bguarantee[ds]?\b/i, label: "guaranteed" },
  { pattern: /\bthe universe (will|is going to|rewards|is rewarding)\b/i, label: "the universe will" },
  { pattern: /\bpromise[sd]?\b/i, label: "promise" },
  { pattern: /\bdestined\b/i, label: "destined" },
  { pattern: /\bmanifest(s|ing|ed)?\b/i, label: "manifest" },
  { pattern: /\beverything will\b/i, label: "everything will" },
  { pattern: /\bit will (all )?work out\b/i, label: "it will work out" },
  { pattern: /\bbound to (succeed|win|happen)\b/i, label: "bound to" },
  { pattern: /\bwill (succeed|pay off|be rewarded|come true)\b/i, label: "will succeed" },
];

/** Every forbidden phrase found in the text (empty = compliant). */
export function copyRuleViolations(text: string): string[] {
  return FORBIDDEN.filter((f) => f.pattern.test(text)).map((f) => f.label);
}

/** The text if compliant, otherwise the safe static fallback. */
export function enforceCopyRule(
  text: string,
  fallback: string,
): { text: string; violated: boolean } {
  const violated = copyRuleViolations(text).length > 0;
  return { text: violated ? fallback : text, violated };
}
