// The horizon sketch — the person's own words drawn once (line), then washed
// with color that the app reveals by the staying. These tests guard: the
// words go to the model VERBATIM; two images per horizon, ever (plus a small
// redraw cap); a failure never breaks the app; the images are served by a
// public token; and "lit" counts only done steps and hard nights.

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createDb, type DB } from "../src/db";
import { createApp } from "../src/app";
import { SKETCH_FULL_AT, SKETCH_MAX_DRAWS } from "../src/service";
import { linePrompt, colorPrompt, type FetchLike } from "../src/lib/sketch";

const DEVICE = "device-sketch-0001";
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex"); // enough to be bytes

/** A fake Gemini that records prompts and returns a tiny image per call. */
function fakeGemini(opts: { fail?: boolean; delayMs?: number } = {}) {
  const calls: any[] = [];
  const fetch: FetchLike = async (_url, init) => {
    const body = JSON.parse(init?.body ?? "{}");
    calls.push(body);
    await new Promise((r) => setTimeout(r, opts.delayMs ?? 5)); // the model takes time
    if (opts.fail) return { ok: false, status: 500, json: async () => ({}), text: async () => "boom" };
    return {
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({
        candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: PNG.toString("base64") } }] } }],
      }),
    };
  };
  return { fetch, calls };
}

describe("prompts", () => {
  it("passes the horizon verbatim and adds style only", () => {
    const words = "Rich and beautiful. My kids, my family and my friends beside me in a big house and pinkwallet app is successful.";
    const p = linePrompt(words);
    expect(p.startsWith(`Draw me: ${words}`)).toBe(true);
    expect(p).toContain("do not add or change any element");
    expect(colorPrompt()).toContain("Keep every ink line exactly as it is");
  });
});

