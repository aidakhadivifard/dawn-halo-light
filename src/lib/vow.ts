// The Vow — typed client seam. All vow data flows through this module: it
// calls the backend first and falls back to a localStorage vow when the
// backend is unreachable, so the ritual always works (matching cards.ts).
//
// The offline vow is deterministic: the same (enduring, hope) always draws the
// same card, so a flaky network can never quietly change someone's vow.

import {
  api,
  RoadsFullError,
  type ApiJourney,
  type ApiSketch,
  type ApiDarkNightContext,
  type ApiKeepsake,
  type ApiLetter,
  type HeardWish,
} from "@/lib/api";
import { srcForId, cardsByTheme, type CardTheme } from "@/lib/cardLibrary";
import { classifyInput, artForCard } from "@/lib/dawnhalo";
import { localDay } from "@/lib/device";
import type { Card } from "@/lib/cards";

export interface VowDarkNight {
  id: string;
  text: string;
  localDate: string;
  createdAt: string;
}

export interface Vow {
  id: string;
  /** A short name for this road ("Body", "Pink Wallet"), or null. */
  label: string | null;
  enduring: string;
  hope: string;
  status: "active" | "fulfilled" | "released";
  startedLocalDate: string;
  closedLocalDate: string | null;
  dayNumber: number;
  keepsakeToken: string | null;
  /** The sealed letter — initial only while sealed. */
  letter: { initial: string | null; sealed: boolean } | null;
  card: Card;
  darkNights: VowDarkNight[];
  /** Living state: today's step, the paced ask, memory, and the return line. */
  living: {
    todayStep: { id: string; text: string; status: "committed" | "done" | "not_moved" } | null;
    askStep: boolean;
    actionPrompt: string;
    memory: string | null;
    returnLine: string | null;
  };
  /** True when this vow lives only in localStorage (backend unreachable). */
  offline?: boolean;
}

export interface DarkNightContext extends ApiDarkNightContext {}

export type VowOutcome =
  | { kind: "vow"; vow: Vow }
  | { kind: "full"; roads: Vow[]; maxRoads: number }
  | { kind: "crisis"; message: string; resources: { region: string; label: string; detail: string }[] };

/** One horizon, at most this many roads — mirrors the server invariant. */
export const MAX_ROADS = 2;

/** The horizon sketch as the UI needs it: absolute image URLs, and how much color is due. */
export interface Sketch {
  status: "none" | "pending" | "ready" | "failed";
  lineUrl: string | null;
  colorUrl: string | null;
  lit: number;
  fullAt: number;
  stale: boolean;
}

const NO_SKETCH: Sketch = { status: "none", lineUrl: null, colorUrl: null, lit: 0, fullAt: 40, stale: false };

function apiToSketch(s: ApiSketch | undefined): Sketch {
  if (!s) return NO_SKETCH;
  return {
    status: s.status,
    lineUrl: api.sketchUrl(s.lineUrl),
    colorUrl: api.sketchUrl(s.colorUrl),
    lit: s.lit,
    fullAt: s.fullAt,
    stale: s.stale,
  };
}

/** The home screen: the horizon (never measured), its sketch, and the open roads. */
export interface Home {
  horizon: string | null;
  /** True once the card is drawn — from then on the words can never change. */
  sealed: boolean;
  /** The road card, drawn once. Only the id matters; the words come from i18n. */
  card: { id: string; name: string; line: string; reading?: string | null } | null;
  /** Today's answer, if it has been given. Both kinds count the same. */
  todayDeed: { id: string; kind: "did" | "stayed" | "stuck"; text: string | null } | null;
  sketch: Sketch;
  roads: Vow[];
  maxRoads: number;
  /** Which wish this screen is showing. A person keeps several. */
  wishId: string | null;
  /** True once any card has ever been kept. Before that, the app is still arriving. */
  started: boolean;
}

/** A wish as the list shows it. */
export interface WishListItem {
  id: string;
  text: string;
  card: { id: string; name: string; line: string } | null;
  /** When its card was kept — the day the wish took a shape. */
  cardAt: string | null;
  sketch: Sketch;
  answeredToday: boolean;
  days: number;
}

