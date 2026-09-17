// The horizon sketch — the person's own words, drawn once.
//
// Two images per horizon, ever: a thin ink line drawing (what they see on
// Day 1) and the same drawing with a soft watercolor wash (revealed slowly by
// the staying). Both come from Gemini's image model. The words are passed
// VERBATIM — we add only style, never content: nothing invented, nothing
// made cute. Without an API key the app simply has no sketch.

import { getConfig } from "../config";

export interface SketchImage {
  mime: string;
  bytes: Buffer;
}

export type FetchLike = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<any>;
  text(): Promise<string>;
}>;

export interface SketchDeps {
  fetch?: FetchLike;
  apiKey?: string | null;
  model?: string;
  timeoutMs?: number;
  /** Override for local testing against a mock (GEMINI_BASE_URL). */
  baseUrl?: string;
}

/** Style only. The horizon text is quoted exactly as written. */
export function linePrompt(horizon: string): string {
  return (
    `Draw me: ${horizon}\n\n` +
    `Style only — do not add or change any element, and never make it childlike: an inline sketch, ` +
    `a single very thin deep-plum ink line (#3D2947) on luminous warm ivory paper (#FFF9F4, almost white — never yellow, never cream), in the manner of a fashion-illustration croquis. ` +
    `No gray shading, no cross-hatching, no textures, no text or logos except a brand I named myself. ` +
    `The person who wrote this — a woman — is the largest figure, slightly off-center; everyone else she ` +
    `names stands beside her, smaller; places she names frame the scene with a few long lines; objects ` +
    `she names are small, in her hand or at her side. Generous white space. Landscape, 16:9.`
  );
}

export function colorPrompt(): string {
  return (
    `Add a restrained, translucent watercolor wash to this line drawing. Keep every ink line exactly as it is; ` +
    `add nothing, remove nothing, move nothing. Use ONE colour only: living coral, from pale #F7A097 to #F2766B. ` +
    `No other hues — no yellow, no ochre, no blue, no green, no purple. The paper stays luminous ivory and most of ` +
    `it stays untouched; the coral belongs on the person's clothing first, then on one or two small things in the scene.`
  );
}

function pickImage(json: any): SketchImage | null {
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    const d = p?.inlineData ?? p?.inline_data;
    if (d?.data) return { mime: d.mimeType ?? d.mime_type ?? "image/png", bytes: Buffer.from(d.data, "base64") };
  }
  return null;
}

async function generate(
  parts: any[],
  deps: Required<Pick<SketchDeps, "fetch" | "model" | "timeoutMs" | "baseUrl">> & { apiKey: string },
): Promise<SketchImage> {
  const url = `${deps.baseUrl}/v1beta/models/${deps.model}:generateContent`;
  const body = JSON.stringify({
    contents: [{ role: "user", parts }],
    generationConfig: { responseModalities: ["IMAGE"] },
  });
  const res = await Promise.race([
    deps.fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": deps.apiKey }, body }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("gemini_timeout")), deps.timeoutMs)),
  ]);
  if (!res.ok) {
    // Google says WHY in the body — quota, a model that does not exist, a key
    // without image access. A bare status code sends everyone guessing.
    let why = "";
    try {
      const j: any = await res.json();
      why = String(j?.error?.message ?? j?.error?.status ?? "").slice(0, 160);
    } catch {
      /* no body */
    }
    throw new Error(`gemini_http_${res.status}${why ? `: ${why}` : ""}`);
  }
  const img = pickImage(await res.json());
  if (!img) throw new Error("gemini_no_image");
  return img;
}

/**
 * Draw the horizon: line first, then the watercolor as an edit of that exact
 * line drawing. Throws on any failure; the caller records the status.
 */
export async function drawHorizon(
  horizon: string,
  deps: SketchDeps = {},
): Promise<{ line: SketchImage; color: SketchImage }> {
  const cfg = getConfig();
  const apiKey = deps.apiKey !== undefined ? deps.apiKey : cfg.geminiApiKey;
  if (!apiKey) throw new Error("gemini_not_configured");
  const d = {
    fetch: deps.fetch ?? (globalThis.fetch as unknown as FetchLike),
    model: deps.model ?? cfg.geminiImageModel,
    timeoutMs: deps.timeoutMs ?? 90_000,
    baseUrl: (deps.baseUrl ?? process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com").replace(/\/$/, ""),
    apiKey,
  };
  const line = await generate([{ text: linePrompt(horizon) }], d);
  const color = await generate(
    [{ inlineData: { mimeType: line.mime, data: line.bytes.toString("base64") } }, { text: colorPrompt() }],
    d,
  );
  return { line, color };
}

/** True when the server can draw at all. */
export function sketchAvailable(deps: SketchDeps = {}): boolean {
  const apiKey = deps.apiKey !== undefined ? deps.apiKey : getConfig().geminiApiKey;
  return !!apiKey;
}
