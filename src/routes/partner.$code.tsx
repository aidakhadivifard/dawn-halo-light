// Partner dashboard — for creators who refer people with their ?ref=CODE link.
// Authenticated by the partner's own secret key (given when the partner is
// created). Shows installs, subscribers, referred revenue, and their share.

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, type PartnerStats } from "@/lib/api";

export const Route = createFileRoute("/partner/$code")({
  head: () => ({
    meta: [
      { title: "Partner — Dawnhalo" },
      { name: "description", content: "Your referral dashboard." },
    ],
  }),
  component: PartnerPage,
});

const KEY_PREFIX = "dawnhalo:partnerKey:";

function PartnerPage() {
  const { code } = Route.useParams();
  const [key, setKey] = useState("");
  const [stats, setStats] = useState<PartnerStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = async (k: string) => {
    setBusy(true);
    setError(null);
    try {
      const s = await api.partnerStats(code, k);
      setStats(s);
      try {
        localStorage.setItem(KEY_PREFIX + code, k);
      } catch {
        /* storage unavailable */
      }
    } catch {
      setError("That key didn't unlock this dashboard. Check it and try again.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY_PREFIX + code);
    } catch {
      /* storage unavailable */
    }
    if (saved) {
      setKey(saved);
      void load(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const copyLink = async () => {
    if (!stats) return;
    try {
      await navigator.clipboard.writeText(stats.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="min-h-screen bg-dawn-sky text-dawn-ink">
      <main className="max-w-md mx-auto px-6 pt-12 pb-16">
        <header className="mb-8">
          <p className="text-[12px] uppercase tracking-[0.2em] font-medium text-dawn-rose">
            Dawnhalo Partner
          </p>
          <h1 className="mt-1 font-serif text-3xl italic font-light">
            {stats ? stats.name : code}
          </h1>
        </header>

        {!stats && (
          <section className="p-6 bg-dawn-surface/80 border border-dawn-haze/15 rounded-2xl backdrop-blur-xl">
            <p className="text-base text-dawn-ink/70 leading-relaxed">
              Enter your partner key to open the dashboard. It was given to you with your referral
              link and starts with <code className="text-[14px]">pk_</code>.
            </p>
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="pk_…"
              className="mt-4 w-full bg-dawn-sky/60 text-dawn-ink placeholder:text-dawn-ink/45 border border-dawn-haze/15 rounded-xl px-4 py-3.5 text-base font-mono focus:outline-none focus:ring-1 ring-dawn-rose/30"
            />
            {error && <p className="mt-3 text-[14px] text-dawn-rose">{error}</p>}
            <button
              onClick={() => key.trim() && load(key.trim())}
              disabled={busy || !key.trim()}
              className="mt-4 px-8 py-3 bg-dawn-rose text-dawn-sky text-[13px] uppercase tracking-[0.2em] font-bold rounded-full hover:bg-dawn-haze transition-colors disabled:opacity-60"
            >
              {busy ? "Opening…" : "Open dashboard"}
            </button>
          </section>
        )}

        {stats && (
          <section className="space-y-4 animate-card-rise">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-5 bg-dawn-surface/80 border border-dawn-haze/15 rounded-2xl text-center">
                <p className="text-3xl font-serif italic text-dawn-haze">{stats.installs}</p>
                <p className="text-[12px] uppercase tracking-widest opacity-70 mt-1">people referred</p>
              </div>
              <div className="p-5 bg-dawn-surface/80 border border-dawn-haze/15 rounded-2xl text-center">
                <p className="text-3xl font-serif italic text-dawn-haze">{stats.subscribers}</p>
                <p className="text-[12px] uppercase tracking-widest opacity-70 mt-1">subscribed</p>
              </div>
              <div className="p-5 bg-dawn-surface/80 border border-dawn-haze/15 rounded-2xl text-center">
                <p className="text-3xl font-serif italic text-dawn-haze">
                  ${stats.revenueUsd.toFixed(2)}
                </p>
                <p className="text-[12px] uppercase tracking-widest opacity-70 mt-1">referred revenue</p>
              </div>
              <div className="p-5 bg-dawn-rose/15 border border-dawn-rose/30 rounded-2xl text-center">
                <p className="text-3xl font-serif italic text-dawn-rose">
                  ${stats.accruedUsd.toFixed(2)}
                </p>
                <p className="text-[12px] uppercase tracking-widest opacity-75 mt-1">
                  your share ({stats.revSharePct}%)
                </p>
              </div>
            </div>

            <div className="p-5 bg-dawn-surface/80 border border-dawn-haze/15 rounded-2xl">
              <p className="text-[12px] uppercase tracking-[0.18em] opacity-70 mb-2">
                Your referral link
              </p>
              <p className="text-[15px] font-mono break-all text-dawn-ink/80">{stats.shareUrl}</p>
              <button
                onClick={copyLink}
                className="mt-3 px-6 py-2.5 bg-dawn-rose text-dawn-sky text-[12px] uppercase tracking-[0.18em] font-bold rounded-full hover:bg-dawn-haze transition-colors"
              >
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>

            <p className="text-[13px] text-dawn-ink/70 leading-relaxed px-1">
              Revenue counts each referred subscriber's first payment. Payouts are settled with you
              directly — your share accrues here so both sides see the same number.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