export type HorizonOutcome =
  | { kind: "horizon"; horizon: string }
  | { kind: "crisis"; message: string; resources: { region: string; label: string; detail: string }[] };

export type NightOutcome =
  | { kind: "night"; context: DarkNightContext }
  | { kind: "crisis"; message: string; resources: { region: string; label: string; detail: string }[] };

const LS_KEY = "dawnhalo:vow";
const LS_HORIZON_KEY = "dawnhalo:horizon";

const CRISIS_RESOURCES = [
  { region: "US", label: "Call or text 988", detail: "Suicide & Crisis Lifeline · 24/7" },
  { region: "UK", label: "Samaritans — 116 123", detail: "Free, 24/7, any reason at all" },
];
const CRISIS_MESSAGE =
  "What you're carrying sounds really heavy, and you don't have to hold it alone. Please reach out to someone trained to listen — they want to hear from you.";

// ---- mapping --------------------------------------------------------------

function apiToVow(j: ApiJourney): Vow {
  return {
    id: j.id,
    label: j.label ?? null,
    enduring: j.enduring,
    hope: j.hope,
    status: j.status,
    startedLocalDate: j.startedLocalDate,
    closedLocalDate: j.closedLocalDate,
    dayNumber: j.dayNumber,
    keepsakeToken: j.keepsakeToken,
    letter: j.letter ?? null,
    living: j.living ?? {
      todayStep: null,
      askStep: true,
      actionPrompt: "Is there one thing you can move today?",
      memory: null,
      returnLine: null,
    },
    card: {
      id: j.card.id,
      opener: j.card.opener,
      title: j.card.title,
      message: j.card.message,
      reflection: j.card.reflection,
      theme: j.card.theme,
      illustrationId: j.card.illustrationId,
      illustration:
        srcForId(j.card.illustrationId, j.card.theme) ??
        artForCard({ id: j.card.id, theme: j.card.theme }),
      createdAt: j.card.createdAt,
    },
    darkNights: j.darkNights,
  };
}

// ---- offline vow (localStorage) ------------------------------------------

interface StoredVow {
  id: string;
  label?: string;
  enduring: string;
  hope: string;
  status: "active" | "fulfilled" | "released";
  startedLocalDate: string;
  closedLocalDate: string | null;
  cardTitle: string;
  theme: CardTheme;
  illustrationId: string;
  opener: string;
  message: string;
  reflection: string;
  darkNights: VowDarkNight[];
  letterTo?: string;
  letterText?: string;
  todayStep?: {
    id: string;
    text: string;
    status: "committed" | "done" | "not_moved";
    localDate: string;
  };
}

const OFFLINE_VOW_CARDS: { title: string; theme: CardTheme }[] = [
  { title: "The Long Road", theme: "guidance_decision" },
  { title: "Winter Roots", theme: "quiet_strength" },
  { title: "The Distant Lantern", theme: "guidance_decision" },
  { title: "The Waiting Dawn", theme: "hope_abundance" },
  { title: "The Mountain Pass", theme: "quiet_strength" },
  { title: "The Sleeping Seed", theme: "hope_abundance" },
  { title: "The Far Shore", theme: "hope_abundance" },
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function loadStored(): StoredVow | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as StoredVow) : null;
  } catch {
    return null;
  }
}

function saveStored(v: StoredVow | null) {
  try {
    if (v) localStorage.setItem(LS_KEY, JSON.stringify(v));
    else localStorage.removeItem(LS_KEY);
  } catch {
    /* storage unavailable */
  }
}

function parseLocal(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

function dayNumberOf(started: string, today: string): number {
  return Math.max(1, Math.round((parseLocal(today) - parseLocal(started)) / 86_400_000) + 1);
}

function loadHorizon(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(LS_HORIZON_KEY);
  } catch {
    return null;
  }
}

function saveHorizon(text: string | null) {
  try {
    if (text) localStorage.setItem(LS_HORIZON_KEY, text);
    else localStorage.removeItem(LS_HORIZON_KEY);
  } catch {
    /* storage unavailable */
  }
}

