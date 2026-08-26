// Public keepsake page — the whole arc of a vow, shareable. This is the
// artifact people pass around: the card, the days held, the dark nights
// survived, and how the road ended.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getKeepsake } from "@/lib/vow";
import type { ApiKeepsake } from "@/lib/api";
import { srcForId } from "@/lib/cardLibrary";
import { artForCard } from "@/lib/dawnhalo";

export const Route = createFileRoute("/keepsake/$token")({
  head: () => ({
    meta: [
      { title: "A Keepsake — Dawnhalo" },
      { name: "description", content: "One vow, held to the end." },
      { property: "og:title", content: "A Keepsake from Dawnhalo" },
      { property: "og:description", content: "Someone held on. This is the whole story." },
    ],
  }),
  component: KeepsakePage,
});

function formatLocal(date: string | null): string {
  if (!date) return "";
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function KeepsakePage() {
  const { token } = Route.useParams();
  const [state, setState] = useState<ApiKeepsake | null | "error">(null);

  useEffect(() => {
    let alive = true;
    getKeepsake(token).then((k) => alive && setState(k ?? "error"));
    return () => {
      alive = false;
    };
  }, [token]);

  if (state === null) {
    return (
      <div className="min-h-screen bg-dawn-sky flex items-center justify-center px-6">
        <p className="text-sm italic opacity-60 font-serif">Opening the keepsake…</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="min-h-screen bg-dawn-sky flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h1 className="text-3xl font-serif italic">This keepsake couldn't be found.</h1>
          <p className="mt-3 text-sm opacity-70">The link may be old or mistyped.</p>
          <Link
            to="/"
            className="mt-6 inline-block text-[10px] uppercase tracking-[0.18em] border-b border-dawn-ink/10"
          >
            Make your own vow
          </Link>
        </div>
      </div>
    );
  }

  const k = state;
  const illustration =
    srcForId(k.illustrationId, k.theme) ?? artForCard({ id: token, theme: k.theme });
  const fulfilled = k.status === "fulfilled";

  return (
    <div className="min-h-screen bg-dawn-sky text-dawn-ink">
      <main className="max-w-md mx-auto px-6 pt-12 pb-16">
        <header className="text-center mb-8">
          <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-dawn-rose">
            {fulfilled ? "It came true" : "Held, then released"}
          </p>
          <h1 className="mt-2 font-serif text-2xl italic font-light">
            {k.daysHeld} days of holding on.
          </h1>
        </header>

        <article className="relative animate-card-rise">
          <div
            className="absolute -inset-6 bg-dawn-haze/30 blur-3xl rounded-[3rem] animate-halo -z-10"
            aria-hidden
          />
          <div className="relative bg-dawn-surface/80 border border-dawn-haze/15 rounded-2xl p-7 backdrop-blur-xl shadow-[0_30px_60px_-30px_rgba(45,42,46,0.18)]">
            <div className="w-full aspect-[4/5] mb-7 rounded-lg overflow-hidden ring-1 ring-dawn-haze/15 bg-black/30">
              <img src={illustration} alt={k.cardTitle} width={800} height={1000} className="h-full w-full object-cover" />
            </div>

            <p className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-40 mb-2">
              The vow card · drawn once, never redrawn
            </p>
            <h2 className="text-3xl font-serif font-light tracking-tight">{k.cardTitle}</h2>
            {k.cardEssence && (
              <p className="mt-1 text-sm italic font-serif opacity-60">{k.cardEssence}</p>
            )}

            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-dawn-sky/60 border border-dawn-haze/15 rounded-xl">
                <p className="text-2xl font-serif italic text-dawn-haze">{k.daysHeld}</p>
                <p className="text-[8px] uppercase tracking-widest opacity-50 mt-1">days held</p>
              </div>
              <div className="p-3 bg-dawn-sky/60 border border-dawn-haze/15 rounded-xl">
                <p className="text-2xl font-serif italic text-dawn-haze">{k.darkNights}</p>
                <p className="text-[8px] uppercase tracking-widest opacity-50 mt-1">hard nights</p>
              </div>
              <div className="p-3 bg-dawn-sky/60 border border-dawn-haze/15 rounded-xl">
                <p className="text-lg font-serif italic text-dawn-haze leading-8">
                  {fulfilled ? "✓" : "☾"}
                </p>
                <p className="text-[8px] uppercase tracking-widest opacity-50 mt-1">
                  {fulfilled ? "fulfilled" : "released"}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] opacity-50 mb-1">They endured</p>
                <p className="font-serif italic text-[15px] leading-relaxed">“{k.enduring}”</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] opacity-50 mb-1">They hoped</p>
                <p className="font-serif italic text-[15px] leading-relaxed">“{k.hope}”</p>
              </div>
              {k.closingNote && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] opacity-50 mb-1">
                    {fulfilled ? "How it ended" : "Their closing word"}
                  </p>
                  <p className="font-serif italic text-[15px] leading-relaxed">“{k.closingNote}”</p>
                </div>
              )}
            </div>

            <p className="mt-6 pt-4 border-t border-dawn-haze/10 text-[10px] uppercase tracking-widest opacity-40 text-center">
              {formatLocal(k.startedLocalDate)} — {formatLocal(k.closedLocalDate)}
            </p>
          </div>
        </article>

        <div className="mt-10 text-center">
          <Link
            to="/"
            className="inline-block px-6 py-3 bg-dawn-ink text-white text-[11px] uppercase tracking-[0.2em] font-bold rounded-full hover:bg-dawn-ink/90"
          >
            Make your own vow
          </Link>
          <p className="mt-3 text-[10px] uppercase tracking-widest opacity-40">
            Dawnhalo · one card, held to the end
          </p>
        </div>
      </main>
    </div>
  );
}
