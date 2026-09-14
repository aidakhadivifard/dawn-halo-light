// The wish.
//
// The whole product in one screen, in order:
//   1. What do you wish for?            — their own words, nothing invented
//   2. The wish becomes a picture        — colorless, drawn from those words
//   3. Want to draw a card?              — drawing it SEALS the words forever
//   4. The card, then its badge landing on the picture
//   5. Every day: what did you do today? — "I kept going" counts the same as
//      "I did one small thing", and both bring a little color back
//   6. Sometimes: would you like someone to see this?
//
// White and blue. One accent, one gold mark. Nothing else on the screen.

import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { WishPicture } from "@/components/WishPicture";
import { getHome, setHorizon, requestSketch, drawRoadCard, recordDeed, type Home } from "@/lib/vow";
import { dict, dirOf, initialLang, saveLang, cardText, CARD_GLYPH, LANGS, type Lang } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Your wish — Dawnhalo" },
      { name: "description", content: "Write your wish. Watch it take color, one day at a time." },
    ],
  }),
  component: WishPage,
});

/** Where in the ritual we are. Everything else is derived from the server. */
type Stage = "loading" | "wish" | "picture" | "confirm" | "revealing" | "card" | "day";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function WishPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [home, setHome] = useState<Home | null>(null);
  const [stage, setStage] = useState<Stage>("loading");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [crisis, setCrisis] = useState<{ message: string; resources: { label: string; detail: string }[] } | null>(null);
  const [badgeLanding, setBadgeLanding] = useState(false);
  const [deedKind, setDeedKind] = useState<"did" | "stayed" | null>(null);
  const [deedText, setDeedText] = useState("");
  const [justAnswered, setJustAnswered] = useState(false);
  const [witness, setWitness] = useState<string | null>(null);

  const t = dict(lang);
  const dir = dirOf(lang);

  useEffect(() => setLang(initialLang()), []);
  useEffect(() => {
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", lang);
  }, [dir, lang]);

  const load = useCallback(async () => {
    const h = await getHome();
    setHome(h);
    setStage(!h.horizon ? "wish" : h.card ? "day" : "picture");
    return h;
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // While the picture is being drawn, keep looking — it arrives on its own.
  useEffect(() => {
    if (home?.sketch.status !== "pending") return;
    const id = setInterval(() => {
      void getHome().then(setHome);
    }, 4000);
    return () => clearInterval(id);
  }, [home?.sketch.status]);

  async function saveWish() {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const res = await setHorizon(trimmed);
    setBusy(false);
    if (res.kind === "crisis") return setCrisis(res);
    setText("");
    await requestSketch();
    await load();
  }

  async function draw() {
    if (busy) return;
    setBusy(true);
    setStage("revealing");
    const [card] = await Promise.all([drawRoadCard(), sleep(1600)]);
    setBusy(false);
    if (!card) return setStage("picture");
    await load();
    setStage("card");
  }

  /** From the card to the picture: the badge flies down and settles. */
  async function keepCard() {
    setBadgeLanding(true);
    setStage("day");
    await sleep(1200);
    setBadgeLanding(false);
  }

  async function answer(kind: "did" | "stayed") {
    if (kind === "did") return setDeedKind("did");
    await save("stayed", null);
  }

  async function save(kind: "did" | "stayed", body: string | null) {
    if (busy) return;
    setBusy(true);
    const res = await recordDeed(kind, body);
    setBusy(false);
    if (res.kind === "crisis") return setCrisis(res);
    if (res.kind === "error") return;
    setDeedKind(null);
    setDeedText("");
    setJustAnswered(true);
    const h = await load();
    // The witness is offered now and then — never every day, never nagging.
    const deed = kind === "did" ? (body ?? "").trim() : null;
    if (Math.random() < 0.34) setWitness(t.witnessMessage(deed ?? shorten(h.horizon)));
  }

  function shorten(s: string | null): string {
    return (s ?? "").split(/[.،,\n]/)[0].trim().slice(0, 60) || "kept going";
  }

  async function share(message: string) {
    try {
      if (navigator.share) await navigator.share({ text: message });
      else await navigator.clipboard?.writeText(message);
    } catch {
      /* the person changed their mind — that's fine */
    }
    setWitness(null);
  }

  if (crisis) {
    return (
      <Shell lang={lang} setLang={pick(setLang)} dir={dir}>
        <h1 className="font-serif text-3xl text-wish-ink mb-4">{t.crisisTitle}</h1>
        <p className="text-wish-ink/80 leading-relaxed mb-6">{crisis.message}</p>
        <ul className="space-y-3 mb-8">
          {crisis.resources.map((r) => (
            <li key={r.label} className="rounded-2xl border border-wish-line bg-wish-tint px-4 py-3">
              <p className="font-medium text-wish-ink">{r.label}</p>
              <p className="text-sm text-wish-muted">{r.detail}</p>
            </li>
          ))}
        </ul>
        <Secondary onClick={() => setCrisis(null)}>{t.back}</Secondary>
      </Shell>
    );
  }

  return (
    <Shell lang={lang} setLang={pick(setLang)} dir={dir}>
      {/* 1 — the wish, in their own words */}
      {(stage === "wish" || stage === "loading") && (
        <div className="animate-rise-line">
          <h1 className="font-serif text-[2.1rem] leading-tight text-wish-ink mb-2">{t.wishAsk}</h1>
          <p className="text-[15px] text-wish-muted mb-7">{t.wishHint}</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.wishPlaceholder}
            rows={5}
            className="w-full rounded-2xl border border-wish-line bg-wish-paper px-4 py-4 text-[17px] text-wish-ink
                       placeholder:text-wish-muted/60 outline-none focus:border-wish-blue/60 transition-colors resize-none"
          />
          <Primary onClick={saveWish} disabled={!text.trim() || busy} className="mt-5 w-full">
            {t.wishSave}
          </Primary>
        </div>
      )}

      {/* 2 & 3 — the picture, and the offer of the card */}
      {home?.horizon && (stage === "picture" || stage === "confirm") && (
        <div className="animate-rise-line">
          <WishPicture sketch={home.sketch} words={home.horizon} lang={lang} card={null} />

          {stage === "picture" && (
            <>
              <p className="mt-6 text-center font-serif text-2xl text-wish-ink leading-snug">{t.cardAsk}</p>
              <Primary onClick={() => setStage("confirm")} className="mt-5 w-full">
                {t.cardDraw}
              </Primary>
              <button
                onClick={() => {
                  setText(home.horizon ?? "");
                  setStage("wish");
                }}
                className="mt-3 w-full text-[14px] text-wish-muted underline underline-offset-4"
              >
                {t.wishEdit}
              </button>
            </>
          )}

          {stage === "confirm" && (
            <div className="mt-6 rounded-2xl border border-wish-blue/25 bg-wish-tint px-5 py-5 animate-rise-line">
              <p className="text-[15px] text-wish-ink leading-relaxed mb-5">{t.cardWarn}</p>
              <Primary onClick={draw} disabled={busy} className="w-full">
                {t.cardDraw}
              </Primary>
              <Secondary onClick={() => setStage("picture")} className="mt-3 w-full">
                {t.back}
              </Secondary>
            </div>
          )}
        </div>
      )}

      {/* the draw itself */}
      {stage === "revealing" && (
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
          <div
            aria-hidden
            className="w-28 h-28 rounded-full blur-3xl animate-halo-breathe"
            style={{ background: "radial-gradient(circle, rgba(201,162,74,0.55) 0%, transparent 70%)" }}
          />
        </div>
      )}

      {/* 4 — the card */}
      {stage === "card" && home?.card && (
        <div className="min-h-[70vh] flex flex-col items-center justify-center text-center">
          <div className="animate-card-turn rounded-3xl border border-wish-line bg-wish-paper px-8 py-12 w-full max-w-xs shadow-[0_30px_70px_-45px_rgba(23,35,59,0.5)]">
            <div className="text-5xl text-wish-gold leading-none mb-5">{CARD_GLYPH[home.card.id] ?? "✦"}</div>
            <p className="font-serif text-3xl text-wish-ink mb-4">{cardText(lang, home.card.id).name}</p>
            <p className="text-[17px] text-wish-ink/80 leading-relaxed">{cardText(lang, home.card.id).line}</p>
          </div>
          <p className="mt-6 text-[13px] text-wish-muted max-w-xs animate-rise-line">{t.cardAll}</p>
          <Primary onClick={keepCard} className="mt-6 w-full max-w-xs">
            {t.cardKeep}
          </Primary>
        </div>
      )}

      {/* 5 — the day */}
      {stage === "day" && home && (
        <div className="animate-rise-line">
          <WishPicture
            sketch={home.sketch}
            words={home.horizon}
            lang={lang}
            card={home.card}
            badgeLanding={badgeLanding}
          />
          <p className="mt-4 text-center font-serif text-xl text-wish-ink/80 leading-snug">{home.horizon}</p>

          {home.todayDeed && !deedKind ? (
            <div className="mt-8 rounded-2xl border border-wish-line bg-wish-tint px-5 py-5 text-center">
              <p className="font-serif text-xl text-wish-ink">{justAnswered ? t.todayDone : t.todayAlready}</p>
              {home.todayDeed.text && <p className="mt-2 text-[15px] text-wish-muted">{home.todayDeed.text}</p>}
            </div>
          ) : (
            <div className="mt-8">
              <p className="font-serif text-2xl text-wish-ink leading-snug mb-1">{t.todayAsk}</p>
              <p className="text-[13px] text-wish-muted mb-5">{t.bothCount}</p>

              {deedKind === "did" ? (
                <div className="animate-rise-line">
                  <p className="text-[15px] text-wish-ink mb-3">{t.todayWhat}</p>
                  <textarea
                    value={deedText}
                    onChange={(e) => setDeedText(e.target.value)}
                    placeholder={t.todayPlaceholder}
                    rows={3}
                    className="w-full rounded-2xl border border-wish-line bg-wish-paper px-4 py-3 text-[16px] text-wish-ink
                               placeholder:text-wish-muted/60 outline-none focus:border-wish-blue/60 transition-colors resize-none"
                  />
                  <Primary
                    onClick={() => save("did", deedText)}
                    disabled={!deedText.trim() || busy}
                    className="mt-4 w-full"
                  >
                    {t.todaySave}
                  </Primary>
                </div>
              ) : (
                <div className="space-y-3">
                  <Choice onClick={() => answer("stayed")} disabled={busy}>
                    {t.todayStayed}
                  </Choice>
                  <Choice onClick={() => answer("did")} disabled={busy}>
                    {t.todayDid}
                  </Choice>
                </div>
              )}
            </div>
          )}

          {/* 6 — the witness */}
          {witness !== null && (
            <div className="mt-8 rounded-2xl border border-wish-blue/25 bg-wish-tint px-5 py-5 animate-rise-line">
              <p className="font-serif text-xl text-wish-ink mb-1">{t.witnessAsk}</p>
              <p className="text-[13px] text-wish-muted mb-4">{t.witnessEdit}</p>
              <textarea
                value={witness}
                onChange={(e) => setWitness(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-wish-line bg-wish-paper px-4 py-3 text-[15px] text-wish-ink
                           outline-none focus:border-wish-blue/60 transition-colors resize-none"
              />
              <Primary onClick={() => share(witness)} className="mt-4 w-full">
                {t.witnessSendNow}
              </Primary>
              <Secondary onClick={() => setWitness(null)} className="mt-3 w-full">
                {t.witnessNo}
              </Secondary>
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}

/** Setting the language is one line; this keeps it out of the markup. */
function pick(setLang: (l: Lang) => void) {
  return (l: Lang) => {
    setLang(l);
    saveLang(l);
  };
}

function Shell({
  children,
  lang,
  setLang,
  dir,
}: {
  children: React.ReactNode;
  lang: Lang;
  setLang: (l: Lang) => void;
  dir: "ltr" | "rtl";
}) {
  return (
    <div dir={dir} className="min-h-dvh bg-wish-paper text-wish-ink">
      <header className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
        <span className="text-[13px] tracking-[0.22em] uppercase text-wish-muted">Dawnhalo</span>
        <div className="flex gap-1">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={
                "rounded-full px-3 py-1 text-[13px] transition-colors " +
                (lang === l.code ? "bg-wish-blue text-white" : "text-wish-muted hover:text-wish-ink")
              }
            >
              {l.label}
            </button>
          ))}
        </div>
      </header>
      <main className="mx-auto max-w-md px-5 pt-4 pb-32">{children}</main>
      <BottomNav />
    </div>
  );
}

function Primary({
  children,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={
        "rounded-full bg-wish-blue px-6 py-3.5 text-[16px] font-medium text-white transition-all " +
        "active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 " +
        "shadow-[0_12px_30px_-14px_rgba(47,107,255,0.9)] " +
        className
      }
    >
      {children}
    </button>
  );
}

function Secondary({ children, className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={"rounded-full px-6 py-3 text-[15px] text-wish-muted transition-colors hover:text-wish-ink " + className}
    >
      {children}
    </button>
  );
}

/** The two answers. They look identical on purpose: neither is the better one. */
function Choice({ children, className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={
        "w-full rounded-2xl border border-wish-line bg-wish-paper px-5 py-4 text-start text-[16px] text-wish-ink " +
        "transition-colors hover:border-wish-blue/50 active:scale-[0.99] disabled:opacity-40 " +
        className
      }
    >
      {children}
    </button>
  );
}
