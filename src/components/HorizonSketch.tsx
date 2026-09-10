// The horizon sketch — the person's own words, drawn once in a thin ink line.
// Underneath waits the same drawing in watercolor. Every done step and every
// hard night stayed through lets a little more of the color through: the far
// things first (edges), the person last (center). No number is ever shown;
// the picture is the only readout. Nothing is ever un-colored.

import { useEffect, useRef, useState } from "react";
import type { Sketch } from "@/lib/vow";

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Color due, 0..1 — eased so the first steps show clearly and the last ones close gently. */
function fractionOf(lit: number, fullAt: number): number {
  const f = Math.max(0, Math.min(1, lit / Math.max(1, fullAt)));
  return 1 - Math.pow(1 - f, 2);
}

export function HorizonSketch({ sketch, words }: { sketch: Sketch; words: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgs = useRef<{ line: HTMLImageElement; color: HTMLImageElement } | null>(null);
  const shown = useRef(0); // the fraction currently painted (animates toward target)
  const [ready, setReady] = useState(false);
  const target = fractionOf(sketch.lit, sketch.fullAt);

  // Load both pictures once per URL pair.
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
        shown.current = target; // first paint: no animation, the state simply is
        paint(target);
        setReady(true);
      })
      .catch(() => setReady(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sketch.lineUrl, sketch.colorUrl]);

  // Animate toward the new fraction whenever the staying grows.
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

    // 1. The colored picture, seen only outside a shrinking soft circle.
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(pair.color, 0, 0, W, H);
    if (fraction < 1) {
      // Radius of what is still uncolored: reaches the far corners at 0 (so the
      // very first step shows at the edges), gone at 1. The center — her — last.
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
    // 2. The ink drawing underneath everything (paper + lines) …
    ctx.globalCompositeOperation = "destination-over";
    ctx.drawImage(pair.line, 0, 0, W, H);
    // 3. … and the lines once more on top, so color never blurs them.
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(pair.line, 0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
  }

  const pending = sketch.status === "pending" || (sketch.status === "ready" && !ready);

  return (
    <section className="mb-8">
      <div className="relative rounded-2xl border border-dawn-haze/15 bg-dawn-surface/80 overflow-hidden shadow-[0_30px_60px_-40px_rgba(59,46,79,0.35)]">
        {sketch.status === "ready" && (
          <canvas
            ref={canvasRef}
            className="block w-full h-auto"
            role="img"
            aria-label="Your horizon, drawn in thin lines and slowly taking color"
          />
        )}
        {pending && (
          <div className="aspect-[16/9] flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div
              aria-hidden
              className="w-24 h-24 rounded-full blur-2xl animate-halo-breathe"
              style={{ background: "radial-gradient(circle, rgba(201,162,74,0.45) 0%, rgba(201,162,74,0.15) 45%, transparent 70%)" }}
            />
            <p className="font-serif italic text-lg text-dawn-ink/80 leading-relaxed">
              Drawing your horizon in one thin line…
            </p>
            <p className="text-[13px] text-dawn-muted">It takes a minute. You can go on; it will be here.</p>
          </div>
        )}
        {(sketch.status === "failed" || (sketch.status === "none" && words)) && (
          <div className="aspect-[16/9] flex items-center justify-center px-8 text-center">
            <p className="font-serif italic text-xl text-dawn-ink/80 leading-snug text-balance">“{words}”</p>
          </div>
        )}
        {words && sketch.status === "ready" && (
          <p className="px-5 py-3 font-serif italic text-base text-dawn-ink/75 leading-snug text-center border-t border-dawn-haze/10">
            “{words}”
          </p>
        )}
      </div>
    </section>
  );
}
