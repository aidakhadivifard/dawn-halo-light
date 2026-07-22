// Renders a drawn card to a shareable 1080×1920 (story-sized) PNG entirely
// on-device with <canvas> — no server, no dependency. Used by the Share panel
// so a card can travel to Instagram Stories / WhatsApp / camera roll with
// Dawnhalo branding attached.

import type { Card } from "@/lib/cards";

const W = 1080;
const H = 1920;

const INK = "#2d2a2e";
const SKY = "#fdfcfb";
const ROSE = "#bd5c78";

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Word-wrap `text` to `maxWidth`, returning at most `maxLines` lines (ellipsized on overflow). */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  let overflow = false;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === maxLines) {
      overflow = true;
      line = "";
      break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (overflow && lines.length) {
    let last = lines[lines.length - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.replace(/\s*\S+$/, "");
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

async function loadIllustration(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  await img.decode();
  return img;
}

async function renderCardImage(card: Card): Promise<Blob> {
  // Best-effort: make sure the brand fonts are ready before measuring text.
  try {
    await Promise.all([
      document.fonts.load('italic 300 68px "Fraunces"'),
      document.fonts.load('400 34px "Inter"'),
    ]);
  } catch {
    /* system fallbacks are fine */
  }

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");

  // Dawn-sky background with the app's warm halo glow.
  ctx.fillStyle = SKY;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 480, 80, W / 2, 480, 900);
  glow.addColorStop(0, "rgba(245,207,138,0.45)");
  glow.addColorStop(0.5, "rgba(244,163,122,0.18)");
  glow.addColorStop(1, "rgba(189,92,120,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Card illustration (4:5), rounded, softly shadowed.
  const imgW = 800;
  const imgH = 1000;
  const imgX = (W - imgW) / 2;
  const imgY = 170;
  const img = await loadIllustration(card.illustration);
  ctx.save();
  ctx.shadowColor = "rgba(45,42,46,0.28)";
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 24;
  roundedRectPath(ctx, imgX, imgY, imgW, imgH, 28);
  ctx.fillStyle = "#1a1518";
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundedRectPath(ctx, imgX, imgY, imgW, imgH, 28);
  ctx.clip();
  // Cover-fit the illustration into the 4:5 frame.
  const scale = Math.max(imgW / img.naturalWidth, imgH / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, imgX + (imgW - dw) / 2, imgY + (imgH - dh) / 2, dw, dh);
  ctx.restore();

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Title.
  ctx.fillStyle = INK;
  ctx.font = 'italic 300 68px "Fraunces", Georgia, serif';
  const titleLines = wrapText(ctx, card.title, W - 200, 2);
  let y = imgY + imgH + 130;
  for (const line of titleLines) {
    ctx.fillText(line, W / 2, y);
    y += 78;
  }

  // Message (clamped so the composition always fits).
  y += 16;
  ctx.font = '400 34px "Inter", -apple-system, sans-serif';
  ctx.fillStyle = "rgba(45,42,46,0.78)";
  const paragraphs = card.message.split(/\n{2,}/);
  const maxLines = 8;
  let used = 0;
  for (const para of paragraphs) {
    if (used >= maxLines) break;
    const lines = wrapText(ctx, para, W - 260, maxLines - used);
    for (const line of lines) {
      ctx.fillText(line, W / 2, y);
      y += 52;
      used++;
    }
    y += 18; // paragraph gap
  }

  // Wordmark.
  ctx.fillStyle = ROSE;
  ctx.font = '700 30px "Inter", -apple-system, sans-serif';
  const brand = "D A W N H A L O";
  ctx.fillText(brand, W / 2, H - 120);
  ctx.fillStyle = "rgba(45,42,46,0.45)";
  ctx.font = 'italic 300 30px "Fraunces", Georgia, serif';
  ctx.fillText("a little light for your next step", W / 2, H - 70);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("image_encode_failed"))), "image/png");
  });
}

/**
 * The journey share format (spec §8): the DAY NUMBER is the hero — people
 * share their chapters, not card art. Card smaller, one short line from the
 * reading, small wordmark. Goal title stays off unless the user opts in.
 */