function storedToVow(s: StoredVow): Vow {
  return {
    id: s.id,
    label: s.label ?? null,
    enduring: s.enduring,
    hope: s.hope,
    status: s.status,
    startedLocalDate: s.startedLocalDate,
    closedLocalDate: s.closedLocalDate,
    dayNumber: dayNumberOf(s.startedLocalDate, s.closedLocalDate ?? localDay()),
    keepsakeToken: null,
    letter:
      s.letterTo && s.letterText
        ? { initial: s.letterTo.trim()[0]?.toUpperCase() ?? null, sealed: true }
        : null,
    living: {
      todayStep:
        s.todayStep && s.todayStep.localDate === localDay()
          ? { id: s.todayStep.id, text: s.todayStep.text, status: s.todayStep.status }
          : null,
      askStep: !(s.todayStep && s.todayStep.localDate === localDay()),
      actionPrompt: "Is there one thing you can move today?",
      memory: null,
      returnLine: null,
    },
    card: {
      id: s.id,
      opener: s.opener,
      title: s.cardTitle,
      message: s.message,
      reflection: s.reflection,
      theme: s.theme,
      illustrationId: s.illustrationId,
      illustration:
        srcForId(s.illustrationId, s.theme) ?? artForCard({ id: s.id, theme: s.theme }),
      createdAt: s.startedLocalDate,
    },
    darkNights: s.darkNights,
    offline: true,
  };
}

function offlineCreate(
  enduring: string,
  hope: string,
  label?: string,
  letterTo?: string,
  letterText?: string,
): Vow {
  const pick = OFFLINE_VOW_CARDS[hashStr(`${enduring}::${hope}`) % OFFLINE_VOW_CARDS.length];
  const pool = cardsByTheme(pick.theme);
  const illustrationId = pool.length ? pool[hashStr(enduring) % pool.length].id : "";
  const stored: StoredVow = {
    id: `vow_local_${Date.now().toString(36)}`,
    label: label?.trim() || undefined,
    enduring,
    hope,
    status: "active",
    startedLocalDate: localDay(),
    closedLocalDate: null,
    cardTitle: pick.title,
    theme: pick.theme,
    illustrationId,
    opener: "This is the card that stepped forward to walk with you…",
    message:
      "What you are carrying is real, and it is heavy.\n\n" +
      "This card holds the hope you named — it does not promise it. No card can. " +
      "It promises only that the road is still a road.\n\n" +
      "What holds is not the outcome. It is you, staying. That is the vow.",
    reflection: "On the hardest night, what will you want to remember about why you began?",
    darkNights: [],
    letterTo: letterTo && letterText ? letterTo : undefined,
    letterText: letterTo && letterText ? letterText : undefined,
  };
  saveStored(stored);
  return storedToVow(stored);
}

function offlineNight(text: string): NightOutcome | null {
  const s = loadStored();
  if (!s || s.status !== "active") return null;
  const today = localDay();
  const day = dayNumberOf(s.startedLocalDate, today);
  const nightNumber = s.darkNights.length + 1;
  const prev = s.darkNights[s.darkNights.length - 1] ?? null;
  const gap = prev
    ? Math.max(0, Math.round((parseLocal(today) - parseLocal(prev.localDate)) / 86_400_000))
    : null;
  s.darkNights.push({
    id: `night_local_${Date.now().toString(36)}`,
    text,
    localDate: today,
    createdAt: new Date().toISOString(),
  });
  saveStored(s);
  const line =
    nightNumber === 1
      ? `Day ${day} of your vow. This is the first night you've said it out loud — it is written down now. Your card is still ${s.cardTitle}. It has not moved.`
      : gap !== null && gap <= 1
        ? `Day ${day}. Night ${nightNumber} — close on the heels of the last one. Nights cluster sometimes; it does not mean the road is gone. ${s.cardTitle} is still your card.`
        : `Day ${day}. This is night ${nightNumber}. The last one was ${gap} days ago — and you came through it. ${s.cardTitle} has not moved.`;
  return {
    kind: "night",
    context: {
      journeyDay: day,
      nightNumber,
      previousNightDate: prev?.localDate ?? null,
      daysSincePrevious: gap,
      vowTitle: s.cardTitle,
      line,
    },
  };
}

