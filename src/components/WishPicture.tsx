// The wish, drawn.
//
// The picture starts colorless — a thin ink line, exactly the person's own
// words. Every answered day lets a little more color through, far things
// first, the person last. The badge of their card sits in the corner from the
// moment it is drawn, and lands there with a small animation the first time.
//
// White and blue everywhere else in the app; this is the one place that has
// its own colors, because the colors are the reward.

import { useEffect, useRef, useState } from "react";
import type { Sketch } from "@/lib/vow";
import { cardText, type Lang } from "@/lib/i18n";
import { CardSymbol } from "@/components/CardSymbol";

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Color due, 0..1 — eased so the first day shows clearly and the last closes gently. */
export function fractionOf(lit: number, fullAt: number): number {
  const f = Math.max(0, Math.min(1, lit / Math.max(1, fullAt)));
  return 1 - Math.pow(1 - f, 2);
}

export interface WishPictureProps {
  sketch: Sketch;
  words: string | null;
  lang: Lang;
  /** The drawn card, or null before the draw. */
  card: { id: string } | null;
  /** True the first time the badge appears — it flies in and settles. */
  badgeLanding?: boolean;
}

export function WishPicture({ sketch, words, lang, card, badgeLanding }: WishPictureProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgs = useRef<{ line: HTMLImageElement; color: HTMLImageElement } | null>(null);
  const shown = useRef(0);
  const [ready, setReady] = useState(false);
  const target = fractionOf(sketch.lit, sketch.fullAt);

  useEffect(() => {
    let alive = true;
    imgs.current = null;
    setReady(false);
    if (!sketch.lineUrl || !sketch.colorUrl) return;
    Promise.all([load(sketch.lineUrl), load(sketch.colorUrl)])
      .then(([line, color]) => {
        if (!alive) return;
        imgs.current = { line, color };
        const c = canvasRef.current;
        if (c) {
          c.width = line.naturalWidth;
          c.height = line.naturalHeight;
        }
        shown.current = target;
        paint(target);
        setReady(true);
      })
      .catch(() => setReady(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sketch.lineUrl, sketch.colorUrl]);

  useEffect(() => {
    if (!imgs.current) return;
    const from = shown.current;
    if (Math.abs(target - from) < 0.001) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / 1400);
      const e = 1 - Math.pow(1 - t, 3);
      shown.current = from + (target - from) * e;
      paint(shown.current);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, ready]);

  function paint(fraction: number) {
    const c = canvasRef.current;
    const pair = imgs.current;
    if (!c || !pair) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const W = c.width;
    const H = c.height;

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(pair.color, 0, 0, W, H);
    if (fraction < 1) {
      const cx = W / 2;
      const cy = H * 0.55;
      const rMax = Math.hypot(cx, Math.max(cy, H - cy)) * 1.02;
      const r = rMax * (1 - fraction);
      const g = ctx.createRadialGradient(cx, cy, Math.max(0, r * 0.62), cx, cy, Math.max(1, r));
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalCompositeOperation = "destination-over";
    ctx.drawImage(pair.line, 0, 0, W, H);
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(pair.line, 0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
  }

  const pending = sketch.status === "pending" || (sketch.status === "ready" && !ready);
  const t = cardText(lang, card?.id ?? "");

  return (
    // No box, no border, no shadow: the drawing sits on the page like ink on
    // paper. The charm hangs beside it, off the drawing's edge, like a pendant.
    <div className="relative">
      {sketch.status === "ready" && (
        <canvas ref={canvasRef} className="block w-full h-auto" role="img" aria-label={words ?? "Your wish"} />
      )}

      {pending && (
        <div className="aspect-[16/9] flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div
            aria-hidden
            className="w-16 h-16 rounded-full blur-2xl animate-pulse"
            style={{ background: "radial-gradient(circle, rgba(217,164,65,0.35) 0%, transparent 70%)" }}
          />
          <p className="font-serif text-[19px] text-wish-ink/70 text-balance">{words}</p>
        </div>
      )}

      {(sketch.status === "failed" || sketch.status === "none") && words && (
        <div className="aspect-[16/9] flex items-center justify-center px-6 text-center">
          <p className="font-serif text-[26px] leading-snug text-wish-ink text-balance">{words}</p>
        </div>
      )}

      {card && (
        <div
          title={t.name}
          aria-label={t.name}
          className={
            "absolute top-[56%] -translate-y-1/2 grid place-items-center size-12 rounded-full bg-wish-paper " +
            "border-[1.5px] border-wish-gold text-wish-gold " +
            (badgeLanding ? "animate-[badgeland_900ms_cubic-bezier(.2,.9,.25,1)_both] " : "") +
            "ltr:right-2 rtl:left-2"
          }
        >
          <CardSymbol id={card.id} className="w-[62%]" />
        </div>
      )}
    </div>
  );
}
