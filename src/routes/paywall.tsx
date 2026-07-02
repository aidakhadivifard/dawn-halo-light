import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/paywall")({
  head: () => ({ meta: [{ title: "Plans — Dawnhalo" }, { name: "description", content: "Unlimited cards, from $4.99/mo." }] }),
  component: PaywallPage,
});

function PaywallPage() {
  const [plan, setPlan] = useState<"yearly" | "monthly">("yearly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Stripe sends the user back here with ?checkout=cancelled on abandon.
    const cancelled = new URLSearchParams(window.location.search).get("checkout") === "cancelled";
    track(cancelled ? "checkout_cancelled" : "paywall_viewed");
    if (cancelled) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const beginCheckout = async () => {
    setLoading(true);
    setError("");
    track("checkout_started", { plan });
    try {
      const { url } = await api.checkout(plan);
      if (url) {
        window.location.href = url;
      } else {
        track("checkout_unavailable", { plan });
        setError("Checkout isn't available right now. Please try again later.");
      }
    } catch {
      track("checkout_unavailable", { plan });
      setError("Checkout isn't available right now. Please try again later.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-dawn-sky flex flex-col">
      <main className="flex-1 max-w-md w-full mx-auto px-6 pt-12 pb-16">
        <Link to="/" className="text-[10px] uppercase tracking-[0.18em] opacity-50">← Not now</Link>

        <header className="mt-8 text-center">
          <p className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-50 mb-2">Deepen your practice</p>
          <h1 className="text-4xl font-serif font-light italic leading-tight">Keep the light on.</h1>
          <p className="mt-4 text-sm opacity-70 leading-relaxed max-w-[34ch] mx-auto">
            You've drawn your free cards for the day. Choose a plan to keep the oracle open — and the mornings warmer.
          </p>
        </header>

        <div className="mt-10 space-y-3">
          <button onClick={() => setPlan("yearly")}
            className={"w-full text-left p-5 rounded-2xl border transition-all " +
              (plan === "yearly" ? "bg-dawn-ink text-white border-dawn-ink shadow-lg" : "bg-white border-dawn-ink/10")}>
            <div className="flex justify-between items-start">
              <div>
                <p className={"text-[10px] uppercase tracking-[0.18em] " + (plan === "yearly" ? "opacity-70" : "text-dawn-rose")}>Best value · save 50%</p>
                <p className="font-serif text-2xl mt-1">Yearly</p>
                <p className={"text-xs mt-1 " + (plan === "yearly" ? "opacity-70" : "opacity-60")}>Billed once at $59.99</p>
              </div>
              <div className="text-right">
                <p className="font-serif text-2xl">$4.99<span className="text-sm opacity-60">/mo</span></p>
              </div>
            </div>
          </button>

          <button onClick={() => setPlan("monthly")}
            className={"w-full text-left p-5 rounded-2xl border transition-all " +
              (plan === "monthly" ? "bg-dawn-ink text-white border-dawn-ink shadow-lg" : "bg-white border-dawn-ink/10")}>
            <div className="flex justify-between items-start">
              <div>
                <p className={"text-[10px] uppercase tracking-[0.18em] " + (plan === "monthly" ? "opacity-70" : "opacity-50")}>Flexible</p>
                <p className="font-serif text-2xl mt-1">Monthly</p>
                <p className={"text-xs mt-1 " + (plan === "monthly" ? "opacity-70" : "opacity-60")}>Cancel anytime</p>
              </div>
              <div className="text-right">
                <p className="font-serif text-2xl">$9.99<span className="text-sm opacity-60">/mo</span></p>
              </div>
            </div>
          </button>
        </div>

        <ul className="mt-8 space-y-3 text-sm opacity-80">
          {[
            "Unlimited card draws and follow-ups",
            "Full history and saved cards",
            "Gentle daily reminders",
            "Share cards with people you love",
          ].map((f) => (
            <li key={f} className="flex items-center gap-3">
              <span className="size-1.5 rounded-full bg-dawn-rose" />
              {f}
            </li>
          ))}
        </ul>

        <button onClick={beginCheckout} disabled={loading}
          className="mt-8 w-full py-4 bg-dawn-ink text-white text-[11px] uppercase tracking-[0.2em] font-bold rounded-full hover:bg-dawn-ink/90 disabled:opacity-60">
          {loading ? "Opening checkout…" : `Begin ${plan === "yearly" ? "yearly" : "monthly"} plan`}
        </button>
        {error && <p className="mt-3 text-center text-[11px] text-dawn-rose">{error}</p>}
        <p className="mt-3 text-center text-[10px] uppercase tracking-widest opacity-40">Secure checkout · cancel anytime</p>
      </main>
    </div>
  );
}