// ---- public seam ----------------------------------------------------------

/**
 * The home screen in one call. Backend first; offline second (the offline
 * model holds one road and a horizon in localStorage — enough for the ritual
 * to work on a plane).
 */
export async function getHome(): Promise<Home> {
  try {
    const home = await api.home();
    // Cache the horizon so an offline morning still shows it.
    saveHorizon(home.horizon);
    const roads = home.roads.map(apiToVow);
    if (roads.length === 0) {
      // Backend reachable but empty: a legacy offline vow is still shown so a
      // person's vow never silently disappears.
      const stored = loadStored();
      if (stored && stored.status === "active") roads.push(storedToVow(stored));
    }
    return {
      horizon: home.horizon,
      sealed: !!home.sealed,
      card: home.card ?? null,
      todayDeed: home.todayDeed ?? null,
      sketch: apiToSketch(home.sketch),
      roads,
      maxRoads: home.maxRoads ?? MAX_ROADS,
      wishId: home.wishId ?? null,
      started: !!home.started,
    };
  } catch {
    const stored = loadStored();
    return {
      horizon: loadHorizon(),
      sealed: false,
      card: null,
      todayDeed: null,
      sketch: NO_SKETCH,
      roads: stored && stored.status === "active" ? [storedToVow(stored)] : [],
      maxRoads: MAX_ROADS,
      wishId: null,
      // Offline we cannot know; a cached wish means she has been here before.
      started: !!loadHorizon(),
    };
  }
}

/**
 * Draw the one road card. Drawing it seals the wish forever, so the caller
 * must have shown that warning first. Offline there is no card — the wish is
 * only sealed by a card that actually arrived.
 */
export async function drawRoadCard(
  lang = "en",
): Promise<{ id: string; name: string; line: string; reading?: string | null } | null> {
  try {
    const { card } = await api.drawRoadCard(lang);
    return card ?? null;
  } catch {
    return null;
  }
}

/**
 * One more, smaller. Null means we have nothing honest to offer — no model, or
 * the ladder has run its length. The app then says nothing rather than making
 * something up about a life it doesn't know.
 */
export type TinyStep =
  | { kind: "step"; text: string; done: string | null }
  | { kind: "ask"; question: string };

function shapeStep(out: { step: string | null; done: string | null; ask: string | null }): TinyStep | null {
  if (out.ask && out.ask.trim()) return { kind: "ask", question: out.ask.trim() };
  if (out.step && out.step.trim()) return { kind: "step", text: out.step.trim(), done: out.done?.trim() || null };
  return null;
}

export async function nextTinyStep(): Promise<TinyStep | null> {
  try {
    return shapeStep(await api.nextTinyStep());
  } catch {
    return null;
  }
}

/**
 * She said what the thing is. The app keeps it with the wish so it never has
 * to ask again, and offers the step it was going to offer.
 */
export async function answerStep(question: string, answer: string): Promise<TinyStep | null> {
  try {
    return shapeStep(await api.answerStep(question, answer));
  } catch {
    return null;
  }
}

/**
 * Today's answer. "I endured and kept going" is recorded exactly like "I did
 * one small thing" — same row, same weight, same color returned to the picture.
 */
export async function recordDeed(
  kind: "did" | "stayed" | "stuck",
  text?: string | null,
): Promise<
  | { kind: "deed"; sketch: Sketch }
  | { kind: "crisis"; message: string; resources: { region: string; label: string; detail: string }[] }
  | { kind: "error" }
> {
  const trimmed = (text ?? "").trim();
  if (kind === "did" && !trimmed) return { kind: "error" };
  if (trimmed && classifyInput(trimmed) === "crisis")
    return { kind: "crisis", message: CRISIS_MESSAGE, resources: CRISIS_RESOURCES };
  try {
    const res = await api.recordDeed(kind, trimmed || null);
    if (res.isCrisis)
      return { kind: "crisis", message: res.message ?? CRISIS_MESSAGE, resources: res.resources ?? CRISIS_RESOURCES };
    return { kind: "deed", sketch: apiToSketch(res.sketch) };
  } catch {
    return { kind: "error" };
  }
}