describe("horizon sketch", () => {
  let db: DB;
  beforeEach(() => { db = createDb(":memory:"); });

  const h = (r: request.Test, date = "2026-09-10") => r.set("x-device-id", DEVICE).set("x-local-date", date);

  it("without a key: the app works and simply has no sketch", async () => {
    const api = createApp(db, { client: null, sketch: { apiKey: null } });
    await h(request(api).put("/api/horizon")).send({ text: "a quiet house" });
    const home = await h(request(api).get("/api/home"));
    expect(home.body.sketch).toMatchObject({ available: false, status: "none", lineUrl: null, colorUrl: null, lit: 0, fullAt: SKETCH_FULL_AT });
    const ask = await h(request(api).post("/api/horizon/sketch"));
    expect(ask.body.status).toBe("unavailable");
  });

  it("naming the horizon draws it: line, then color from that line; served by token", async () => {
    const g = fakeGemini({ delayMs: 25 });
    const api = createApp(db, { client: null, sketch: { apiKey: "k", fetch: g.fetch, timeoutMs: 5000 } });

    const words = "Two kids and a house with light in it";
    const set = await h(request(api).put("/api/horizon")).send({ text: words });
    expect(set.status).toBe(200);
    let home = await h(request(api).get("/api/home"));
    expect(home.body.sketch.status).toBe("pending");

    // Let the background job finish (two model calls).
    await new Promise((r) => setTimeout(r, 120));
    home = await h(request(api).get("/api/home"));
    expect(home.body.sketch.status).toBe("ready");
    expect(home.body.sketch.lineUrl).toMatch(/^\/api\/sketch\/sk_[a-z0-9_]+\/line$/);
    expect(home.body.sketch.stale).toBe(false);

    // Exactly two model calls: the line, then the color as an edit OF that line.
    expect(g.calls).toHaveLength(2);
    expect(g.calls[0].contents[0].parts[0].text).toContain(`Draw me: ${words}`);
    expect(g.calls[1].contents[0].parts[0].inlineData.data).toBe(PNG.toString("base64"));
    expect(g.calls[1].contents[0].parts[1].text).toBe(colorPrompt());

    // Public image routes.
    const line = await request(api).get(home.body.sketch.lineUrl);
    expect(line.status).toBe(200);
    expect(line.headers["content-type"]).toContain("image/png");
    const color = await request(api).get(home.body.sketch.colorUrl);
    expect(color.status).toBe(200);
    const nope = await request(api).get("/api/sketch/sk_nope/line");
    expect(nope.status).toBe(404);

    // Asking again does not draw again.
    const again = await h(request(api).post("/api/horizon/sketch"));
    expect(again.body.status).toBe("ready");
    expect(g.calls).toHaveLength(2);
  });

  it("a failed first draw is reported and never breaks the horizon", async () => {
    const g = fakeGemini({ fail: true });
    const api = createApp(db, { client: null, sketch: { apiKey: "k", fetch: g.fetch, timeoutMs: 5000 } });
    await h(request(api).put("/api/horizon")).send({ text: "the sea" });
    await new Promise((r) => setTimeout(r, 30));
    const home = await h(request(api).get("/api/home"));
    expect(home.body.horizon).toBe("the sea");
    expect(home.body.sketch.status).toBe("failed");
    expect(home.body.sketch.lineUrl).toBeNull();
  });

  it("renaming redraws, but only up to the cap; the old pictures stay", async () => {
    const g = fakeGemini();
    const api = createApp(db, { client: null, sketch: { apiKey: "k", fetch: g.fetch, timeoutMs: 5000 } });
    for (let i = 0; i < SKETCH_MAX_DRAWS + 2; i++) {
      await h(request(api).put("/api/horizon")).send({ text: `horizon version ${i}` });
      await new Promise((r) => setTimeout(r, 40));
    }
    expect(g.calls).toHaveLength(SKETCH_MAX_DRAWS * 2);
    const home = await h(request(api).get("/api/home"));
    expect(home.body.sketch.status).toBe("ready");
    expect(home.body.sketch.stale).toBe(true); // words moved on, picture did not
    const ask = await h(request(api).post("/api/horizon/sketch"));
    expect(ask.body.status).toBe("capped");
  });

  it("colour comes from THIS wish's own days — a road is not a wish", async () => {
    const api = createApp(db, { client: null, sketch: { apiKey: null } });
    await h(request(api).put("/api/horizon")).send({ text: "a body I trust" });
    await h(request(api).post("/api/journey")).send({ enduring: "the gym", hope: "to feel at home in my body" });

    await h(request(api).post("/api/journey/step"), "2026-09-01").send({ text: "walk" });
    await h(request(api).post("/api/journey/step/resolve"), "2026-09-01").send({ done: true });
    await h(request(api).post("/api/journey/dark-night"), "2026-09-04").send({ text: "I skipped again" });

    // A person can keep several wishes now. Days spent on a road they started
    // separately do not colour in a wish those days were never for.
    let home = await h(request(api).get("/api/home"));
    expect(home.body.sketch.lit).toBe(0);

    // Its own days do — and all three answers count exactly the same.
    await h(request(api).post("/api/deed"), "2026-09-05").send({ kind: "did", text: "walked to the corner" });
    await h(request(api).post("/api/deed"), "2026-09-06").send({ kind: "stayed" });
    await h(request(api).post("/api/deed"), "2026-09-07").send({ kind: "stuck" });
    home = await h(request(api).get("/api/home"));
    expect(home.body.sketch.lit).toBe(3);
  });

  it("each wish keeps its own colour", async () => {
    const api = createApp(db, { client: null, sketch: { apiKey: null } });
    await h(request(api).put("/api/horizon")).send({ text: "a body I trust" });
    await h(request(api).post("/api/deed"), "2026-09-01").send({ kind: "stayed" });

    const second = await h(request(api).post("/api/wishes")).send({ text: "a quiet house by the sea" });
    const home = await h(request(api).get("/api/home"));
    expect(home.body.horizon).toBe("a quiet house by the sea");
    expect(home.body.sketch.lit).toBe(0); // a new wish starts colourless

    const all = await h(request(api).get("/api/wishes"));
    const byText = Object.fromEntries(all.body.wishes.map((w: any) => [w.text, w]));
    expect(byText["a body I trust"].days).toBe(1);
    expect(byText["a quiet house by the sea"].days).toBe(0);
    expect(all.body.currentId).toBe(second.body.wishId);
  });
});
