// The Witness — the public page one chosen person sees. Day number is the
// hero (matching the share format and Today). Privacy is the feature: the
// witness sees the Day, how many times they have returned, and whether they
// showed up today. Never the goal, the states, or anything written.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { track } from "@/lib/analytics";

type WitnessData = {
  active: boolean;
  day?: number;
  checkinCount?: number;
  showedUpToday?: boolean;
} | null;

async function loadWitness(token: string): Promise<WitnessData> {
  try {
    return await api.getWitness(token);
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/witness/$token")({
  loader: ({ params }) => loadWitness(params.token),
  head: () => ({
    meta: [
      { title: "You are their witness — Dawnhalo" },
      {
        name: "description",
        content: "Someone chose you to see their days. Not to push them — just to see them.",
      },
    ],
  }),
  component: WitnessPage,
});

function WitnessPage() {
  const state = Route.useLoaderData();

  useEffect(() => {
    track(state ? "witness_viewed" : "witness_link_broken");
  }, [state]);

  if (!state) {
    return (
      <div className="min-h-screen bg-dawn-sky flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h1 className="text-3xl font-serif italic">This door is closed.</h1>
          <p className="mt-3 text-sm opacity-70">
            The link couldn't be opened. Ask them to send you a fresh one.
          </p>
          <Link
            to="/"
            className="mt-6 inline-block text-[10px] uppercase tracking-[0.18em] border-b border-dawn-ink/10"
          >
            Visit Dawnhalo
          </Link>
        </div>
      </div>
    );
  }

  if (!state.active) {
    return (
      <div className="min-h-screen bg-dawn-sky flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-dawn-rose">
            The witness page
          </p>
          <h1 className="mt-2 text-3xl font-serif italic font-light">Their holding has ended.</h1>
          <p className="mt-3 text-sm opacity-70">
            What they were holding on for has closed. Thank you for having watched.
          </p>
          <Link
            to="/"
            className="mt-6 inline-block text-[10px] uppercase tracking-[0.18em] border-b border-dawn-ink/10"
          >
            Visit Dawnhalo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dawn-sky">
      <main className="max-w-md mx-auto px-6 pt-14 pb-16 text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-dawn-rose">
          You are their witness
        </p>
        <h1 className="mt-2 font-serif text-2xl italic font-light">
          Someone chose you to see their days.
        </h1>

        <section className="relative mt-10 animate-card-rise">
          <div
            className="absolute -inset-6 bg-dawn-haze/30 blur-3xl rounded-[3rem] animate-halo -z-10"
            aria-hidden
          />
          <div className="relative bg-white border border-dawn-ink/5 rounded-2xl px-7 py-12 shadow-[0_30px_60px_-30px_rgba(45,42,46,0.18)]">
            <p className="text-[10px] uppercase tracking-[0.24em] opacity-45">Day</p>
            <p className="mt-1 font-serif font-light leading-none text-[6.5rem] tracking-tight">
              {state.day}
            </p>
            <p className="mt-6 font-serif italic text-lg text-dawn-ink/75">
              {state.checkinCount === 1
                ? "Once, they have returned."
                : `${state.checkinCount} times, they have returned.`}
            </p>
            {state.showedUpToday && (
              <p className="mt-2 text-sm text-dawn-ink/60">They showed up today.</p>
            )}
          </div>
        </section>

        <p className="mt-8 text-sm leading-relaxed text-dawn-ink/60 max-w-[38ch] mx-auto">
          You don't need to push them, or ask how it's going. Being seen is the whole gift — and
          you are the one they trusted to see.
        </p>

        <div className="mt-10">
          <Link
            to="/"
            onClick={() => track("witness_cta_clicked")}
            className="inline-block px-6 py-3 bg-dawn-ink text-white text-[11px] uppercase tracking-[0.2em] font-bold rounded-full hover:bg-dawn-ink/90"
          >
            What is Dawnhalo?
          </Link>
          <p className="mt-3 text-[10px] uppercase tracking-widest opacity-40">
            Dawnhalo · a little light for your next step
          </p>
        </div>
      </main>
    </div>
  );
}
