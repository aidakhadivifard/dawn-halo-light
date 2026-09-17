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
import { getHome, listWishes, type Home, type WishListItem } from "@/lib/vow";
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
  const [wishes, setWishes] = useState<WishListItem[]>([]);
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    api.listDeeds().then((r) => setDeeds(r.deeds)).catch(() => setDeeds([]));
    getHome().then(setHome).catch(() => {});
    listWishes().then((r) => setWishes(r.wishes)).catch(() => {});
  }, []);

  /**
   * The book, newest first. Two kinds of entry: her days (numbered, because he
   * counts them), and — once per wish — the day it took a shape. That one is
   * the first thing he ever writes, so a person who has never answered a day
   * still opens the book and finds a line in it, and knows what the book is.
   */
  type Entry =
    | (ApiDeed & { kind2: "deed"; n: number; at: string })
    | { kind2: "shape"; id: string; text: string; at: string };

  const entries = useMemo<Entry[]>(() => {
    if (!deeds) return [];
    const asc = [...deeds].reverse();
    const days: Entry[] = asc.map((d, i) => ({
      ...d,
      kind2: "deed" as const,
      n: i + 1,
      at: d.createdAt ?? `${d.localDate ?? ""}T00:00:00Z`,
    }));
    const shapes: Entry[] = wishes
      .filter((w) => w.card && w.cardAt)
      .map((w) => ({ kind2: "shape" as const, id: `shape-${w.id}`, text: w.text, at: w.cardAt as string }));
    return [...days, ...shapes].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  }, [deeds, wishes]);

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

      {deeds && entries.length === 0 && (
        <p className="font-serif text-[19px] text-wish-muted leading-relaxed">{t.notebookEmpty}</p>
      )}

      <ol className="space-y-10">
        {entries.map((e) =>
          e.kind2 === "shape" ? (
            <li key={e.id} className="animate-rise-line">
              <WitnessLine line={t.sawShape} deed={e.text} size="sm" />
              <p className="mt-2 font-serif text-[15px] text-wish-muted">{dateLabel({ createdAt: e.at } as ApiDeed)}</p>
            </li>
          ) : (
            <li key={e.id} className="animate-rise-line">
              <WitnessLine line={lineFor(e)} deed={e.text} size="sm" />
              <div className="mt-2 flex items-baseline justify-between gap-4">
                <p className="font-serif text-[15px] text-wish-muted">{e.n > 1 ? t.nthTime(e.n) : dateLabel(e)}</p>
                <Secondary onClick={() => send(e)} disabled={!!sending} className="!px-0">
                  {sent === e.id ? t.shared : sending === e.id ? "…" : t.share}
                </Secondary>
              </div>
            </li>
          ),
        )}
      </ol>
    </Shell>
  );
}
