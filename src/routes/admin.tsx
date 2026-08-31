// The three numbers that decide everything — a private dashboard for the
// owner. No third-party analytics, no extra tracking: everything here is
// computed from data the app already keeps.

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { localDay } from "@/lib/device";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Metrics — Dawnhalo" }] }),
  component: AdminPage,
});

interface Metrics {
  installs: number;
  vows: {
    total: number;
    active: number;
    fulfilled: number;
    released: number;
    last7d: number;
    creationRate: number;
  };
  d30: { eligible: number; returned: number; rate: number };
  share: { closedVows: number; keepsakesViewed: number; lettersViewed: number; rate: number };
  support: { darkNights: number; movesDone: number; subscribed: number };
}

const KEY_LS = "dawnhalo:adminKey";
const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

function AdminPage() {
  const [key, setKey] = useState("");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (k: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/admin/metrics`, {
        headers: { "x-admin-key": k, "x-local-date": localDay() },
      });
      if (!res.ok) throw new Error(String(res.status));
      const body = await res.json();
      setMetrics(body.metrics);
      try {
        localStorage.setItem(KEY_LS, k);
      } catch {
        /* storage unavailable */
      }
    } catch {
      setError("That key didn't unlock the dashboard.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY_LS);
    } catch {
      /* storage unavailable */
    }
    if (saved) {
      setKey(saved);
      void load(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const Tile = ({ big, label, sub }: { big: string; label: string; sub?: string }) => (
    <div className="p-5 bg-dawn-surface/80 border border-dawn-haze/15 rounded-2xl text-center">
      <p className="text-3xl font-serif italic text-dawn-haze">{big}</p>
      <p className="text-[9px] uppercase tracking-widest opacity-50 mt-1">{label}</p>
      {sub && <p className="text-[10px] text-dawn-ink/45 mt-1">{sub}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-dawn-sky text-dawn-ink">
      <main className="max-w-md mx-auto px-6 pt-12 pb-16">
        <header className="mb-8">
          <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-dawn-rose">
            Dawnhalo · owner
          </p>
          <h1 className="mt-1 font-serif text-3xl italic font-light">
            The three numbers
          </h1>
        </header>

        {!metrics && (
          <section className="p-6 bg-dawn-surface/80 border border-dawn-haze/15 rounded-2xl">
            <p className="text-sm text-dawn-ink/70 leading-relaxed">
              Enter the admin key (the server's <code className="text-[12px]">ADMIN_KEY</code>).
            </p>
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="admin key"
              className="mt-4 w-full bg-dawn-sky/60 text-dawn-ink placeholder:text-dawn-ink/30 border border-dawn-haze/15 rounded-xl px-4 py-3.5 text-sm font-mono focus:outline-none focus:ring-1 ring-dawn-rose/30"
            />
            {error && <p className="mt-3 text-[12px] text-dawn-rose">{error}</p>}
            <button
              onClick={() => key.trim() && load(key.trim())}
              disabled={busy || !key.trim()}
              className="mt-4 px-8 py-3 bg-dawn-rose text-dawn-sky text-[11px] uppercase tracking-[0.2em] font-bold rounded-full hover:bg-dawn-haze transition-colors disabled:opacity-40"
            >
              {busy ? "Opening…" : "Open"}
            </button>
          </section>
        )}

        {metrics && (
          <section className="space-y-5 animate-card-rise">
            {/* The three numbers */}
            <div className="grid grid-cols-3 gap-3">
              <Tile
                big={pct(metrics.vows.creationRate)}
                label="vow creation"
                sub={`${metrics.vows.total} vows / ${metrics.installs} installs`}
              />
              <Tile
                big={metrics.d30.eligible ? pct(metrics.d30.rate) : "—"}
                label="D30 return"
                sub={
                  metrics.d30.eligible
                    ? `${metrics.d30.returned} of ${metrics.d30.eligible} old enough`
                    : "no vows 30 days old yet"
                }
              />
              <Tile
                big={metrics.share.closedVows ? pct(metrics.share.rate) : "—"}
                label="share"
                sub={
                  metrics.share.closedVows
                    ? `${metrics.share.keepsakesViewed} of ${metrics.share.closedVows} keepsakes opened`
                    : "no closed vows yet"
                }
              />
            </div>

            {/* Supporting counts */}
            <div className="p-5 bg-dawn-surface/80 border border-dawn-haze/15 rounded-2xl">
              <p className="text-[10px] uppercase tracking-[0.18em] opacity-50 mb-3">
                Supporting counts
              </p>
              <div className="grid grid-cols-2 gap-y-2 text-[13px] text-dawn-ink/75">
                <span>Active vows</span><span className="text-right font-medium">{metrics.vows.active}</span>
                <span>Fulfilled / released</span><span className="text-right font-medium">{metrics.vows.fulfilled} / {metrics.vows.released}</span>
                <span>New vows (7d)</span><span className="text-right font-medium">{metrics.vows.last7d}</span>
                <span>Hard nights witnessed</span><span className="text-right font-medium">{metrics.support.darkNights}</span>
                <span>Small steps done</span><span className="text-right font-medium">{metrics.support.movesDone}</span>
                <span>Letters opened</span><span className="text-right font-medium">{metrics.share.lettersViewed}</span>
                <span>Subscribers</span><span className="text-right font-medium">{metrics.support.subscribed}</span>
              </div>
            </div>

            <p className="text-[11px] text-dawn-ink/50 leading-relaxed px-1">
              Revenue optimization comes after these. If D30 return is weak, fix the product —
              not the paywall.
            </p>

            <button
              onClick={() => load(key)}
              disabled={busy}
              className="px-6 py-2.5 text-[10px] uppercase tracking-[0.18em] font-medium rounded-full border border-dawn-haze/20 text-dawn-ink/70 hover:bg-dawn-haze/10 transition-colors disabled:opacity-50"
            >
              {busy ? "Refreshing…" : "Refresh"}
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
