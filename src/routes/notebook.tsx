// The notebook — every line the witness has written, newest first.
//
// Each line is a card. She can send any of them, and what leaves the phone is
// a picture with everything on it. He never wrote a verdict here: only what
// she did, in his hand, and the fact that he saw it.

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Shell, Secondary } from "@/components/WishShell";
import { WitnessLine } from "@/components/WitnessLine";
import { useLang } from "@/hooks/useLang";
import { dict } from "@/lib/i18n";
import { api, type ApiDeed } from "@/lib/api";
import { getHome, type Home } from "@/lib/vow";
import { renderCard, shareCard } from "@/lib/sharecard";

export const Route = createFileRoute("/notebook")({
  head: () => ({ meta: [{ title: "Notebook — Dawnhalo" }] }),
  component: NotebookPage,
});

function NotebookPage() {
  const { lang, setLang, dir } = useLang();
  const t = dict(lang);
  const [deeds, setDeeds] = useState<ApiDeed[] | null>(null);
  const [home, setHome] = useState<Home | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    api.listDeeds().then((r) => setDeeds(r.deeds)).catch(() => setDeeds([]));
    getHome().then(setHome).catch(() => {});
  }, []);

  // Oldest first for counting, newest first for reading.
  const numbered = useMemo(() => {
    if (!deeds) return [];
    const asc = [...deeds].reverse();
    return asc.map((d, i) => ({ ...d, n: i + 1 })).reverse();
  }, [deeds]);

  function lineFor(d: ApiDeed): string {
    return d.kind === "stuck" ? t.sawStuck : d.kind === "stayed" ? t.sawStayed : t.sawDid;
  }

  function dateLabel(d: ApiDeed): string {
    const iso = d.localDate ?? d.createdAt?.slice(0, 10);
    if (!iso) return "";
    const [y, m, day] = iso.split("-").map(Number);
    const date = new Date(Date.UTC(y, (m ?? 1) - 1, day ?? 1));
    return date.toLocaleDateString(lang === "fa" ? "fa-IR" : "en-US", { month: "long", day: "numeric", timeZone: "UTC" });
  }

  async function send(d: ApiDeed & { n: number }) {
    if (sending) return;
    setSending(d.id);
    try {
      const blob = await renderCard({
        line: lineFor(d),
        deed: d.text,
        count: d.n > 1 ? t.nthTime(d.n) : null,
        pictureUrl: home?.sketch.colorUrl ?? null,
        lang,
        dateLabel: dateLabel(d),
      });
      const how = await shareCard(blob, `${lineFor(d)}${d.text ? ` — ${d.text}` : ""}`);
      if (how !== "cancelled") {
        setSent(d.id);
        setTimeout(() => setSent(null), 2200);
      }
    } finally {
      setSending(null);
    }
  }

  return (
    <Shell lang={lang} setLang={setLang} dir={dir}>
      <h1 className="font-serif text-[2.2rem] leading-tight text-wish-ink mb-8 text-balance">{t.notebookTitle}</h1>

      {deeds && deeds.length === 0 && (
        <p className="font-serif text-[19px] text-wish-muted leading-relaxed">{t.notebookEmpty}</p>
      )}

      <ol className="space-y-10">
        {numbered.map((d) => (
          <li key={d.id} className="animate-rise-line">
            <WitnessLine line={lineFor(d)} deed={d.text} size="sm" />
            <div className="mt-2 flex items-baseline justify-between gap-4">
              <p className="font-serif text-[15px] text-wish-muted">
                {d.n > 1 ? t.nthTime(d.n) : dateLabel(d)}
              </p>
              <Secondary onClick={() => send(d)} disabled={!!sending} className="!px-0">
                {sent === d.id ? t.shared : sending === d.id ? "…" : t.share}
              </Secondary>
            </div>
          </li>
        ))}
      </ol>
    </Shell>
  );
}
