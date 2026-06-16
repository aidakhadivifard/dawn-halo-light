import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/support")({
  head: () => ({ meta: [{ title: "You're not alone — Dawnhalo" }, { name: "description", content: "Immediate support resources." }] }),
  component: SupportPage,
});

function SupportPage() {
  return (
    <div className="min-h-screen bg-dawn-sky flex items-center justify-center px-6 py-16">
      <div className="max-w-md w-full bg-white border border-dawn-ink/5 rounded-2xl p-8 shadow-[0_30px_60px_-30px_rgba(45,42,46,0.18)] text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-dawn-rose mb-3">A pause, with care</p>
        <h1 className="text-3xl font-serif font-light italic leading-tight">You're not alone in this.</h1>
        <p className="mt-4 text-sm opacity-80 leading-relaxed text-pretty">
          What you're carrying sounds heavy. A card isn't the right thing for this moment — a real person is.
          Please reach out to someone trained to listen. They want to hear from you.
        </p>

        <div className="mt-8 space-y-3 text-left">
          <a href="tel:988" className="block p-4 bg-dawn-glow/60 border border-dawn-haze/30 rounded-xl hover:bg-dawn-glow transition-colors">
            <p className="text-[10px] uppercase tracking-[0.18em] opacity-60">United States</p>
            <p className="font-serif text-xl mt-1">988 — call or text</p>
            <p className="text-xs opacity-70 mt-0.5">Suicide & Crisis Lifeline · 24/7</p>
          </a>
          <a href="tel:116123" className="block p-4 bg-dawn-glow/60 border border-dawn-haze/30 rounded-xl hover:bg-dawn-glow transition-colors">
            <p className="text-[10px] uppercase tracking-[0.18em] opacity-60">United Kingdom</p>
            <p className="font-serif text-xl mt-1">Samaritans — 116 123</p>
            <p className="text-xs opacity-70 mt-0.5">Free, 24/7, any reason at all</p>
          </a>
        </div>

        <Link to="/" className="inline-block mt-8 text-[10px] uppercase tracking-[0.18em] opacity-50 border-b border-dawn-ink/10">
          Back to today, when you're ready
        </Link>
      </div>
    </div>
  );
}