/** Ask the server to draw the horizon (idempotent). Offline: nothing to do. */
export async function requestSketch(): Promise<Sketch> {
  try {
    const { sketch } = await api.requestSketch();
    return apiToSketch(sketch);
  } catch {
    return NO_SKETCH;
  }
}

/** Name or rename the horizon. It is never counted, so there is nothing else to it. */
export async function setHorizon(
  text: string,
  /** The other wishes written in the same breath — kept, not discarded. */
  park: string[] = [],
  lang = "en",
): Promise<HorizonOutcome> {
  const trimmed = text.trim();
  try {
    const res = await api.setHorizon(trimmed, park, lang);
    if (res.isCrisis)
      return { kind: "crisis", message: res.message ?? CRISIS_MESSAGE, resources: res.resources ?? CRISIS_RESOURCES };
    saveHorizon(res.horizon ?? trimmed);
    return { kind: "horizon", horizon: res.horizon ?? trimmed };
  } catch {
    if (classifyInput(trimmed) === "crisis")
      return { kind: "crisis", message: CRISIS_MESSAGE, resources: CRISIS_RESOURCES };
    saveHorizon(trimmed);
    return { kind: "horizon", horizon: trimmed };
  }
}

export type HeardOutcome =
  | { kind: "crisis"; message: string; resources: { region: string; label: string; detail: string }[] }
  | { kind: "heard"; wishes: HeardWish[]; polished: boolean };

/**
 * What the app heard. People write several wishes at once; this separates them
 * so the person picks which one gets the card. Nothing is saved by asking.
 *
 * Offline, or if the server is asleep, it still answers — by splitting on the
 * punctuation people list things with. Finding only one thing is a fine answer:
 * it means one wish, in their exact words.
 */
export async function hearWish(text: string, lang: string): Promise<HeardOutcome> {
  const trimmed = text.trim();
  try {
    const res = await api.hearWish(trimmed, lang);
    if (res.isCrisis)
      return { kind: "crisis", message: res.message ?? CRISIS_MESSAGE, resources: res.resources ?? CRISIS_RESOURCES };
    if (res.wishes?.length) return { kind: "heard", wishes: res.wishes, polished: !res.fallback };
  } catch {
    if (classifyInput(trimmed) === "crisis")
      return { kind: "crisis", message: CRISIS_MESSAGE, resources: CRISIS_RESOURCES };
  }
  return { kind: "heard", wishes: splitLocally(trimmed), polished: false };
}

function splitLocally(text: string): HeardWish[] {
  const parts = text
    .split(/[\n\r؛;]+/)
    .map((p) => p.replace(/\s+/g, " ").replace(/^[-•*\s]+/, "").trim().slice(0, 60))
    .filter((p) => p.length > 1);
  const seen = new Set<string>();
  const out: HeardWish[] = [];
  for (const label of parts) {
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, echo: label.charAt(0).toLowerCase() + label.slice(1) });
    if (out.length >= 6) break;
  }
  if (out.length > 1) return out;
  const whole = text.replace(/\s+/g, " ").trim().slice(0, 200);
  return [{ label: whole, echo: whole.charAt(0).toLowerCase() + whole.slice(1) }];
}

/** The active vow, or null. Backend first; offline localStorage vow second. */
export async function getVow(vowId?: string): Promise<Vow | null> {
  try {
    const { journey } = await api.getJourney(vowId);
    if (journey) return apiToVow(journey);
    // Backend reachable and has no vow: an offline vow (if any) is legacy —
    // keep showing it so a person's vow never silently disappears.
    const stored = loadStored();
    return stored && stored.status === "active" ? storedToVow(stored) : null;
  } catch {
    const stored = loadStored();
    return stored && stored.status === "active" ? storedToVow(stored) : null;
  }
}

