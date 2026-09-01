import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fromApiCard, type Card } from "@/lib/cards";
import { decodeShare, artForCard } from "@/lib/dawnhalo";

export const Route = createFileRoute("/spark/$token")({
  head: () => ({
    meta: [
      { title: "A Spark from Dawnhalo" },
      { name: "description", content: "Someone sent you a little light." },
      { property: "og:title", content: "A Spark from Dawnhalo" },
      { property: "og:description", content: "Someone sent you a little light for your next step." },
    ],
  }),
  component: SparkPage,
});

function SparkPage() {
  const { token } = Route.useParams();
  const [state, setState] = useState<{ card: Card; note: string } | null | "error">(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Prefer the backend-stored spark; fall back to a legacy encoded token.
      try {
        const { card, note } = await api.getSpark(token);
        if (alive) setState({ card: fromApiCard(card), note });
        return;
      } catch {
        /* try legacy decode below */
      }
      const data = decodeShare(token);
      if (!data) {
        if (alive) setState("error");
        return;
      }
      if (alive)
        setState({
          card: {
            id: token,
            opener: data.opener,
            title: data.title,
            message: data.message,
            theme: data.theme,
            illustration: artForCard({ id: token, art: data.art, theme: data.theme }),
          },
          note: data.note,
        });
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  if (state === null) {
    return (
      <div className="min-h-screen bg-dawn-sky flex items-center justify-center px-6">
        <p className="text-base italic opacity-75 font-serif">Opening your spark…</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="min-h-screen bg-dawn-sky flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h1 className="text-3xl font-serif italic">The spark dimmed.</h1>
          <p className="mt-3 text-base opacity-70">This link couldn't be opened. Try asking the sender for a fresh one.</p>
          <Link to="/" className="mt-6 inline-block text-[12px] uppercase tracking-[0.18em] border-b border-dawn-ink/10">Draw your own card</Link>
        </div>
      </div>
    );
  }

  const { card, note } = state;

  return (
    <div className="min-h-screen bg-dawn-sky">
      <main className="max-w-md mx-auto px-6 pt-12 pb-16">
        <header className="text-center mb-8">
          <p className="text-[12px] uppercase tracking-[0.2em] font-medium text-dawn-rose">A spark for you</p>
          <h1 className="mt-2 font-serif text-2xl italic font-light">Someone thought of you.</h1>
        </header>

        {note && (
          <div className="mb-6 p-5 bg-dawn-glow/60 border border-dawn-haze/30 rounded-2xl">
            <p className="text-[12px] uppercase tracking-[0.18em] opacity-70 mb-2">Their note</p>
            <p className="font-serif italic text-lg leading-relaxed">"{note}"</p>
          </div>
        )}

        <article className="relative animate-card-rise">
          <div className="absolute -inset-6 bg-dawn-haze/30 blur-3xl rounded-[3rem] animate-halo -z-10" aria-hidden />
          <div className="relative bg-white border border-dawn-ink/5 rounded-2xl p-7 shadow-[0_30px_60px_-30px_rgba(45,42,46,0.18)]">
            <div className="w-full aspect-[4/5] mb-7 rounded-lg overflow-hidden ring-1 ring-dawn-ink/5">
              <img src={card.illustration} alt={card.title} width={800} height={1000} className="h-full w-full object-cover" />
            </div>
            <p className="text-base italic font-serif opacity-75 leading-relaxed">{card.opener}</p>
            <h2 className="mt-3 text-3xl font-serif font-light tracking-tight">{card.title}</h2>
            <p className="mt-4 text-dawn-ink/80 leading-relaxed text-base max-w-[46ch]">{card.message}</p>
          </div>
        </article>

        <div className="mt-10 text-center">
          <Link to="/"
            className="inline-block px-6 py-3 bg-dawn-ink text-white text-[13px] uppercase tracking-[0.2em] font-bold rounded-full hover:bg-dawn-ink/90">
            Draw your own card
          </Link>
          <p className="mt-3 text-[12px] uppercase tracking-widest opacity-60">Dawnhalo · a little light for your next step</p>
        </div>
      </main>
    </div>
  );
}
