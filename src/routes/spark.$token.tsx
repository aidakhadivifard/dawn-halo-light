import { createFileRoute, Link } from "@tanstack/react-router";
import { decodeShare, ART } from "@/lib/dawnhalo";

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
  const data = decodeShare(token);

  if (!data) {
    return (
      <div className="min-h-screen bg-dawn-sky flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h1 className="text-3xl font-serif italic">The spark dimmed.</h1>
          <p className="mt-3 text-sm opacity-70">This link couldn't be opened. Try asking the sender for a fresh one.</p>
          <Link to="/" className="mt-6 inline-block text-[10px] uppercase tracking-[0.18em] border-b border-dawn-ink/10">Draw your own card</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dawn-sky">
      <main className="max-w-md mx-auto px-6 pt-12 pb-16">
        <header className="text-center mb-8">
          <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-dawn-rose">A spark for you</p>
          <h1 className="mt-2 font-serif text-2xl italic font-light">Someone thought of you.</h1>
        </header>

        {data.note && (
          <div className="mb-6 p-5 bg-dawn-glow/60 border border-dawn-haze/30 rounded-2xl">
            <p className="text-[10px] uppercase tracking-[0.18em] opacity-50 mb-2">Their note</p>
            <p className="font-serif italic text-lg leading-relaxed">"{data.note}"</p>
          </div>
        )}

        <article className="relative animate-card-rise">
          <div className="absolute -inset-6 bg-dawn-haze/30 blur-3xl rounded-[3rem] animate-halo -z-10" aria-hidden />
          <div className="relative bg-white border border-dawn-ink/5 rounded-2xl p-7 shadow-[0_30px_60px_-30px_rgba(45,42,46,0.18)]">
            <div className="w-full aspect-[4/5] mb-7 rounded-lg overflow-hidden ring-1 ring-dawn-ink/5">
              <img src={ART[data.art]} alt={data.title} width={800} height={1000} className="h-full w-full object-cover" />
            </div>
            <p className="text-sm italic font-serif opacity-60 leading-relaxed">{data.opener}</p>
            <h2 className="mt-3 text-3xl font-serif font-light tracking-tight">{data.title}</h2>
            <p className="mt-4 text-dawn-ink/80 leading-relaxed text-[15px] max-w-[46ch]">{data.message}</p>
          </div>
        </article>

        <div className="mt-10 text-center">
          <Link to="/"
            className="inline-block px-6 py-3 bg-dawn-ink text-white text-[11px] uppercase tracking-[0.2em] font-bold rounded-full hover:bg-dawn-ink/90">
            Draw your own card
          </Link>
          <p className="mt-3 text-[10px] uppercase tracking-widest opacity-40">Dawnhalo · a little light for your next step</p>
        </div>
      </main>
    </div>
  );
}