/** Make a vow — open a road — optionally with a sealed letter. Crisis-safe offline too. */
export async function createVow(
  enduring: string,
  hope: string,
  opts: { label?: string; letterTo?: string; letterText?: string } = {},
): Promise<VowOutcome> {
  const { label, letterTo, letterText } = opts;
  try {
    const res = await api.createJourney({ enduring, hope, label, letterTo, letterText });
    if (res.isCrisis)
      return { kind: "crisis", message: res.message ?? CRISIS_MESSAGE, resources: res.resources ?? CRISIS_RESOURCES };
    if (res.journey) return { kind: "vow", vow: apiToVow(res.journey) };
    throw new Error("bad_response");
  } catch (e) {
    if (e instanceof RoadsFullError) {
      return { kind: "full", roads: e.roads.map(apiToVow), maxRoads: e.maxRoads };
    }
    // Offline: still enforce crisis safety deterministically.
    for (const t of [enduring, hope, label ?? "", letterText ?? ""]) {
      if (t && classifyInput(t) === "crisis")
        return { kind: "crisis", message: CRISIS_MESSAGE, resources: CRISIS_RESOURCES };
    }
    // The offline model holds one road.
    const stored = loadStored();
    if (stored && stored.status === "active") return { kind: "full", roads: [storedToVow(stored)], maxRoads: 1 };
    return { kind: "vow", vow: offlineCreate(enduring, hope, label, letterTo, letterText) };
  }
}

// ---- One Small Step -------------------------------------------------------

export type StepOutcome =
  | { kind: "step"; step: { id: string; text: string; status: "committed" } }
  | { kind: "crisis"; message: string; resources: { region: string; label: string; detail: string }[] }
  | null;

/** I'LL DO THIS — commit one small step for today. */
export async function commitStep(text: string, vowId?: string): Promise<StepOutcome> {
  try {
    const res = await api.commitStep(text, vowId);
    if (res.isCrisis)
      return { kind: "crisis", message: res.message ?? CRISIS_MESSAGE, resources: res.resources ?? CRISIS_RESOURCES };
    if (res.step) return { kind: "step", step: res.step };
    return null;
  } catch {
    if (classifyInput(text) === "crisis")
      return { kind: "crisis", message: CRISIS_MESSAGE, resources: CRISIS_RESOURCES };
    const s = loadStored();
    if (!s || s.status !== "active") return null;
    s.todayStep = {
      id: `step_local_${Date.now().toString(36)}`,
      text: text.trim(),
      status: "committed",
      localDate: localDay(),
    };
    saveStored(s);
    return { kind: "step", step: { id: s.todayStep.id, text: s.todayStep.text, status: "committed" } };
  }
}

/** NOT TODAY — silently recorded for pacing only. */
export async function declineStep(vowId?: string): Promise<void> {
  try {
    await api.declineStep(vowId);
  } catch {
    /* offline: nothing to record */
  }
}

/** Did it move? Either answer gets a judgment-free witness line. */
export async function resolveStep(done: boolean, vowId?: string): Promise<string | null> {
  try {
    const { line } = await api.resolveStep(done, vowId);
    return line;
  } catch {
    const s = loadStored();
    if (s?.todayStep && s.todayStep.status === "committed") {
      s.todayStep.status = done ? "done" : "not_moved";
      saveStored(s);
    }
    return done ? "It moved today." : "The vow is still here.";
  }
}

/** Log a dark night; the answer is the person's own history. */
export async function logDarkNight(text: string, vowId?: string): Promise<NightOutcome | null> {
  try {
    const res = await api.darkNight(text, vowId);
    if (res.isCrisis)
      return { kind: "crisis", message: res.message ?? CRISIS_MESSAGE, resources: res.resources ?? CRISIS_RESOURCES };
    if (res.context) return { kind: "night", context: res.context };
    return null;
  } catch {
    if (classifyInput(text) === "crisis")
      return { kind: "crisis", message: CRISIS_MESSAGE, resources: CRISIS_RESOURCES };
    return offlineNight(text);
  }
}

export interface CloseResult {
  keepsake: ApiKeepsake;
  /** Public share URL — null for offline vows (nothing to share yet). */
  url: string | null;
  /** The unsealed letter (fulfilled vows only). */
  letter: { to: string; text: string; url: string | null } | null;
  /** True when a released vow's letter was burned unread. */
  letterBurned: boolean;
}

