// The Vow — typed client seam. All vow data flows through this module: it
// calls the backend first and falls back to a localStorage vow when the
// backend is unreachable, so the ritual always works (matching cards.ts).
//
// The offline vow is deterministic: the same (enduring, hope) always draws the
// same card, so a flaky network can never quietly change someone's vow.

import {
  api,
  type ApiJourney,
  type ApiDarkNightContext,
  type ApiKeepsake,
  type ApiLetter,
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
  /** True when this vow lives only in localStorage (backend unreachable). */
  offline?: boolean;
}

export interface DarkNightContext extends ApiDarkNightContext {}

export type VowOutcome =
  | { kind: "vow"; vow: Vow }
  | { kind: "crisis"; message: string; resources: { region: string; label: string; detail: string }[] };

export type NightOutcome =
  | { kind: "night"; context: DarkNightContext }
  | { kind: "crisis"; message: string; resources: { region: string; label: string; detail: string }[] };

const LS_KEY = "dawnhalo:vow";

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
    enduring: j.enduring,
    hope: j.hope,
    status: j.status,
    startedLocalDate: j.startedLocalDate,
    closedLocalDate: j.closedLocalDate,
    dayNumber: j.dayNumber,
    keepsakeToken: j.keepsakeToken,
    letter: j.letter ?? null,
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

function storedToVow(s: StoredVow): Vow {
  return {
    id: s.id,
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

function offlineCreate(enduring: string, hope: string, letterTo?: string, letterText?: string): Vow {
  const pick = OFFLINE_VOW_CARDS[hashStr(`${enduring}::${hope}`) % OFFLINE_VOW_CARDS.length];
  const pool = cardsByTheme(pick.theme);
  const illustrationId = pool.length ? pool[hashStr(enduring) % pool.length].id : "";
  const stored: StoredVow = {
    id: `vow_local_${Date.now().toString(36)}`,
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

/** The active vow, or null. Backend first; offline localStorage vow second. */
export async function getVow(): Promise<Vow | null> {
  try {
    const { journey } = await api.getJourney();
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

/** Make the vow — optionally with a sealed letter. Crisis-safe offline too. */
export async function createVow(
  enduring: string,
  hope: string,
  letterTo?: string,
  letterText?: string,
): Promise<VowOutcome> {
  try {
    const res = await api.createJourney({ enduring, hope, letterTo, letterText });
    if (res.isCrisis)
      return { kind: "crisis", message: res.message ?? CRISIS_MESSAGE, resources: res.resources ?? CRISIS_RESOURCES };
    if (res.journey) return { kind: "vow", vow: apiToVow(res.journey) };
    throw new Error("bad_response");
  } catch {
    // Offline: still enforce crisis safety deterministically.
    for (const t of [enduring, hope, letterText ?? ""]) {
      if (t && classifyInput(t) === "crisis")
        return { kind: "crisis", message: CRISIS_MESSAGE, resources: CRISIS_RESOURCES };
    }
    return { kind: "vow", vow: offlineCreate(enduring, hope, letterTo, letterText) };
  }
}

/** Log a dark night; the answer is the person's own history. */
export async function logDarkNight(text: string): Promise<NightOutcome | null> {
  try {
    const res = await api.darkNight(text);
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
): Promise<CloseResult | null> {
  try {
    const res = await api.closeJourney({ outcome, note });
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
