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
// Dawn ivory, deep-plum ink, one living coral, one oracle gold. Nothing else.

import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { WishPicture } from "@/components/WishPicture";
import { WitnessLine } from "@/components/WitnessLine";
import { Shell, Primary, Secondary, Choice } from "@/components/WishShell";
import { useLang } from "@/hooks/useLang";
import {
  getHome,
  listWishes,
  openWish,
  beginWish,
  setHorizon,
  hearWish,
  requestSketch,
  drawRoadCard,
  recordDeed,
  nextTinyStep,
  type Home,
  type WishListItem,
} from "@/lib/vow";
import { dict, cardText, CARD_GLYPH } from "@/lib/i18n";
import type { HeardWish } from "@/lib/api";

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
type Stage = "loading" | "wishes" | "wish" | "hearing" | "picture" | "confirm" | "revealing" | "card" | "day";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function WishPage() {
  const { lang, setLang, dir } = useLang();
  const [home, setHome] = useState<Home | null>(null);
  // The coral button opens the three doors. Until then, the day is only the picture.
  const [asking, setAsking] = useState(false);
  const [stage, setStage] = useState<Stage>("loading");
  const [text, setText] = useState("");
  // What the app heard: the distinct wishes inside what she wrote. More than
  // one means she chooses which gets the card — the rest are kept, not dropped.
  const [heard, setHeard] = useState<HeardWish[] | null>(null);
  // The flowing sentence only gets said when the app could really phrase it.
  // Split on punctuation alone, it says the count and lets her lines speak.
  const [heardPolished, setHeardPolished] = useState(false);
  // "Not now" puts the offer away without taking anything from her: the
  // picture stays, her words stay editable, and the Oracle waits.
  const [notNow, setNotNow] = useState(false);
  // Every wish she keeps. The app opens here once there is more than one.
  const [wishes, setWishes] = useState<WishListItem[] | null>(null);
  // True while she is writing a wish that is ADDED, not one that replaces the
  // words of the wish already open.
  const [beginning, setBeginning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [crisis, setCrisis] = useState<{ message: string; resources: { label: string; detail: string }[] } | null>(null);
  const [badgeLanding, setBadgeLanding] = useState(false);
  const [deedKind, setDeedKind] = useState<"did" | "stayed" | null>(null);
  const [deedText, setDeedText] = useState("");
  const [justAnswered, setJustAnswered] = useState(false);
  const [witness, setWitness] = useState<string | null>(null);
  // Once she has touched the draft, it is hers — we never rewrite it under her.
  const [witnessEdited, setWitnessEdited] = useState(false);
  const [witnessSeed, setWitnessSeed] = useState<string | null>(null);
  // The ladder of tiny steps. Null means it was never opened — which is always
  // the case after "I endured": that answer is never followed by an ask.
  const [ladder, setLadder] = useState<{
    state: "offer" | "thinking" | "step" | "closed";
    text?: string;
    rung: number;
    /** Opened from "I did nothing, and it bothers me" — a gentler first screen. */
    stuck?: boolean;
  } | null>(null);

  const t = dict(lang);

  // Switching language rewrites the draft message — unless she has already
  // made it her own, in which case her words stay exactly as she left them.
  useEffect(() => {
    if (witness === null || witnessEdited || !witnessSeed) return;
    setWitness(dict(lang).witnessMessage(witnessSeed));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  /** The screen for whichever wish is open. */
  const load = useCallback(async () => {
    const h = await getHome();
    setHome(h);
    setNotNow(false);
    setStage(!h.horizon ? "wish" : h.card ? "day" : "picture");
    return h;
  }, []);

  /**
   * Opening the app shows her wishes, not one of them. Some have had their
   * card drawn, some are still waiting; the road is the same for each.
   * One wish and nothing else is not a list worth showing, so it opens
   * straight into that wish.
   */
  const loadWishes = useCallback(async () => {
    const { wishes: list } = await listWishes();
    setWishes(list);
    if (list.length > 1) {
      setStage("wishes");
      return list;
    }
    await load();
    return list;
  }, [load]);

  async function open(id: string) {
    if (busy) return;
    setBusy(true);
    await openWish(id);
    setBusy(false);
    await load();
  }

  useEffect(() => {
    void loadWishes();
  }, [loadWishes]);

  // While the picture is being drawn, keep looking — it arrives on its own.
  useEffect(() => {
    if (home?.sketch.status !== "pending") return;
    const id = setInterval(() => {
      void getHome().then(setHome);
    }, 4000);
    return () => clearInterval(id);
  }, [home?.sketch.status]);

  /**
   * Listen first. People write five wishes in one breath, and treating that as
   * a single wish is how the app stops feeling like it heard them. One wish
   * goes straight through — in her exact words, untouched.
   */
  async function saveWish() {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const res = await hearWish(trimmed, lang);
    setBusy(false);
    if (res.kind === "crisis") return setCrisis(res);
    if (res.wishes.length <= 1) return commitWish(trimmed, []);
    setHeard(res.wishes);
    setHeardPolished(res.polished);
    setStage("hearing");
  }

  /** One wish becomes the live one; the others go on the shelf. */
  async function commitWish(wish: string, park: string[]) {
    if (busy) return;
    setBusy(true);
    const res = beginning ? await beginWish(wish, park) : await setHorizon(wish, park, lang);
    setBusy(false);
    if (res.kind === "crisis") return setCrisis(res);
    setText("");
    setHeard(null);
    setBeginning(false);
    await requestSketch();
    await load();
    const { wishes: list } = await listWishes();
    setWishes(list);
  }

  async function draw() {
    if (busy) return;
    setBusy(true);
    setStage("revealing");
    const [card] = await Promise.all([drawRoadCard(), sleep(2600)]);
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

  async function answer(kind: "did" | "stayed" | "stuck") {
    if (kind === "did") return setDeedKind("did");
    await save(kind, null);
  }

  async function save(kind: "did" | "stayed" | "stuck", body: string | null) {
    if (busy) return;
    setBusy(true);
    const res = await recordDeed(kind, body);
    setBusy(false);
    if (res.kind === "crisis") return setCrisis(res);
    if (res.kind === "error") return;
    setDeedKind(null);
    setDeedText("");
    setAsking(false);
    setJustAnswered(true);
    const h = await load();
    // The ladder opens for the two answers that reach for something: "I did one
    // small thing", and "I did nothing, and it bothers me" — the second being
    // the one this technique was actually built for. After "I endured and kept
    // going" we ask for nothing at all; that answer is already complete.
    if (kind === "did" || kind === "stuck") setLadder({ state: "offer", rung: 0, stuck: kind === "stuck" });
    // The witness is offered now and then — never every day, never nagging.
    const deed = kind === "did" ? (body ?? "").trim() : null;
    if (Math.random() < 0.34) {
      setWitnessSeed(deed ?? shorten(h.horizon));
      setWitnessEdited(false);
      setWitness(t.witnessMessage(deed ?? shorten(h.horizon)));
    }
  }

  /** Ask for the next rung. No step to offer means the ladder simply ends. */
  async function askStep(rung: number, stuck?: boolean) {
    setLadder({ state: "thinking", rung, stuck });
    const step = await nextTinyStep();
    setLadder(step ? { state: "step", text: step, rung, stuck } : { state: "closed", rung, stuck });
  }

  /** A finished step is an ordinary deed — so it brings color like any other. */
  async function stepDone(text: string, rung: number) {
    if (busy) return;
    setBusy(true);
    await recordDeed("did", text);
    setBusy(false);
    await load();
    setLadder((l) => ({ state: "offer", rung: rung + 1, stuck: l?.stuck }));
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
      <Shell lang={lang} setLang={setLang} dir={dir}>
        <h1 className="font-serif text-3xl text-wish-ink mb-4">{t.crisisTitle}</h1>
        <p className="text-wish-ink/80 leading-relaxed mb-6">{crisis.message}</p>
        <ul className="space-y-3 mb-8">
          {crisis.resources.map((r) => (
            <li key={r.label} className="border-b border-wish-line pb-3">
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
    <Shell lang={lang} setLang={setLang} dir={dir}>
      {/* 0 — her wishes. Some have been asked about, some are still waiting. */}
      {stage === "wishes" && wishes && (
        <div className="animate-rise-line">
          <h1 className="font-serif text-[2.2rem] leading-tight text-wish-ink mb-7">{t.yourWishes}</h1>
          <ul>
            {wishes.map((w) => (
              <li key={w.id}>
                <button
                  onClick={() => open(w.id)}
                  disabled={busy}
                  className="w-full text-start py-5 border-b border-wish-line disabled:opacity-40"
                >
                  <div className="flex items-baseline gap-3">
                    {/* A drawn card, or the empty circle of one not yet asked for. */}
                    <span aria-hidden className="w-6 shrink-0 text-[20px] leading-none text-wish-gold">
                      {w.card ? (CARD_GLYPH[w.card.id] ?? "✦") : "○"}
                    </span>
                    <span className="font-serif text-[21px] leading-snug text-wish-ink">{w.text}</span>
                  </div>
                  <p className="mt-1 ms-9 text-[14px] text-wish-muted">
                    {w.card ? cardText(lang, w.card.id).name : t.noCardYet}
                    {w.days > 0 && ` · ${t.daysCount(w.days)}`}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          <Secondary
            onClick={() => {
              setBeginning(true);
              setText("");
              setHeard(null);
              setStage("wish");
            }}
            className="mt-8 w-full"
          >
            {t.anotherWish}
          </Secondary>
        </div>
      )}

      {/* Back to the others, whenever there is more than one. */}
      {wishes && wishes.length > 1 && stage !== "wishes" && stage !== "revealing" && stage !== "card" && (
        <button
          onClick={() => {
            setBeginning(false);
            void loadWishes().then(() => setStage("wishes"));
          }}
          className="mb-6 text-[14px] text-wish-muted underline underline-offset-4"
        >
          <span aria-hidden className="inline-block rtl:rotate-180">←</span> {t.backToWishes}
        </button>
      )}

      {/* 1 — the wish, in their own words */}
      {(stage === "wish" || stage === "loading") && (
        <div className="animate-rise-line">
          <h1 className="font-serif text-[2.4rem] leading-tight text-wish-ink mb-2 text-balance">{t.wishAsk}</h1>
          <p className="font-serif text-[17px] text-wish-muted mb-8">{t.wishHint}</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.wishPlaceholder}
            rows={5}
            className="w-full rounded-2xl border border-wish-ink/20 bg-transparent px-4 py-4 font-serif text-[20px] text-wish-ink
                       placeholder:text-wish-muted/60 outline-none focus:border-wish-ink/60 transition-colors resize-none"
          />
          <Primary onClick={saveWish} disabled={!text.trim() || busy} className="mt-5 w-full">
            {t.wishSave}
          </Primary>
        </div>
      )}

      {/* 1b — what was heard. Five wishes are five wishes; she picks the one
           that gets the card, and the app says out loud that it kept the rest. */}
      {stage === "hearing" && heard && (
        <div className="animate-rise-line">
          <p className="font-hand text-[27px] leading-snug text-wish-ink text-balance">
            {heardPolished ? t.heardMany(heard.map((w) => w.echo)) : t.heardCount(heard.length)}
          </p>
          <p className="mt-7 font-serif text-[21px] leading-snug text-wish-ink text-balance">
            {t.whichFirst(heard.length)}
          </p>
          <div className="mt-5 space-y-3">
            {heard.map((w) => (
              <Choice
                key={w.label}
                disabled={busy}
                onClick={() =>
                  commitWish(
                    w.label,
                    heard.filter((o) => o.label !== w.label).map((o) => o.label),
                  )
                }
              >
                {w.label}
              </Choice>
            ))}
          </div>
          <p className="mt-6 font-serif text-[16px] text-wish-muted leading-relaxed">{t.nothingLost}</p>
          <button
            onClick={() => {
              setHeard(null);
              setStage("wish");
            }}
            className="mt-6 w-full text-[14px] text-wish-muted underline underline-offset-4"
          >
            {t.wishEdit}
          </button>
        </div>
      )}

      {/* 2 & 3 — the picture, and the offer of the card */}
      {home?.horizon && (stage === "picture" || stage === "confirm") && (
        <div className="animate-rise-line">
          <WishPicture sketch={home.sketch} words={home.horizon} lang={lang} card={null} />

          {stage === "picture" && !notNow && (
            <>
              <p className="mt-8 text-center font-hand text-[25px] text-wish-muted leading-snug">
                {t.wishTookShape}
              </p>
              <p className="mt-2 text-center font-serif text-[25px] text-wish-ink leading-snug text-balance">
                {t.cardAsk}
              </p>
              <Primary onClick={() => setStage("confirm")} className="mt-6 w-full">
                {t.cardDraw}
              </Primary>
              <button
                onClick={() => setNotNow(true)}
                className="mt-3 w-full text-[14px] text-wish-muted underline underline-offset-4"
              >
                {t.notNow}
              </button>
            </>
          )}

          {/* Put away, not taken away: the picture is hers to sit with, and
              until the card is drawn her words are still hers to change. */}
          {stage === "picture" && notNow && (
            <div className="mt-10 flex items-center justify-center gap-6 animate-rise-line">
              <button
                onClick={() => {
                  setText(home.horizon ?? "");
                  setStage("wish");
                }}
                className="text-[14px] text-wish-muted underline underline-offset-4"
              >
                {t.wishEdit}
              </button>
              <button
                onClick={() => setNotNow(false)}
                className="text-[14px] text-wish-blue underline underline-offset-4"
              >
                {t.askOracle}
              </button>
            </div>
          )}

          {stage === "confirm" && (
            <div className="mt-8 animate-rise-line">
              <p className="font-serif text-[19px] text-wish-ink leading-snug text-balance">{t.cardWarn}</p>
              <p className="mt-2 font-serif text-[16px] text-wish-muted leading-relaxed mb-5">{t.cardWarnCalm}</p>
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
      {/* The draw. Long enough to be a pause you take before you look — the
          beat between making a wish and seeing what was answered. Nothing is
          written here on purpose; the waiting is the whole content. */}
      {stage === "revealing" && (
        <div className="min-h-[60vh] flex items-center justify-center" aria-live="polite" aria-label={t.cardDraw}>
          <div className="relative grid place-items-center">
            <div
              aria-hidden
              className="w-40 h-40 rounded-full blur-3xl animate-[gather_2600ms_ease-in-out_both]"
              style={{ background: "radial-gradient(circle, rgba(217,164,65,0.6) 0%, transparent 70%)" }}
            />
            {/* Two rings leaving the light, a beat apart. */}
            <span
              aria-hidden
              className="absolute size-24 rounded-full border border-wish-gold/60 animate-[ripple_2600ms_ease-out_both]"
            />
            <span
              aria-hidden
              className="absolute size-24 rounded-full border border-wish-gold/40 animate-[ripple_2600ms_ease-out_600ms_both]"
            />
            <span
              aria-hidden
              className="absolute size-2 rounded-full bg-wish-gold animate-[spark_2600ms_ease-in-out_both]"
            />
          </div>
        </div>
      )}

      {/* 4 — the card */}
      {stage === "card" && home?.card && (
        <div className="min-h-[70vh] flex flex-col items-center justify-center text-center">
          <div className="animate-card-turn px-8 py-12 w-full max-w-xs">
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
          {home.todayDeed && (
            <h1 className="font-serif text-[2.4rem] leading-none text-wish-ink text-center mb-6 text-balance">{t.aliveLine}</h1>
          )}
          <WishPicture
            sketch={home.sketch}
            words={home.horizon}
            lang={lang}
            card={home.card}
            badgeLanding={badgeLanding}
          />

          {home.todayDeed && !deedKind ? (
            <div className="mt-6">
              {/* The witness's line, in his own hand, with the gold stroke of his pen
                  running out from under it. Acknowledgment sits above the offer, never below. */}
              <WitnessLine
                line={home.todayDeed.kind === "stuck" ? t.sawStuck : home.todayDeed.kind === "stayed" ? t.sawStayed : t.sawDid}
                deed={home.todayDeed.text}
              />
            </div>
          ) : !asking && !deedKind ? (
            <div className="mt-10">
              <Primary onClick={() => setAsking(true)} className="w-full">
                {t.tellToday}
              </Primary>
            </div>
          ) : (
            <div className="mt-10 animate-rise-line">
              <p className="font-serif text-[26px] text-wish-ink leading-snug mb-1 text-center text-balance">{t.todayAsk}</p>
              <p className="font-serif text-[15px] text-wish-muted mb-6 text-center">{t.bothCount}</p>

              {deedKind === "did" ? (
                <div className="animate-rise-line">
                  <p className="font-serif text-[18px] text-wish-ink mb-3 text-center">{t.todayWhat}</p>
                  <textarea
                    value={deedText}
                    onChange={(e) => setDeedText(e.target.value)}
                    placeholder={t.todayPlaceholder}
                    rows={3}
                    autoFocus
                    className="w-full rounded-2xl border border-wish-ink/20 bg-transparent px-4 py-3 font-serif text-[19px] text-wish-ink
                               placeholder:text-wish-muted/60 outline-none focus:border-wish-ink/60 transition-colors resize-none"
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
                // Three doors, identical on purpose. None of them is the good
                // one; none of them is the bad one. Whichever she opens, she
                // came — and that is the only thing this app counts.
                <div className="space-y-3">
                  <Choice onClick={() => answer("stayed")} disabled={busy}>
                    {t.todayStayed}
                  </Choice>
                  <Choice onClick={() => answer("did")} disabled={busy}>
                    {t.todayDid}
                  </Choice>
                  <Choice onClick={() => answer("stuck")} disabled={busy}>
                    {t.todayStuck}
                  </Choice>
                </div>
              )}
            </div>
          )}

          {/* 5b — one more, smaller. Never after "I endured". */}
          {ladder && ladder.state !== "closed" && (
            <div className="mt-10 text-center animate-rise-line">
              {ladder.state === "offer" && (
                <>
                  {/* Acknowledgment first, always. A task handed to someone who
                      just said they're unhappy would say: your sadness is a
                      productivity problem. It isn't. */}
                  <p className="font-serif text-[24px] text-wish-ink leading-snug mb-5 text-balance">
                    {ladder.rung > 0 ? t.stepMore : ladder.stuck ? t.stuckOffer : t.stepOffer}
                  </p>
                  <Primary onClick={() => askStep(ladder.rung, ladder.stuck)} className="w-full">
                    {t.stepYes}
                  </Primary>
                  <Secondary onClick={() => setLadder({ ...ladder, state: "closed" })} className="mt-2 w-full">
                    {ladder.rung > 0 ? t.stepEnough : ladder.stuck ? t.stuckNo : t.stepNo}
                  </Secondary>
                </>
              )}

              {ladder.state === "thinking" && (
                <p className="text-[15px] text-wish-muted text-center py-2">{t.stepThinking}</p>
              )}

              {ladder.state === "step" && (
                <>
                  <p className="font-serif text-[28px] text-wish-ink leading-snug mb-6 text-balance">
                    {ladder.text}
                  </p>
                  <Primary
                    onClick={() => stepDone(ladder.text!, ladder.rung)}
                    disabled={busy}
                    className="w-full"
                  >
                    {t.stepDid}
                  </Primary>
                  <Secondary onClick={() => setLadder({ ...ladder, state: "closed" })} className="mt-2 w-full">
                    {t.stepEnough}
                  </Secondary>
                </>
              )}
            </div>
          )}

          {ladder?.state === "closed" && ladder.rung > 0 && (
            <p className="mt-6 text-center font-serif text-xl text-wish-ink/75 animate-rise-line">
              {t.stepClosed}
            </p>
          )}

          {/* 6 — the witness */}
          {witness !== null && (!ladder || ladder.state === "closed") && (
            <div className="mt-10 animate-rise-line">
              <p className="font-serif text-xl text-wish-ink mb-1">{t.witnessAsk}</p>
              <p className="text-[13px] text-wish-muted mb-4">{t.witnessEdit}</p>
              <textarea
                value={witness}
                onChange={(e) => {
                  setWitnessEdited(true);
                  setWitness(e.target.value);
                }}
                rows={3}
                className="w-full rounded-2xl border border-wish-ink/20 bg-transparent px-4 py-3 font-serif text-[18px] text-wish-ink
                           outline-none focus:border-wish-ink/60 transition-colors resize-none"
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
