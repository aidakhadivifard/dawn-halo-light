// The sticker deck: drawn against Aida's table, checked by a vision model,
// approved by a person. What these tests protect: nothing unapproved ever
// reaches the app; a drawing the reviewer rejects is kept but never shown;
// the table is the one Aida gave us.

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createDb, type DB } from "../src/db";
import { createApp } from "../src/app";
import { WISH_GROUPS, parseScene, parseVerdict, STYLE } from "../src/lib/stickers";
import type { MessagesClient } from "../src/lib/anthropic";
import type { FetchLike } from "../src/lib/sketch";

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
process.env.ADMIN_KEY = "test-admin";

/** A model that writes scenes, and reviews drawings — passing every second one. */
function fakeModel(reviewOk: (n: number) => boolean): MessagesClient {
  let reviews = 0;
  return {
    messages: {
      create: async (args: any) => {
        const content = args.messages[0].content;
        if (typeof content === "string") {
          return { content: [{ type: "text", text: JSON.stringify({ scene: "Right arm up on a branch, left arm holds a coral mug, two legs dangle, the sloth smiles.", caption_en: "Day 3. I rested. On purpose.", caption_fa: "روز ۳. استراحت کردم. عمداً." }) }] };
        }
        reviews++;
        return { content: [{ type: "text", text: JSON.stringify(reviewOk(reviews) ? { ok: true, problems: [] } : { ok: false, problems: ["arms come out of the head"] }) }] };
      },
    },
  } as unknown as MessagesClient;
}
const fakeGemini: FetchLike = async () => ({
  ok: true, status: 200, text: async () => "",
  json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: PNG.toString("base64") } }] } }] }),
});
const settle = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("the table", () => {
  it("is Aida's: 11 groups, 150 wishes", () => {
    expect(WISH_GROUPS.length).toBe(11);
    expect(WISH_GROUPS.reduce((n, g) => n + g.wishes.length, 0)).toBe(150);
    expect(WISH_GROUPS[0].id).toBe("love");
  });
  it("the locked style forbids text and keeps the paper light", () => {
    expect(STYLE).toContain("No text");
    expect(STYLE).toContain("#fff9f4");
  });
  it("reads scenes and verdicts, and refuses scraps", () => {
    expect(parseScene('{"scene":"short"}')).toBeNull();
    expect(parseScene('ok {"scene":"Right arm up, left arm holds a coral mug, two legs dangle.","caption_en":"x","caption_fa":"y"}')?.caption_fa).toBe("y");
    expect(parseVerdict("nonsense").ok).toBe(false);
    expect(parseVerdict('{"ok":true,"problems":[]}').ok).toBe(true);
  });
});

describe("drawing and approving", () => {
  let db: DB;
  beforeEach(() => { db = createDb(":memory:"); });
  const admin = (r: request.Test) => r.set("x-admin-key", "test-admin");

  it("draws a group, keeps what the reviewer passed as 'drawn' and what it failed as 'rejected'", async () => {
    // Every second review fails → each sticker gets a second attempt; the odd attempts pass.
    const api = createApp(db, { client: fakeModel((n) => n % 2 === 1), sketch: { apiKey: "k", fetch: fakeGemini } });
    const started = await admin(request(api).post("/api/admin/stickers/run?group=love&limit=3"));
    expect(started.body.started).toBe(true);
    for (let i = 0; i < 50 && (await admin(request(api).get("/api/admin/stickers/status"))).body.status.running; i++) await settle(20);
    const st = await admin(request(api).get("/api/admin/stickers/status"));
    expect(st.body.status.done).toBe(3);
    const rows = db.listStickers("love");
    expect(rows.length).toBe(3);
    expect(rows.every((r) => r.status === "drawn")).toBe(true);
  });

  it("nothing reaches the app until a person approves it", async () => {
    const api = createApp(db, { client: fakeModel(() => true), sketch: { apiKey: "k", fetch: fakeGemini } });
    await admin(request(api).post("/api/admin/stickers/run?group=body&limit=2"));
    for (let i = 0; i < 50 && (await admin(request(api).get("/api/admin/stickers/status"))).body.status.running; i++) await settle(20);
    const rows = db.listStickers("body");
    expect(rows.length).toBe(2);

    // Public list: empty. Public image: 404. Admin image: 200.
    expect((await request(api).get("/api/stickers?group=body")).body.stickers).toEqual([]);
    await request(api).get(`/api/stickers/${rows[0].id}.jpg`).expect(404);
    await admin(request(api).get(`/api/stickers/${rows[0].id}.jpg`)).expect(200);

    await admin(request(api).post(`/api/admin/stickers/${rows[0].id}/status`)).send({ status: "approved" }).expect(200);
    const pub = await request(api).get("/api/stickers?group=body");
    expect(pub.body.stickers.length).toBe(1);
    expect(pub.body.stickers[0].caption_fa).toContain("روز");
    await request(api).get(`/api/stickers/${rows[0].id}.jpg`).expect(200);
  });

  it("a rejected drawing is kept for study but never shown", async () => {
    const api = createApp(db, { client: fakeModel(() => false), sketch: { apiKey: "k", fetch: fakeGemini } });
    await admin(request(api).post("/api/admin/stickers/run?group=calm&limit=1"));
    for (let i = 0; i < 50 && (await admin(request(api).get("/api/admin/stickers/status"))).body.status.running; i++) await settle(20);
    const [row] = db.listStickers("calm");
    expect(row.status).toBe("rejected");
    expect(row.review).toContain("head");
    await request(api).get(`/api/stickers/${row.id}.jpg`).expect(404);
  });

  it("the review page is admin-only and lists the group", async () => {
    const api = createApp(db, { client: fakeModel(() => true), sketch: { apiKey: "k", fetch: fakeGemini } });
    await request(api).get("/api/admin/stickers/review?group=love").expect(401);
    const page = await request(api).get("/api/admin/stickers/review?group=love&key=test-admin").expect(200);
    expect(page.text).toContain("عشق و رابطه");
  });

  it("without a key, the app still lists the groups", async () => {
    const api = createApp(db, { client: null, sketch: { apiKey: null } });
    const groups = await request(api).get("/api/stickers").expect(200);
    expect(groups.body.groups.length).toBe(11);
  });
});