/** Close the vow — fulfilled or released — and mint the keepsake. */
export async function closeVow(
  outcome: "fulfilled" | "released",
  note: string,
  vowId?: string,
): Promise<CloseResult | null> {
  try {
    const res = await api.closeJourney({ outcome, note, journeyId: vowId });
    saveStored(null); // any legacy offline vow is superseded
    return { keepsake: res.keepsake, url: res.url, letter: res.letter, letterBurned: res.letterBurned };
  } catch {
    const s = loadStored();
    if (!s || s.status !== "active") return null;
    s.status = outcome;
    s.closedLocalDate = localDay();
    // The letter's two fates, offline as well.
    const hadLetter = !!(s.letterTo && s.letterText);
    const letter =
      outcome === "fulfilled" && hadLetter
        ? { to: s.letterTo!, text: s.letterText!, url: null }
        : null;
    const letterBurned = outcome === "released" && hadLetter;
    if (letterBurned || outcome === "fulfilled") {
      delete s.letterTo;
      delete s.letterText;
    }
    saveStored(s);
    return {
      keepsake: {
        status: outcome,
        enduring: s.enduring,
        hope: s.hope,
        cardTitle: s.cardTitle,
        cardEssence: "",
        theme: s.theme,
        illustrationId: s.illustrationId,
        message: s.message,
        startedLocalDate: s.startedLocalDate,
        closedLocalDate: s.closedLocalDate,
        daysHeld: dayNumberOf(s.startedLocalDate, s.closedLocalDate),
        darkNights: s.darkNights.length,
        closingNote: note || null,
      },
      url: null,
      letter,
      letterBurned,
    };
  }
}

/** Public unsealed-letter lookup for the /letter/$token page. */
export async function getLetter(token: string): Promise<ApiLetter | null> {
  try {
    const { letter } = await api.getLetter(token);
    return letter;
  } catch {
    return null;
  }
}

/** Public keepsake lookup for the /keepsake/$token page. */
export async function getKeepsake(token: string): Promise<ApiKeepsake | null> {
  try {
    const { keepsake } = await api.getKeepsake(token);
    return keepsake;
  } catch {
    return null;
  }
}

/**
 * Every wish she keeps, in the order she wrote them.
 *
 * This is what the app opens to once there is more than one: some have had
 * their card drawn and are being lived, some are still waiting, and the road
 * repeats for each of them.
 */
export async function listWishes(): Promise<{ currentId: string | null; wishes: WishListItem[] }> {
  try {
    const res = await api.listWishes();
    return {
      currentId: res.currentId ?? null,
      wishes: (res.wishes ?? []).map((w) => ({
        id: w.id,
        text: w.text,
        card: w.card ?? null,
        cardAt: w.cardAt ?? null,
        sketch: apiToSketch(w.sketch),
        answeredToday: !!w.answeredToday,
        days: w.days ?? 0,
      })),
    };
  } catch {
    // Offline: the one wish we cached is still hers to look at.
    return { currentId: null, wishes: [] };
  }
}

/** Open one of them. From here on, every other call means this wish. */
export async function openWish(id: string): Promise<boolean> {
  try {
    await api.openWish(id);
    return true;
  } catch {
    return false;
  }
}

/** Begin another wish, and open it. A sealed wish is not the end of the app. */
export async function beginWish(text: string, park: string[] = []): Promise<HorizonOutcome> {
  const trimmed = text.trim();
  try {
    const res = await api.beginWish(trimmed, park);
    if (res.isCrisis)
      return { kind: "crisis", message: res.message ?? CRISIS_MESSAGE, resources: res.resources ?? CRISIS_RESOURCES };
    saveHorizon(res.horizon ?? trimmed);
    return { kind: "horizon", horizon: res.horizon ?? trimmed };
  } catch {
    if (classifyInput(trimmed) === "crisis")
      return { kind: "crisis", message: CRISIS_MESSAGE, resources: CRISIS_RESOURCES };
    saveHorizon(trimmed);
    return { kind: "horizon", horizon: trimmed };
  }
}
