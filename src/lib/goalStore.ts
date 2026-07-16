// Facade for the goal layer. Backend-first (api.ts); reads fall back to the
// last cached status so the day count stays visible offline. Writes require
// the backend — callers get { kind: "offline" } and show a gentle note.
// The goal photo NEVER leaves the device: it is stored (downscaled) in
// localStorage only, keyed to the goal id.

import {
  api,
  PaywallError,
  type CheckinResponse,
  type CheckinState,
  type GoalStatus,
  type GoalSummary,
  type RitualResponse,
  type RitualType,
} from "@/lib/api";
import { localDay } from "@/lib/device";

const CACHE_KEY = "dawnhalo:goalStatus";
const PHOTO_KEY = "dawnhalo:goalPhoto";

function readCache(): GoalStatus | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as GoalStatus) : null;
  } catch {
    return null;
  }
}

function writeCache(status: GoalStatus | null) {
  try {
    if (status) localStorage.setItem(CACHE_KEY, JSON.stringify(status));
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    /* storage full/blocked — reads just miss */
  }
}

/** Days since commitment, computed locally (Day 1 = start day). */
function localDaysSince(startDate: string): number {
  const utc = (d: string) => {
    const [y, m, dd] = d.split("-").map(Number);
    return Date.UTC(y, (m ?? 1) - 1, dd ?? 1);
  };
  return Math.max(1, Math.round((utc(localDay()) - utc(startDate)) / 86_400_000) + 1);
}

export async function getGoalStatus(): Promise<GoalStatus | null> {
  try {
    const { status } = await api.getGoal();
    writeCache(status);
    return status;
  } catch {
    const cached = readCache();
    if (!cached) return null;
    // Offline: recompute the honest numbers locally; drop server-only flags.
    const day = localDaysSince(cached.goal.startDate);
    return {
      ...cached,
      day,
      progress: Math.min(1, day / Math.max(1, cached.totalDays)),
      checkedInToday: false,
      todayState: null,
      ritualDoneToday: false,
      honestyDue: false,
    };
  }
}

export async function createGoal(input: {
  title: string;
  reward: string;
  targetDate: string;
  ritual?: RitualType;
}): Promise<{ kind: "ok"; status: GoalStatus } | { kind: "offline" } | { kind: "error"; error: string }> {
  try {
    const { status } = await api.createGoal(input);
    writeCache(status);
    return { kind: "ok", status };
  } catch (e: any) {
    if (e?.message?.startsWith("api_error_4")) return { kind: "error", error: e.message };
    return { kind: "offline" };
  }
}

export async function updateGoal(patch: {
  title?: string;
  ritual?: RitualType;
}): Promise<GoalStatus | null> {
  try {
    const { status } = await api.updateGoal(patch);
    writeCache(status);
    return status;
  } catch {
    return null;
  }
}

export async function checkin(input: {
  state: CheckinState;
  note?: string;
}): Promise<CheckinResponse | { kind: "offline" }> {
  try {
    const res = await api.checkin(input);
    if (res.kind === "checkin") {
      // keep the cached day count fresh
      const cached = readCache();
      if (cached) {
        writeCache({
          ...cached,
          day: res.checkin.day,
          streak: res.checkin.streak,
          checkedInToday: true,
          todayState: res.checkin.state,
        });
      }
    }
    return res;
  } catch {
    return { kind: "offline" };
  }
}

export async function doRitual(input: {
  type: RitualType;
  text?: string;
}): Promise<RitualResponse | { kind: "offline" }> {
  try {
    return await api.ritual(input);
  } catch (e) {
    if (e instanceof PaywallError) return { kind: "paywall", reason: e.reason };
    return { kind: "offline" };
  }
}

export async function answerHonesty(
  answer: "continue" | "thinking" | "done",
): Promise<{ kind: "ok"; summary?: GoalSummary } | { kind: "offline" }> {
  try {
    const res = await api.honesty(answer);
    if (answer === "done") writeCache(null);
    return { kind: "ok", summary: res.summary };
  } catch {
    return { kind: "offline" };
  }
}

export async function closeGoal(
  reason: "completed" | "abandoned",
): Promise<{ kind: "ok"; summary: GoalSummary } | { kind: "offline" }> {
  try {
    const { summary } = await api.closeGoal(reason);
    writeCache(null);
    return { kind: "ok", summary };
  } catch {
    return { kind: "offline" };
  }
}

export function clearGoalCache() {
  writeCache(null);
}

// ---- on-device goal photo (never uploaded) ----

export function getGoalPhoto(): string | null {
  try {
    return localStorage.getItem(PHOTO_KEY);
  } catch {
    return null;
  }
}

export function clearGoalPhoto() {
  try {
    localStorage.removeItem(PHOTO_KEY);
  } catch {
    /* ignore */
  }
}

/** Downscale + store the photo locally. Returns the data URL (or null). */
export async function setGoalPhoto(file: File): Promise<string | null> {
  try {
    const url = URL.createObjectURL(file);
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("bad_image"));
      img.src = url;
    });
    const max = 512;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    localStorage.setItem(PHOTO_KEY, dataUrl);
    return dataUrl;
  } catch {
    return null;
  }
}
