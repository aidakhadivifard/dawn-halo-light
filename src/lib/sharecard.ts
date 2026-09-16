// The card that leaves the app.
//
// Everything that matters is ON the image, because some targets drop the
// text: the witness's line in his hand, what she did in hers, and a piece of
// her wish with whatever colour it has today. Rendered on the device to a
// real PNG and handed to the share sheet as a FILE — never a link.

import type { Lang } from "@/lib/i18n";
import { witnessHandSvg } from "@/components/WitnessHand";

export interface CardContent {
  /** The witness's line, e.g. "One small step today. I saw it." */
  line: string;
  /** What she wrote, in her own words — or null for "stayed". */
  deed: string | null;
  /** The witness counting: "The fifth time she came for it." */
  count: string | null;
  /** The wish picture with its current colour, if there is one. */
  pictureUrl: string | null;
  lang: Lang;
  dateLabel: string;
}

const W = 1080;
const H = 1350; // 4:5 — sits well in WhatsApp, Instagram and iMessage alike

const PAPER = "#FFF9F4";
const INK = "#3D2947";
const MUTED = "#756579";
const GOLD = "#D9A441";
const CORAL = "#F2766B";

function load(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Word-wrap, RTL-aware only in that the caller sets ctx.direction. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

export async function renderCard(c: CardContent): Promise<Blob> {
  const rtl = c.lang === "fa";
  const hand = rtl ? '400 60px "Vazirmatn", sans-serif' : 'italic 400 76px "Witness", cursive';
  const body = rtl ? '400 40px "Vazirmatn", sans-serif' : '400 44px "Cormorant Garamond", serif';
  const small = rtl ? '400 30px "Vazirmatn", sans-serif' : '400 32px "Cormorant Garamond", serif';

  // Make sure the faces are actually loaded before we paint with them.
  try {
    await Promise.all([hand, body, small].map((f) => (document as any).fonts?.load(f)));
  } catch {
    /* fall back to whatever the device has */
  }

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.textAlign = rtl ? "right" : "left";
  const x = rtl ? W - 96 : 96;
  const maxW = W - 192;

  // Wordmark
  ctx.fillStyle = INK;
  ctx.font = '400 36px "Cormorant Garamond", serif';
  ctx.direction = "ltr";
  ctx.textAlign = "left";
  ctx.fillText("Dawnhalo", 96, 120);
  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.textAlign = rtl ? "right" : "left";

  // The wish, with its colour so far — the top two-fifths of the card.
  let y = 190;
  const pic = c.pictureUrl ? await load(c.pictureUrl) : null;
  if (pic) {
    const boxW = maxW;
    const boxH = Math.round((boxW * 9) / 16);
    // Keep the drawing's own paper; just place it.
    ctx.drawImage(pic, 96, y, boxW, boxH);
    y += boxH + 96;
  } else {
    y += 40;
  }

  // The witness's line, in his hand.
  ctx.fillStyle = INK;
  ctx.font = hand;
  for (const line of wrap(ctx, c.line, maxW)) {
    ctx.fillText(line, x, y);
    y += rtl ? 96 : 84;
  }

  // What she did, in hers.
  if (c.deed) {
    y += 8;
    ctx.fillStyle = MUTED;
    ctx.font = body;
    for (const line of wrap(ctx, c.deed, maxW)) {
      ctx.fillText(line, x, y);
      y += rtl ? 64 : 56;
    }
  }

  // His hand, signing under the words.
  y += 8;
  const handW = 300, handH = 150;
  const handSvg = new Blob([witnessHandSvg(GOLD, rtl)], { type: "image/svg+xml" });
  const handUrl = URL.createObjectURL(handSvg);
  const handImg = await load(handUrl);
  URL.revokeObjectURL(handUrl);
  if (handImg) ctx.drawImage(handImg, rtl ? 96 : W - 96 - handW, y - 20, handW, handH);
  y += handH - 10;

  // His count, small.
  if (c.count) {
    y += 76;
    ctx.fillStyle = MUTED;
    ctx.font = small;
    ctx.fillText(c.count, x, y);
  }

  // The date, and a single coral dot: alive.
  ctx.fillStyle = MUTED;
  ctx.font = small;
  ctx.fillText(c.dateLabel, x, H - 110);
  ctx.fillStyle = CORAL;
  ctx.beginPath();
  ctx.arc(rtl ? 96 + 8 : W - 96 - 8, H - 120, 8, 0, Math.PI * 2);
  ctx.fill();

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no_blob"))), "image/png"),
  );
}

/**
 * Hand the card to the share sheet as a file. Returns how it went so the UI
 * can say "sent" or quietly fall back to a download.
 */
export async function shareCard(blob: Blob, text: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], "dawnhalo.png", { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  try {
    if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
      await nav.share({ files: [file], text });
      return "shared";
    }
  } catch (e: any) {
    if (e?.name === "AbortError") return "cancelled";
  }
  // No file sharing here (desktop browsers, older WebViews): save it instead.
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dawnhalo.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "downloaded";
}
