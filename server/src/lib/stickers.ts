// The sticker deck.
//
// When she sends her day to a witness, she picks a picture: a tiny ant
// hoisting a barbell, a woman balancing a golden key on one finger, a sloth
// with a mug of tea. The pictures are drawn once, against Aida's table of the
// 150 most common wishes, several variants per wish, in one locked style —
// and every one of them is looked at by a vision model and then by a person
// before it is ever shown to anyone.
//
// Three things are locked here and must not drift:
//   1. The STYLE: the app's own paper (near-white ivory), dark-plum ink, and
//      colour only where it matters — coral, gold, a touch of plum.
//   2. The POSE, spelled out limb by limb. "Correct anatomy" as an instruction
//      does not work; "right arm up on the branch, left arm holds the mug, two
//      legs dangle" does.
//   3. NO TEXT in the picture, ever. Words belong to her, on the card.

import wishesTable from "../data/wishes.fa.json";
import { getConfig } from "../config";
import type { MessagesClient } from "./anthropic";
import type { FetchLike } from "./sketch";

export interface WishGroup {
  id: string;
  title_fa: string;
  title_en: string;
  wishes: string[];
}

export const WISH_GROUPS: WishGroup[] = (wishesTable as { groups: WishGroup[] }).groups;

export function findGroup(id: string): WishGroup | undefined {
  return WISH_GROUPS.find((g) => g.id === id);
}

/** How many variants each wish gets. She picks; the rest are kept as spares. */
export const VARIANTS_PER_WISH = 3;

/** The cast. Varied on purpose — a deck of one character gets old in a week. */
export const CHARACTERS = [
  "a tiny grey ant with a clearly three-part body (round head, small middle with shoulders, oval abdomen), standing upright",
  "a chubby white cat with a coral bow",
  "a cute stylish young woman with wavy hair",
  "a mischievous little boy with messy hair and a gap-toothed grin",
  "a small round owl with tiny glasses",
  "a fluffy fox in a tiny coral scarf",
  "a soft round bear",
  "a sloth with a blissful half-asleep smile",
  "two small penguins",
  "a round little bird with a coral scarf",
  "a plump piggy-bank character with little legs",
  "a snail whose shell is a tiny cosy house",
  "a young woman with short hair and big earrings",
  "a fluffy squirrel",
  "a small elephant with rosy cheeks",
];

/** The locked style, appended to every drawing prompt. */
export const STYLE =
  " Adorable kawaii-leaning cartoon illustration, clean dark-plum ink outlines, mostly uncoloured " +
  "white-ivory drawing with only a FEW spots of colour: living coral pink (#f2766b), soft gold (#d9a441), " +
  "a touch of plum — like a colouring book where only the important parts got painted. Background is plain " +
  "very light warm ivory white (#fff9f4), almost white, NOT beige, NOT brown. Big sparkly eyes, rosy cheek " +
  "blush, two or three tiny gold sparkle stars. Centered single subject, square. Extremely cute, joyful, a " +
  "little funny. No text, no letters, no numbers, no words anywhere in the image.";

/**
 * The model writes the scenes. It gets the wish, a character, and the rules,
 * and answers with ONE scene: what the character is doing today for that
 * wish, with the pose spelled out limb by limb. It never draws the wish
 * itself ("wanting a child") — it draws today's small act for it ("tucking a
 * tiny knitted sock into a drawer").
 */
export const SCENE_SYSTEM =
  "You write one-sentence scene descriptions for a cute illustrated sticker. You answer with JSON only.";

export function scenePrompt(wish: string, groupTitle: string, character: string, lang: "fa" | "en"): string {
  return `A person's wish (group: ${groupTitle}):
"""
${wish}
"""

Write ONE sticker scene for the day she did a small thing towards this wish. The character is: ${character}.

Rules:
- Draw TODAY'S SMALL ACT, not the wish. Never illustrate the outcome (no wedding, no baby, no mansion).
  A concrete, gentle, slightly funny everyday action that fits the wish.
- No sadness, no illness imagery, no medical equipment, no tears. Warm and hopeful.
- Spell out the pose LIMB BY LIMB so a drawing model cannot get it wrong: what the right arm does,
  what the left arm does, what the legs do, where the head looks. The character has exactly two arms and two legs.
- One or two props at most, and say which prop is coral and which is gold.
- No text, letters, signs, labels or numbers anywhere in the scene.
- Also write a short first-person caption she could send to a loved one (max 14 words), in English and in Persian.
  Playful, warm, not needy. Example: "Day 3. I actually went for the walk. Be a little proud of me?"

Answer with JSON exactly like:
{"scene":"…","caption_en":"…","caption_fa":"…"}`;
}

export interface Scene {
  scene: string;
  caption_en: string;
  caption_fa: string;
}