async function renderJourneyImage(args: {
  day: number;
  card?: Card | null;
  line: string;
  goalTitle?: string;
}): Promise<Blob> {
  try {
    await Promise.all([
      document.fonts.load('italic 300 260px "Fraunces"'),
      document.fonts.load('400 34px "Inter"'),
    ]);
  } catch {
    /* system fallbacks are fine */
  }

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");

  ctx.fillStyle = SKY;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 430, 60, W / 2, 430, 860);
  glow.addColorStop(0, "rgba(245,207,138,0.5)");
  glow.addColorStop(0.5, "rgba(244,163,122,0.2)");
  glow.addColorStop(1, "rgba(189,92,120,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // The hero: the day number, calm and typographic, like a clock.
  ctx.fillStyle = "rgba(45,42,46,0.55)";
  ctx.font = '500 40px "Inter", -apple-system, sans-serif';
  ctx.fillText("D A Y", W / 2, 300);
  ctx.fillStyle = INK;
  ctx.font = 'italic 300 300px "Fraunces", Georgia, serif';
  ctx.fillText(String(args.day), W / 2, 590);

  if (args.goalTitle) {
    ctx.fillStyle = "rgba(45,42,46,0.6)";
    ctx.font = 'italic 300 40px "Fraunces", Georgia, serif';
    const gl = wrapText(ctx, args.goalTitle, W - 240, 1);
    ctx.fillText(gl[0] ?? "", W / 2, 670);
  }

  // The card, a guest below the number.
  let y = 780;
  if (args.card) {
    const imgW = 520;
    const imgH = 650;
    const imgX = (W - imgW) / 2;
    try {
      const img = await loadIllustration(args.card.illustration);
      ctx.save();
      ctx.shadowColor = "rgba(45,42,46,0.25)";
      ctx.shadowBlur = 50;
      ctx.shadowOffsetY = 20;
      roundedRectPath(ctx, imgX, y, imgW, imgH, 24);
      ctx.fillStyle = "#1a1518";
      ctx.fill();
      ctx.restore();
      ctx.save();
      roundedRectPath(ctx, imgX, y, imgW, imgH, 24);
      ctx.clip();
      const scale = Math.max(imgW / img.naturalWidth, imgH / img.naturalHeight);
      ctx.drawImage(
        img,
        imgX + (imgW - img.naturalWidth * scale) / 2,
        y + (imgH - img.naturalHeight * scale) / 2,
        img.naturalWidth * scale,
        img.naturalHeight * scale,
      );
      ctx.restore();
      y += imgH + 120;
    } catch {
      /* no illustration — the day number carries the image */
      y += 60;
    }
  } else {
    y += 60;
  }

  // One short line from the reading.
  ctx.fillStyle = "rgba(45,42,46,0.8)";
  ctx.font = 'italic 300 46px "Fraunces", Georgia, serif';
  const lines = wrapText(ctx, `“${args.line}”`, W - 240, 3);
  for (const line of lines) {
    ctx.fillText(line, W / 2, y);
    y += 62;
  }

  ctx.fillStyle = ROSE;
  ctx.font = '700 30px "Inter", -apple-system, sans-serif';
  ctx.fillText("D A W N H A L O", W / 2, H - 100);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("image_encode_failed"))), "image/png");
  });
}

export type ShareImageOutcome = "shared" | "downloaded";

/**
 * Render the card and hand it to the native share sheet when available
 * (mobile → Instagram/WhatsApp/etc.), otherwise download the PNG.
 */
export async function shareCardAsImage(card: Card): Promise<ShareImageOutcome> {
  return shareBlob(await renderCardImage(card));
}

/**
 * Share a journey moment: Day number as the hero, the card as the guest,
 * one line from the reading. Goal title off by default (privacy).
 */
export async function shareJourneyImage(args: {
  day: number;
  card?: Card | null;
  line: string;
  goalTitle?: string;
}): Promise<ShareImageOutcome> {
  return shareBlob(await renderJourneyImage(args));
}

async function shareBlob(blob: Blob): Promise<ShareImageOutcome> {
  const file = new File([blob], "dawnhalo-card.png", { type: "image/png" });

  const nav = navigator as Navigator & {
    canShare?: (d: ShareData) => boolean;
    share?: (d: ShareData) => Promise<void>;
  };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: "Dawnhalo" });
      return "shared";
    } catch {
      /* user cancelled or share failed — fall back to download */
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dawnhalo-card.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded";
}
