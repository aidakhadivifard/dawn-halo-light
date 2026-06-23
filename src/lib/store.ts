// Persistence facade used by the UI. Prefers the backend; falls back to the
// localStorage mock (dawnhalo.ts) when the backend is unreachable so the app
// keeps working offline / in preview. Returns the unified Card shape.

import { api, type Entitlement } from "@/lib/api";
import { fromApiCard, type Card } from "@/lib/cards";
import { srcForId } from "@/lib/cardLibrary";
import {
  loadSaved as lsLoadSaved,
  saveCard as lsSaveCard,
  removeSaved as lsRemoveSaved,
  loadHistory as lsLoadHistory,
  computeStreak as lsComputeStreak,
  loadSettings as lsLoadSettings,
  saveSettings as lsSaveSettings,
  artForCard,
  type OracleCard,
  type Settings,
} from "@/lib/dawnhalo";

function oracleToCard(o: OracleCard): Card {
  return {
    id: o.id,
    opener: o.opener,
    title: o.title,
    message: o.message,
    reflection: o.reflection,
    theme: o.theme,
    element: o.element,
    number: o.number,
    shadow: o.shadow,
    hidden: o.hidden,
    illustration: artForCard(o),
    createdAt: o.savedAt ?? o.createdAt,
  };
}

export interface SavedCard extends Card {
  savedAt?: string;
}

export async function getEntitlement(): Promise<Entitlement | null> {
  try {
    return await api.entitlement();
  } catch {
    return null;
  }
}

export async function getSaved(): Promise<SavedCard[]> {
  try {
    const { saved } = await api.listSaved();
    return saved.map((c) => ({ ...fromApiCard(c), savedAt: c.savedAt }));
  } catch {
    return lsLoadSaved().map(oracleToCard);
  }
}

export async function saveCard(card: Card): Promise<void> {
  try {
    await api.save({
      id: card.id,
      opener: card.opener,
      title: card.title,
      message: card.message,
      theme: (card.theme ?? "daily_general") as any,
      illustrationId: card.illustrationId ?? "",
      createdAt: card.createdAt ?? new Date().toISOString(),
    });
  } catch {
    lsSaveCard({
      id: card.id,
      art: "dawn",
      theme: (card.theme ?? "daily_general") as any,
      opener: card.opener,
      title: card.title,
      message: card.message,
      createdAt: card.createdAt ?? new Date().toISOString(),
    });
  }
}

export async function removeSaved(id: string): Promise<void> {
  try {
    await api.unsave(id);
  } catch {
    lsRemoveSaved(id);
  }
}

export async function getCalendar(): Promise<{ byDay: Record<string, Card[]>; streak: number }> {
  try {
    const { byDay, streak } = await api.calendar();
    const mapped: Record<string, Card[]> = {};
    for (const [day, cards] of Object.entries(byDay)) mapped[day] = cards.map(fromApiCard);
    return { byDay: mapped, streak };
  } catch {
    const history = lsLoadHistory();
    const byDay: Record<string, Card[]> = {};
    for (const c of history) {
      const key = new Date(c.createdAt).toLocaleDateString("en-CA"); // YYYY-MM-DD
      (byDay[key] ||= []).push(oracleToCard(c));
    }
    return { byDay, streak: lsComputeStreak(history) };
  }
}

export async function getSettings(): Promise<Settings> {
  try {
    return await api.getSettings();
  } catch {
    return lsLoadSettings();
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  try {
    await api.setSettings(s);
  } catch {
    lsSaveSettings(s);
  }
}

export async function createSpark(card: Card, note: string): Promise<string> {
  try {
    const { url } = await api.createSpark(
      {
        id: card.id,
        opener: card.opener,
        title: card.title,
        message: card.message,
        theme: (card.theme ?? "daily_general") as any,
        illustrationId: card.illustrationId ?? "",
        createdAt: card.createdAt ?? new Date().toISOString(),
      },
      note,
    );
    if (url) return url;
  } catch {
    /* fall through to offline encoded link */
  }
  // Offline fallback: the legacy client-encoded share link.
  const { encodeShare } = await import("@/lib/dawnhalo");
  const token = encodeShare(
    {
      id: card.id,
      art: "dawn",
      theme: (card.theme ?? "daily_general") as any,
      opener: card.opener,
      title: card.title,
      message: card.message,
      createdAt: card.createdAt ?? new Date().toISOString(),
    },
    note,
  );
  return `${typeof window !== "undefined" ? window.location.origin : ""}/spark/${token}`;
}

export { srcForId };