export function parseScene(raw: string): Scene | null {
  const s = raw.indexOf("{");
  const e = raw.lastIndexOf("}");
  if (s < 0 || e <= s) return null;
  try {
    const j = JSON.parse(raw.slice(s, e + 1));
    const scene = String(j.scene ?? "").trim();
    if (scene.length < 20) return null;
    return {
      scene: scene.slice(0, 900),
      caption_en: String(j.caption_en ?? "").trim().slice(0, 140),
      caption_fa: String(j.caption_fa ?? "").trim().slice(0, 140),
    };
  } catch {
    return null;
  }
}

/** The vision check. Strict on the things that make a sticker unusable. */
export const REVIEW_PROMPT =
  `Look at this cute sticker illustration and check it strictly. Answer with JSON only:
{"ok":true|false,"problems":["…"]}
It is NOT ok if any of these is true:
- any text, letters, numbers or writing appear anywhere
- a limb attaches to the wrong place (e.g. arms coming out of the head), or there are extra or missing limbs, hands or fingers
- a face is malformed, or eyes are mismatched
- the background is not a plain light ivory/white (it is beige, brown, orange, dark, or has a scene)
- there is more than one main character when the scene asked for one (two characters are fine only if the scene asks for two)
- the picture is sad, medical, scary or sexual
Otherwise ok is true and problems is empty.`;

export interface Verdict {
  ok: boolean;
  problems: string[];
}

export function parseVerdict(raw: string): Verdict {
  const s = raw.indexOf("{");
  const e = raw.lastIndexOf("}");
  if (s < 0 || e <= s) return { ok: false, problems: ["unreadable review"] };
  try {
    const j = JSON.parse(raw.slice(s, e + 1));
    return { ok: j.ok === true, problems: Array.isArray(j.problems) ? j.problems.map(String).slice(0, 6) : [] };
  } catch {
    return { ok: false, problems: ["unreadable review"] };
  }
}

export interface StickerDeps {
  client?: MessagesClient | null;
  fetch?: FetchLike;
  geminiKey?: string | null;
  geminiModel?: string;
  timeoutMs?: number;
}

/** Ask the model for a scene. Null when it cannot answer — the sticker is then skipped, not invented. */
export async function writeScene(
  wish: string,
  groupTitle: string,
  character: string,
  deps: StickerDeps,
): Promise<Scene | null> {
  const client = deps.client;
  if (!client) return null;
  const { anthropicModel } = getConfig();
  try {
    const res = await Promise.race([
      client.messages.create({
        model: anthropicModel,
        max_tokens: 500,
        system: SCENE_SYSTEM,
        messages: [{ role: "user", content: scenePrompt(wish, groupTitle, character, "en") }],
      }),
      new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), deps.timeoutMs ?? 30_000)),
    ]);
    return parseScene(res.content?.find((b) => b.type === "text")?.text ?? "");
  } catch {
    return null;
  }
}

/** Draw the scene with Gemini. Throws on failure with the reason in the message. */
export async function drawScene(scene: string, deps: StickerDeps): Promise<{ mime: string; bytes: Buffer }> {
  const cfg = getConfig();
  const key = deps.geminiKey !== undefined ? deps.geminiKey : cfg.geminiApiKey;
  if (!key) throw new Error("gemini_not_configured");
  const fetchFn = deps.fetch ?? (globalThis.fetch as unknown as FetchLike);
  const model = deps.geminiModel ?? cfg.geminiImageModel;
  const base = (process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com").replace(/\/$/, "");
  const res = await Promise.race([
    fetchFn(`${base}/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: scene + STYLE }] }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    }),
    new Promise<never>((_, r) => setTimeout(() => r(new Error("gemini_timeout")), deps.timeoutMs ?? 60_000)),
  ]);
  if (!res.ok) throw new Error(`gemini_http_${res.status}`);
  const j: any = await res.json();
  for (const p of j?.candidates?.[0]?.content?.parts ?? []) {
    const d = p?.inlineData ?? p?.inline_data;
    if (d?.data) return { mime: d.mimeType ?? d.mime_type ?? "image/png", bytes: Buffer.from(d.data, "base64") };
  }
  throw new Error("gemini_no_image");
}

/** Show the drawing to the model and ask the strict questions. */
export async function reviewDrawing(img: { mime: string; bytes: Buffer }, deps: StickerDeps): Promise<Verdict> {
  const client = deps.client;
  if (!client) return { ok: false, problems: ["no reviewer"] };
  const { anthropicModel } = getConfig();
  try {
    const res = await Promise.race([
      client.messages.create({
        model: anthropicModel,
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: img.mime, data: img.bytes.toString("base64") } },
              { type: "text", text: REVIEW_PROMPT },
            ],
          },
        ],
      }),
      new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), deps.timeoutMs ?? 30_000)),
    ]);
    return parseVerdict(res.content?.find((b) => b.type === "text")?.text ?? "");
  } catch {
    return { ok: false, problems: ["review failed"] };
  }
}
