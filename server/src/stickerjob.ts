// Drawing the sticker deck, in the background, a few at a time.
//
// One job at a time. It walks a wish group, and for every wish that still has
// fewer than VARIANTS_PER_WISH usable drawings it asks the model for a scene,
// asks Gemini to draw it, asks the model to look at the drawing, and keeps
// what passed as 'drawn' — waiting for a person to approve. Anything that
// failed the look is kept too, marked 'rejected', so the failures can be
// studied; anything that could not be made at all is 'failed'.
//
// The free hosting tier sleeps when nobody talks to it, so while a job runs
// it pings its own health URL every few minutes to stay awake.

import type { DB } from "./db";
import {
  WISH_GROUPS,
  CHARACTERS,
  VARIANTS_PER_WISH,
  writeScene,
  drawScene,
  reviewDrawing,
  type StickerDeps,
} from "./lib/stickers";

export interface JobStatus {
  running: boolean;
  group: string | null;
  done: number;
  limit: number;
  lastError: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export function createStickerJob(db: DB, deps: StickerDeps) {
  const status: JobStatus = { running: false, group: null, done: 0, limit: 0, lastError: null, startedAt: null, finishedAt: null };
  let stopAsked = false;

  function newId(): string {
    return `stk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  async function makeOne(groupId: string, groupTitle: string, wishIndex: number, wish: string, variant: number) {
    // A different character per variant, and per wish, so the deck never repeats itself next door.
    const character = CHARACTERS[(wishIndex * 3 + variant * 5) % CHARACTERS.length];
    const scene = await writeScene(wish, groupTitle, character, deps);
    if (!scene) throw new Error("no_scene");
    const id = newId();
    db.insertSticker({
      id,
      group_id: groupId,
      wish_index: wishIndex,
      wish,
      variant,
      character,
      scene: scene.scene,
      caption_en: scene.caption_en || null,
      caption_fa: scene.caption_fa || null,
      mime: null,
      bytes: null,
      status: "pending",
      review: null,
      created_at: new Date().toISOString(),
    });
    // Up to two attempts at the drawing; the look decides.
    let lastProblems: string[] = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const img = await drawScene(scene.scene, deps);
      const verdict = await reviewDrawing(img, deps);
      if (verdict.ok) {
        db.setStickerImage(id, img.mime, img.bytes, "drawn", "ok");
        return;
      }
      lastProblems = verdict.problems;
      if (attempt === 1) db.setStickerImage(id, img.mime, img.bytes, "rejected", verdict.problems.join("; ") || "rejected");
    }
    void lastProblems;
  }

  async function run(groupId: string | null, limit: number) {
    status.running = true;
    status.group = groupId;
    status.done = 0;
    status.limit = limit;
    status.lastError = null;
    status.startedAt = new Date().toISOString();
    status.finishedAt = null;
    stopAsked = false;

    const keepAlive = setInterval(() => {
      const url = process.env.RENDER_EXTERNAL_URL;
      if (url) void fetch(`${url}/api/health`).catch(() => undefined);
    }, 4 * 60_000);

    try {
      const groups = groupId ? WISH_GROUPS.filter((g) => g.id === groupId) : WISH_GROUPS;
      for (const g of groups) {
        for (let i = 0; i < g.wishes.length; i++) {
          let have = db.countStickers(g.id, i);
          for (let v = have + 1; v <= VARIANTS_PER_WISH; v++) {
            if (stopAsked || status.done >= limit) return;
            try {
              await makeOne(g.id, g.title_en, i, g.wishes[i], v);
            } catch (err: any) {
              status.lastError = `${g.id}#${i}v${v}: ${String(err?.message ?? err).slice(0, 160)}`;
              console.warn(`[stickers] ${status.lastError}`);
            }
            status.done++;
          }
        }
      }
    } finally {
      clearInterval(keepAlive);
      status.running = false;
      status.finishedAt = new Date().toISOString();
    }
  }

  return {
    status: () => ({ ...status }),
    /** Start a run. Returns false if one is already going. */
    start(groupId: string | null, limit = 30): boolean {
      if (status.running) return false;
      void run(groupId, Math.max(1, Math.min(200, limit)));
      return true;
    },
    stop() {
      stopAsked = true;
    },
  };
}
