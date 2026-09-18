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
import { useCallback, useEffect, useRef, useState } from "react";
import { WishPicture } from "@/components/WishPicture";
import { RoadCardObject, type CardPhase } from "@/components/RoadCard";
import { OracleLight, type LightMode } from "@/components/OracleLight";
import { CardSymbol } from "@/components/CardSymbol";
import { WitnessLine } from "@/components/WitnessLine";
import { HeardWishes } from "@/components/HeardWishes";
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
  answerStep,
  type Home,
  type WishListItem,
  type TinyStep,
} from "@/lib/vow";
import { dict, cardText } from "@/lib/i18n";
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

/** The light follows the card. */
function lightFor(phase: CardPhase): LightMode {
  if (phase === "summon") return "gather";
  if (phase === "rise" || phase === "hold") return "hold";
  if (phase === "flip") return "flash";
  return "soft";
}

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
  // The last heard wish has been written down; now the question can be asked.
  const [heardWritten, setHeardWritten] = useState(false);
  // The wish she pressed, while the app is making it hers.
  const [chosen, setChosen] = useState<string | null>(null);
  // "Not now" puts the offer away without taking anything from her: the
  // picture stays, her words stay editable, and the Oracle waits.
  const [notNow, setNotNow] = useState(false);
  // Every wish she keeps. The app opens here once there is more than one.
  const [wishes, setWishes] = useState<WishListItem[] | null>(null);
  // True while she is writing a wish that is ADDED, not one that replaces the
  // words of the wish already open.
  const [beginning, setBeginning] = useState(false);
  // The draw, as a sequence: the card rises with its back to us, waits for the
  // Oracle to actually answer, turns over, and is written on.
  const [phase, setPhase] = useState<CardPhase>("summon");
  const [drawn, setDrawn] = useState<{ id: string; name: string; line: string; reading?: string | null } | null>(null);
  const [told, setTold] = useState(false);
  // The card has just been given to the wish. Stays until she acts on it —
  // a sentence that explains what happened should not time out.
  const [justKept, setJustKept] = useState(false);
  // The symbol leaving the card for the corner of the wish.
  const [flight, setFlight] = useState<{ id: string; x: number; y: number; dx: number; dy: number; s: number } | null>(null);
  const symbolRef = useRef<HTMLDivElement | null>(null);
  const slotRef = useRef<HTMLDivElement | null>(null);
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
    state: "offer" | "thinking" | "ask" | "step" | "closed";
    text?: string;
    /** What the app needs to know before it can offer a step. */
    question?: string;
    rung: number;
    /** Opened from "I did nothing, and it bothers me" — a gentler first screen. */
    stuck?: boolean;
  } | null>(null);
  const [answerText, setAnswerText] = useState("");
  // The day screen is a conversation, and it keeps its order: the witness
  // writes his line first; only once his hand has lifted does anything else
  // get to speak.
  const [lineDone, setLineDone] = useState(false);

  const t = dict(lang);

  // Switching language rewrites the draft message — unless she has already
  // made it her own, in which case her words stay exactly as she left them.
  useEffect(() => {
    if (witness === null || witnessEdited || !witnessSeed) return;
    setWitness(dict(lang).witnessMessage(witnessSeed));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  /** The screen for whichever wish is open. */
  const load = useCallback(async (keepStage = false) => {
    const h = await getHome();
    setHome(h);
    // Mid-reveal the screen is the card's, not the server's: refreshing the
    // data must not yank her out of the moment the card is turning over.
    if (keepStage) return h;
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

  // While the picture is being drawn, keep looking — it arrives on its own,
  // and usually within a breath or two, since drawing began the moment the
  // wish was heard.
  useEffect(() => {
    if (home?.sketch.status !== "pending") return;
    const id = setInterval(() => {
      void getHome().then(setHome).catch(() => undefined);
    }, 1500);
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
    setHeardWritten(false);
    setStage("hearing");
  }

  /**
   * One wish becomes the live one; the others go on the shelf.
   *
   * Whatever happens on the way — a slow server, a lost signal — this always
   * ends: the button she pressed is never left grey forever.
   */
  async function commitWish(wish: string, park: string[]) {
    if (busy) return;
    setBusy(true);
    setChosen(wish);
    try {
      const res = beginning ? await beginWish(wish, park) : await setHorizon(wish, park, lang);
      if (res.kind === "crisis") return setCrisis(res);
      setText("");
      setBeginning(false);
      await requestSketch().catch(() => undefined);
      await load();
      setHeard(null);
      const { wishes: list } = await listWishes().catch(() => ({ wishes: wishes ?? [] }));
      setWishes(list);
    } finally {
      setBusy(false);
      setChosen(null);
    }
  }

  /**
   * The draw, in the order it should feel like it happened.
   *
   * The card comes up out of a deck just outside the frame and waits there,
   * face down, until the Oracle has actually answered — so the turn is never a
   * lie. If the answer is quick, it still pauses; if it is slow, the card
   * simply holds a moment longer, which is exactly what a card does.
   */
  async function draw() {
    if (busy) return;
    setBusy(true);
    setDrawn(null);
    setTold(false);
    setFlight(null);
    setPhase("summon");
    setStage("card");
    const started = Date.now();
    // The Oracle is asked the moment the light begins — but the light takes
    // its time whatever the answer does. Nothing here is a spinner.
    const asking = drawRoadCard(lang);
    await sleep(2300);
    setPhase("rise");
    const card = await asking;
    if (!card) {
      setBusy(false);
      return setStage("picture");
    }
    setDrawn(card);
    // The rise, and then a held beat, face down in the light, before it turns.
    await sleep(Math.max(0, 4200 - (Date.now() - started)));
    setPhase("flip");
    await sleep(840);
    setPhase("front");
    // Frame, symbol, title, line — then the reading underneath.
    await sleep(2100);
    setTold(true);
    setBusy(false);
    const h = await load(true);
    // The reading is written while the card turns, so it arrives underneath a
    // beat later — the way a reading reads. If it never comes, the card's own
    // line stands on its own, which was always the point.
    if (!card.reading) void awaitReading(h.card?.reading ?? null);
  }

  async function awaitReading(already: string | null) {
    if (already) return setDrawn((d) => (d ? { ...d, reading: already } : d));
    for (let i = 0; i < 12; i++) {
      await sleep(1400);
      const h = await getHome().catch(() => null);
      const reading = h?.card?.reading ?? null;
      if (reading) return setDrawn((d) => (d ? { ...d, reading } : d));
    }
  }

  /**
   * Keeping it: the symbol lifts out of the card and goes to sit on the corner
   * of the wish. That flight is the whole point of the action — it is what
   * makes the card belong to this wish rather than being a page she read once.
   */
  async function keepCard() {
    if (flight) return;
    setPhase("keeping");
    const from = symbolRef.current?.getBoundingClientRect();
    const to = slotRef.current?.getBoundingClientRect();
    if (from && to && drawn) {
      setFlight({
        id: drawn.id,
        x: from.left,
        y: from.top,
        dx: to.left + to.width / 2 - (from.left + from.width / 2),
        dy: to.top + to.height / 2 - (from.top + from.height / 2),
        s: (to.width * 0.52) / Math.max(1, from.width),
      });
      await sleep(980);
    }
    setBadgeLanding(true);
    setJustKept(true);
    setStage("day");
    setFlight(null);
    await sleep(1200);
    setBadgeLanding(false);
    setTold(false);
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
    setLineDone(false);
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

  /**
   * What came back for the ladder: a step, a question the app needs answered
   * before it will offer one, or nothing — and nothing means the ladder ends.
   */
  function place(out: TinyStep | null, rung: number, stuck?: boolean) {
    if (!out) return setLadder({ state: "closed", rung, stuck });
    if (out.kind === "ask") {
      setAnswerText("");
      return setLadder({ state: "ask", question: out.question, rung, stuck });
    }
    setLadder({ state: "step", text: out.text, rung, stuck });
  }

  /** Ask for the next rung. */
  async function askStep(rung: number, stuck?: boolean) {
    setLadder({ state: "thinking", rung, stuck });
    // The intro line is on screen while the step is found; the step should
    // land under it a beat later, not in the same frame.
    const [out] = await Promise.all([nextTinyStep(), sleep(900)]);
    place(out, rung, stuck);
  }

  /** She said what the thing is — kept with the wish, and then the step. */
  async function answerAsk(question: string, rung: number, stuck?: boolean) {
    const a = answerText.trim();
    if (!a) return;
    setLadder({ state: "thinking", rung, stuck });
    const [out] = await Promise.all([answerStep(question, a), sleep(600)]);
    place(out, rung, stuck);
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
      <Shell lang={lang} setLang={setLang} dir={dir} nav={!!home?.started}>
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
    // The tabs wait for the first card. Until then there is nothing behind
    // "Notebook", and one word fewer on the first screen is a kindness.
    <Shell lang={lang} setLang={setLang} dir={dir} nav={!!home?.started && stage !== "card"}>
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
                    <span aria-hidden className="w-6 shrink-0 text-wish-gold">
                      {w.card ? (
                        <CardSymbol id={w.card.id} className="w-6 h-6" />
                      ) : (
                        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.4">
                          <circle cx="12" cy="12" r="8" />
                        </svg>
                      )}
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
          {/* What was heard, written down one line at a time in the hand's
              gold. The lines are the choices — nothing is said above them and
              nothing repeated below. */}
          <HeardWishes
            wishes={heard}
            disabled={busy}
            chosen={chosen}
            onWritten={() => setHeardWritten(true)}
            onPick={(w) =>
              commitWish(
                w.label,
                heard.filter((o) => o.label !== w.label).map((o) => o.label),
              )
            }
          />
          {heardWritten && (
            <div className="animate-rise-line">
              <p className="mt-8 font-serif text-[21px] leading-snug text-wish-ink text-balance">{t.whichFirst}</p>
              <p className="mt-3 font-serif text-[16px] text-wish-muted leading-relaxed">{t.nothingLost}</p>
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
        </div>
      )}

      {/* 2 & 3 — the picture, and the offer of the card */}
      {home?.horizon && (stage === "picture" || stage === "confirm") && (
        <div className="animate-rise-line">
          <WishPicture sketch={home.sketch} words={home.horizon} lang={lang} card={null} />

          {stage === "picture" && !notNow && (
            <>
              <p className="mt-8 text-center font-serif text-[24px] text-wish-ink leading-snug">
                {t.wishTookShape}
              </p>
              <p className="mt-2 text-center font-serif text-[20px] text-wish-muted leading-snug text-balance">
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

      {/* 3 & 4 — the draw and the card.
           The wish steps back but never leaves: the card is drawn FOR it, and
           when it is kept the symbol goes to sit on its corner. No hand
           anywhere near this — the witness's hand belongs to the notebook. */}
      {stage === "card" && (
        <div className="flex flex-col items-center">
          {home?.horizon && (
            <div
              className="w-full animate-[recede_600ms_ease-out_both]"
              style={{ opacity: 0.28 }}
              aria-hidden
            >
              <div className="relative">
                <WishPicture sketch={home.sketch} words={home.horizon} lang={lang} card={null} />
                {/* Where the symbol is going to land: the seal's corner. */}
                <div ref={slotRef} className="absolute bottom-3 size-10 ltr:right-3 rtl:left-3" />
              </div>
            </div>
          )}

          {/* The Oracle is a light. It gathers here before there is any card;
              the card comes up out of it; it answers when the card turns; and
              it stays behind the card afterwards, quietly. */}
          <div ref={symbolRef} className="relative w-full flex justify-center -mt-4">
            <OracleLight mode={lightFor(phase)} />
            <RoadCardObject
              id={drawn?.id ?? null}
              name={drawn ? cardText(lang, drawn.id).name : ""}
              line={drawn ? cardText(lang, drawn.id).line : ""}
              phase={phase}
              symbolGone={!!flight}
            />
          </div>

          {told && drawn && (
            <div className="w-full mt-9">
              {/* The reading, as one piece of writing: what this card is for,
                  and what it says about her wish, in her own words. Until the
                  reading arrives, the card's own first sentence stands there;
                  the reading begins the same way and simply grows out of it.
                  Read like a letter — from the start of the line — where the
                  card's title and its last line are set centred. */}
              <p
                key={drawn.reading ? "reading" : "appears"}
                className="font-serif text-[19px] leading-relaxed text-wish-ink/90 text-start"
                style={{ animation: "risein 700ms cubic-bezier(0.19,1,0.22,1) both" }}
              >
                {drawn.reading ?? cardText(lang, drawn.id).appears}
              </p>

              {/* The line she leaves with. Set apart, under a gold rule. */}
              <div
                className="mt-9 flex flex-col items-center"
                style={{ animation: "risein 620ms cubic-bezier(0.19,1,0.22,1) 460ms both" }}
              >
                <span aria-hidden className="block w-10 h-px bg-wish-gold/70" />
                <p className="mt-5 text-center font-serif text-[22px] leading-snug text-wish-ink text-balance">
                  {cardText(lang, drawn.id).carry}
                </p>
              </div>

              <Primary
                onClick={keepCard}
                disabled={!!flight}
                className="mt-10 w-full"
                style={{ animation: "risein 620ms cubic-bezier(0.19,1,0.22,1) 640ms both" }}
              >
                {t.cardKeep}
              </Primary>
            </div>
          )}
        </div>
      )}

      {/* The symbol crossing from the card to the corner of the wish. */}
      {flight && (
        <div
          aria-hidden
          className="fixed z-50 pointer-events-none text-wish-gold"
          style={{
            left: flight.x,
            top: flight.y,
            width: 160,
            height: 160,
            animation: "fly 980ms cubic-bezier(0.4, 0, 0.2, 1) both",
            // @ts-expect-error — custom properties are how the flight is aimed
            "--fx": `${flight.dx}px`,
            "--fy": `${flight.dy}px`,
            "--fs": flight.s,
          }}
        >
          <CardSymbol id={flight.id} className="w-full h-full" />
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
            <div className="mt-7">
              {/* The witness writes his line while she watches: word by word,
                  then the pen runs on, then his hand lifts away. Her deed
                  appears under it in the plain face — he wrote the line, not
                  what she did. Acknowledgment sits above the offer, never below. */}
              <WitnessLine
                key={home.todayDeed.id}
                line={home.todayDeed.kind === "stuck" ? t.sawStuck : home.todayDeed.kind === "stayed" ? t.sawStayed : t.sawDid}
                deed={home.todayDeed.text}
                dir={dir}
                write
                onWritten={() => setLineDone(true)}
              />
            </div>
          ) : !asking && !deedKind ? (
            <div className="mt-10">
              {/* Straight after the card is kept, say what just happened —
                  the symbol on the corner of the picture is not self-evident. */}
              {justKept && home.card && (
                <p className="mb-5 text-center font-serif text-[19px] leading-snug text-wish-ink text-balance animate-rise-line">
                  {t.cardBelongs(cardText(lang, home.card.id).name)}
                </p>
              )}
              <Primary onClick={() => { setJustKept(false); setAsking(true); }} className="w-full">
                {justKept ? t.beginToday : t.tellToday}
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

          {/* 5b — one more, smaller. Never after "I endured". And never before
              the witness has finished writing: the Oracle sees her first, then
              asks, and only then offers one step. */}
          {ladder && ladder.state !== "closed" && lineDone && (
            <div className="mt-10 animate-rise-line">
              {ladder.state === "offer" && (
                <>
                  {/* Acknowledgment first, always. A task handed to someone who
                      just said they're unhappy would say: your sadness is a
                      productivity problem. It isn't. */}
                  {ladder.stuck && ladder.rung === 0 && (
                    <p className="font-serif text-[20px] text-wish-ink/85 leading-snug mb-3">{t.stuckAck}</p>
                  )}
                  <p className="font-serif text-[23px] text-wish-ink leading-snug mb-5 text-balance">
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

              {/* The intro line stands above whatever the Oracle finds — it is
                  said while looking, and left there. */}
              {(ladder.state === "thinking" || ladder.state === "step") && (
                <p className="font-serif text-[19px] text-wish-muted leading-snug animate-rise-line">
                  {t.stepIntro}
                </p>
              )}

              {ladder.state === "thinking" && (
                <p className="mt-6 font-serif text-[16px] text-wish-muted/70 animate-pulse">{t.stepThinking}</p>
              )}

              {/* The app does not know what a thing she named is. It asks, in
                  one short question, and never guesses. */}
              {ladder.state === "ask" && ladder.question && (
                <div className="animate-rise-line">
                  <p className="font-serif text-[17px] text-wish-muted leading-snug">{t.stepAskLead}</p>
                  <p className="mt-2 font-serif text-[26px] text-wish-ink leading-snug text-balance">{ladder.question}</p>
                  <input
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void answerAsk(ladder.question!, ladder.rung, ladder.stuck);
                    }}
                    placeholder={t.stepAskPlaceholder}
                    autoFocus
                    className="mt-5 w-full rounded-full border border-wish-ink/20 bg-transparent px-5 py-3 font-serif text-[19px] text-wish-ink
                               placeholder:text-wish-muted/60 outline-none focus:border-wish-ink/60 transition-colors"
                  />
                  <Primary
                    onClick={() => answerAsk(ladder.question!, ladder.rung, ladder.stuck)}
                    disabled={!answerText.trim()}
                    className="mt-4 w-full"
                  >
                    {t.stepAskSend}
                  </Primary>
                  <Secondary onClick={() => setLadder({ ...ladder, state: "closed" })} className="mt-2 w-full">
                    {t.stepEnough}
                  </Secondary>
                </div>
              )}

              {ladder.state === "step" && (
                <div style={{ animation: "risein 700ms cubic-bezier(0.19,1,0.22,1) 200ms both" }}>
                  <p className="mt-5 font-serif text-[28px] text-wish-ink leading-snug mb-7 text-balance">
                    {ladder.text}
                  </p>
                  <Primary
                    onClick={() => stepDone(ladder.text!, ladder.rung)}
                    disabled={busy}
                    className="w-full"
                  >
                    {t.stepDone}
                  </Primary>
                  <Secondary onClick={() => setLadder({ ...ladder, state: "closed" })} className="mt-2 w-full">
                    {t.stepEnough}
                  </Secondary>
                </div>
              )}
            </div>
          )}

          {ladder?.state === "closed" && ladder.rung > 0 && lineDone && (
            <p className="mt-8 font-serif text-xl text-wish-ink/75 animate-rise-line">
              {t.stepClosed}
            </p>
          )}

          {/* 6 — the witness */}
          {witness !== null && lineDone && (!ladder || ladder.state === "closed") && (
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
