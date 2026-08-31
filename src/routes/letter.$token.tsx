// The unsealed letter — the page the recipient opens. They knew nothing until
// this moment; now they receive the letter written on day one, plus the whole
// arc it was sealed through. Exists only for fulfilled vows.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getLetter } from "@/lib/vow";
import type { ApiLetter } from "@/lib/api";
import { srcForId } from "@/lib/cardLibrary";
import { artForCard } from "@/lib/dawnhalo";

export const Route = createFileRoute("/letter/$token")({
  head: () => ({
    meta: [
      { title: "A Letter — Dawnhalo" },
      { name: "description", content: "Someone made a vow with your name on it." },
      { property: "og:title", content: "A letter was kept for you" },
      { property: "og:description", content: "Written on day one. Sealed the whole way. Opened today." },
    ],
  }),
  component: LetterPage,
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

function LetterPage() {
  const { token } = Route.useParams();
  const [state, setState] = useState<ApiLetter | null | "error">(null);

  useEffect(() => {
    let alive = true;
    getLetter(token).then((l) => alive && setState(l ?? "error"));
    return () => {
      alive = false;
    };
  }, [token]);

  if (state === null) {
    return (
      <div className="min-h-screen bg-dawn-sky flex items-center justify-center px-6">
        <p className="text-sm italic opacity-60 font-serif">Unsealing…</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="min-h-screen bg-dawn-sky flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h1 className="text-3xl font-serif italic">This letter couldn't be found.</h1>
          <p className="mt-3 text-sm opacity-70">The link may be old or mistyped.</p>
          <Link
            to="/"
            className="mt-6 inline-block text-[10px] uppercase tracking-[0.18em] border-b border-dawn-ink/10"
          >
            Dawnhalo
          </Link>
        </div>
      </div>
    );
  }

  const l = state;
  const k = l.keepsake;
  const illustration =
    srcForId(k.illustrationId, k.theme) ?? artForCard({ id: token, theme: k.theme });

  return (
    <div className="min-h-screen bg-dawn-sky text-dawn-ink">
      <main className="max-w-md mx-auto px-6 pt-12 pb-16">
        <header className="text-center mb-8">
          <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-dawn-rose">
            For {l.to}
          </p>
          <h1 className="mt-2 font-serif text-2xl italic font-light">
            A letter was kept for you.
          </h1>
          <p className="mt-2 text-[12px] text-dawn-ink/55 leading-relaxed max-w-[40ch] mx-auto">
            It was written on {formatLocal(l.writtenLocalDate)} and sealed — you were never told.
            It could only be opened this way: by the vow being kept.
          </p>
        </header>

        <article className="relative animate-card-rise">
          <div
            className="absolute -inset-6 bg-dawn-haze/30 blur-3xl rounded-[3rem] animate-halo -z-10"
            aria-hidden
          />
          <div className="relative bg-dawn-surface/80 border border-dawn-haze/15 rounded-2xl p-7 backdrop-blur-xl">
            <p className="text-[10px] uppercase tracking-[0.2em] opacity-50 mb-3">The letter</p>
            <div className="space-y-3">
              {l.text.split(/\n{2,}/).map((p, i) => (
                <p key={i} className="font-serif italic text-[16px] leading-relaxed text-dawn-ink/90">
                  {p}
                </p>
              ))}
            </div>

            <div className="mt-7 pt-6 border-t border-dawn-haze/10">
              <p className="text-[10px] uppercase tracking-[0.2em] opacity-50 mb-3">
                What it was sealed through
              </p>
              <div className="flex items-center gap-4">
                <div className="size-16 rounded-lg overflow-hidden ring-1 ring-dawn-haze/15 shrink-0 bg-black/30">
                  <img src={illustration} alt={k.cardTitle} className="h-full w-full object-cover" />
                </div>
                <div>
                  <p className="font-serif text-lg font-light">{k.cardTitle}</p>
                  <p className="text-[12px] text-dawn-ink/55">
                    {k.daysHeld} days held · {k.darkNights} hard night{k.darkNights === 1 ? "" : "s"} · fulfilled
                  </p>
                </div>
              </div>
              <p className="mt-4 text-[13px] text-dawn-ink/65 leading-relaxed">
                They endured: <span className="font-serif italic">“{k.enduring}”</span>
                <br />
                They hoped: <span className="font-serif italic">“{k.hope}”</span>
              </p>
            </div>
          </div>
        </article>

        <div className="mt-10 text-center">
          <Link
            to="/"
            className="inline-block px-6 py-3 bg-dawn-ink text-white text-[11px] uppercase tracking-[0.2em] font-bold rounded-full hover:bg-dawn-ink/90"
          >
            Make a vow of your own
          </Link>
          <p className="mt-3 text-[10px] uppercase tracking-widest opacity-40">
            Dawnhalo · one card, held to the end
          </p>
        </div>
      </main>
    </div>
  );
}
