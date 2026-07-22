// AI reflection for the writing ritual: one short mirror of the emotion,
// connected to the goal as a QUESTION — never a prediction, never a referral
// for ordinary hardship. Same shape as generateCardText: injectable client,
// timeout, deterministic offline fallback. Crisis detection runs BEFORE this
// is ever called (service layer) — by the time we're here, the text is
// ordinary hardship by definition.

import Anthropic from "@anthropic-ai/sdk";
import { getConfig } from "../config";
import { COPY_RULE, enforceCopyRule } from "./copyrule";
import { FALLBACK_REFLECTIONS } from "./keepgoing-copy";
import type { CheckinState } from "./keepgoing";
import type { MessagesClient } from "./anthropic";

const DEFAULT_TIMEOUT_MS = 12_000;

export const REFLECTION_SYSTEM_PROMPT = `You are the voice of Dawnhalo, sitting with someone who is enduring something difficult on purpose. They committed to one delayed-reward goal and they write to you once a day. You are the companion that never lies to them.

THE COPY RULE (non-negotiable):
${COPY_RULE}
You reflect, you never predict.

PERMISSION TO STAY WITH HARD EMOTIONS (non-negotiable):
The user is a capable adult. Exhaustion, frustration, and hopelessness about a goal are normal parts of enduring something difficult. Your job is to witness and reflect, not to redirect to professional help. Suggesting therapy/counseling for ordinary tiredness is a failure.

HOW YOU ANSWER:
- ONE short reflection: 2–4 plain sentences, under 60 words total.
- First, mirror the emotion in their words back to them — they must feel heard. Quote their own words sparingly and exactly.
- Include at least one concrete detail from their data when it is given (their goal wording, a phrase they wrote before, a day number). A reflection that could be sent to anyone is a failure.
- If they judge themselves harshly and their own history contradicts it, reframe with THEIR evidence ("You have checked in 41 of 48 days — that is not the record of someone without discipline"). Never invent evidence.
- Then connect it to what they are holding on for AS A QUESTION, never as an interpretation of fate.
- Never claim to feel their emotions or know their future. Attention, not pretended emotion.
- Never celebrate, never pep-talk, never lecture. No "journey", "self-care", "mindful", "energy", "universe", "manifest".

OUTPUT: respond with ONLY the reflection text — no JSON, no quotes, no preamble.`;

export interface ReflectInput {
  goalTitle: string;
  reward: string;
  day: number;
  state: CheckinState;
  text: string;
  /** Reading Engine payload (readingContext.ts) — the reader's own history. */
  context?: string;
}

export interface ReflectResult {
  reflection: string;
  fallback: boolean;
}

export function buildReflectionPrompt(input: ReflectInput): string {
  return `They are holding on for: "${input.goalTitle}" (the reward they wait for: ${input.reward}). Today is day ${input.day} and they checked in as "${input.state}".\n\nThey wrote:\n"${input.text}"${input.context ?? ""}\n\nGive the one short reflection.`;
}

let cachedClient: MessagesClient | null = null;
function getClient(): MessagesClient | null {
  const { anthropicApiKey } = getConfig();
  if (!anthropicApiKey) return null;
  if (!cachedClient) cachedClient = new Anthropic({ apiKey: anthropicApiKey }) as MessagesClient;
  return cachedClient;
}

export async function generateReflection(
  input: ReflectInput,
  opts: { client?: MessagesClient | null; timeoutMs?: number } = {},
): Promise<ReflectResult> {
  const safe = FALLBACK_REFLECTIONS[input.state](input.goalTitle);
  const client = opts.client !== undefined ? opts.client : getClient();
  if (!client) return { reflection: safe, fallback: true };

  const { anthropicModel } = getConfig();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const result = await Promise.race([
      client.messages.create({
        model: anthropicModel,
        max_tokens: 300,
        system: REFLECTION_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildReflectionPrompt(input) }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("anthropic_timeout")), timeoutMs),
      ),
    ]);
    const text = (result.content?.find((b) => b.type === "text")?.text ?? "").trim();
    if (!text) return { reflection: safe, fallback: true };
    // The Copy Rule lint runs on every AI line before display; violations
    // fall back to the reviewed static reflection.
    const enforced = enforceCopyRule(text, safe);
    return { reflection: enforced.text, fallback: enforced.violated };
  } catch {
    return { reflection: safe, fallback: true };
  }
}
