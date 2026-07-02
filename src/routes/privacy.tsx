import { createFileRoute, Link } from "@tanstack/react-router";

// Privacy policy — required by both the Apple App Store and Google Play
// (and linked from Settings). Written to match what the app actually does:
// no accounts, an anonymous device id, server-side card generation, Stripe
// checkout on the web, optional anonymous analytics.

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy — Dawnhalo" },
      { name: "description", content: "What Dawnhalo stores, what it never collects, and how to remove your data." },
    ],
  }),
  component: PrivacyPage,
});

const UPDATED = "July 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-serif text-xl font-light text-dawn-ink">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-dawn-ink/75">{children}</div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-dawn-sky text-dawn-ink">
      <main className="max-w-md mx-auto px-6 pt-12 pb-16">
        <Link to="/settings" className="text-[10px] uppercase tracking-[0.18em] opacity-50">
          ← Back
        </Link>

        <header className="mt-8">
          <p className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-50 mb-1">Last updated {UPDATED}</p>
          <h1 className="text-3xl font-serif font-light tracking-tight italic">Privacy.</h1>
          <p className="mt-3 text-sm leading-relaxed text-dawn-ink/70">
            Dawnhalo is built to know as little about you as possible. There are no accounts, no
            names, and no profiles — just a quiet card each morning.
          </p>
        </header>

        <Section title="What we store">
          <p>
            <strong>An anonymous device id.</strong> A random identifier created on your device. It
            is not your name, email, phone number, or advertising id, and it can't be traced back
            to you.
          </p>
          <p>
            <strong>Your cards.</strong> The cards you draw, save, and share are stored against
            that device id so your history, streak, and saved cards work.
          </p>
          <p>
            <strong>What you type.</strong> When you ask the oracle a question or share a feeling,
            that text is sent to our server and to our AI provider (Anthropic) once, to generate
            your card. It is used for nothing else.
          </p>
        </Section>

        <Section title="What we never collect">
          <p>
            No account, no password, no contacts, no location, no photos, no advertising
            identifiers, and no selling or sharing of data with data brokers — ever.
          </p>
        </Section>

        <Section title="Payments">
          <p>
            Subscriptions are processed by Stripe. Your card details go directly to Stripe and
            never touch our servers. Stripe collects your email to manage the subscription; we
            attach the subscription to your anonymous device id.
          </p>
        </Section>

        <Section title="Analytics">
          <p>
            We record anonymous product events (for example "a card was drawn") to understand
            what's working. These events never include what you typed or the content of your
            cards, and they are keyed to the same anonymous device id.
          </p>
        </Section>

        <Section title="If you're struggling">
          <p>
            If you type something that suggests you may be in crisis, the app shows support
            resources instead of a card. That check runs the same way for everyone and the text is
            handled with the same care as everything else you type.
          </p>
        </Section>

        <Section title="Deleting your data">
          <p>
            Deleting the app (or clearing site data in the browser) removes the device id, which
            permanently unlinks everything stored on our server from your device. You can also
            contact us through the store listing's support contact to request deletion of the data
            tied to your device id.
          </p>
        </Section>

        <p className="mt-12 text-center text-[10px] uppercase tracking-[0.2em] opacity-30">
          Dawnhalo · a little light for your next step
        </p>
      </main>
    </div>
  );
}
