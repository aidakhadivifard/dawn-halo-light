// The road card and the deeds.
//
// The invariants this guards:
//   • No card in the deck says no. Not every road is easy, but none of them
//     is a refusal — and the app never tells anyone that, it just never deals
//     one. (The reading's own rules live in reading.test.ts.)
//   • The card is DRAWN, not chosen. Nothing reads the wish and decides what
//     it deserves; the Oracle is not a judge.
//   • A card cannot come back until three others have, and will not follow one
//     that means nearly the same thing. A draw that repeats looks rigged.
//   • The card is drawn ONCE per wish. Drawing it seals the words forever.
//   • 'stayed' (I endured and kept going) counts EXACTLY as much as 'did'.
//     That is the heart of the app; if this test ever fails, the app is wrong.

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createDb, type DB } from "../src/db";
import { createApp } from "../src/app";
import { ROAD_CARDS, CARD_IDS, fallbackCard, pickRoadCard, NO_REPEAT_WITHIN } from "../src/lib/roadcards";
import { type MessagesClient } from "../src/lib/anthropic";

const DEVICE = "device-card-0001";

function replying(text: string): MessagesClient {
  return {
    messages: { create: async () => ({ content: [{ type: "text", text }] }) },
  } as unknown as MessagesClient;
}

describe("the deck", () => {
  it("every card has an id, a name, a line and a when", () => {
    expect(ROAD_CARDS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(CARD_IDS).size).toBe(ROAD_CARDS.length);
    for (const c of ROAD_CARDS) {
      expect(c.name.length).toBeGreaterThan(2);
      expect(c.line.length).toBeGreaterThan(8);
      expect(c.when.length).toBeGreaterThan(8);
      // Reducible to one small badge: a single memorable noun.
      expect(c.id).toMatch(/^[a-z]+$/);
    }
  });

  it("no card says no — the deck only ever describes the shape of the road", () => {
    for (const c of ROAD_CARDS) {
      // "You can't see the end" is fine — that is the road, not the wish.
      // What may never appear is a refusal of the wish itself.
      expect(c.line.toLowerCase()).not.toMatch(
        /\b(never happen|won't happen|not going to happen|impossible|give up|let it go)\b/,
      );
    }
  });

  it("the roads are not all the same road", () => {
    // Open, slow, steep, helped, unclear, and one that asks for something to
    // be put down first. A deck where every card is encouragement in the same
    // key is a deck nobody believes.
    for (const id of ["key", "ladder", "mountain", "lantern", "compass", "stone", "bridge"]) {
      expect(CARD_IDS).toContain(id);
    }
  });
});

describe("drawing from the deck", () => {
  it("is a real draw — the wish is never read", () => {
    // Every card must be reachable; nothing is filtered by what someone wants.
    const seen = new Set<string>();
    for (let i = 0; i < ROAD_CARDS.length; i++) {
      seen.add(pickRoadCard([], () => i / ROAD_CARDS.length).id);
    }
    expect(seen.size).toBe(ROAD_CARDS.length);
  });

  it("spreads over the deck rather than favouring a card", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 3000; i++) {
      const id = pickRoadCard([]).id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    expect(counts.size).toBe(ROAD_CARDS.length);
    const expected = 3000 / ROAD_CARDS.length;
    for (const n of counts.values()) {
      expect(n).toBeGreaterThan(expected * 0.5);
      expect(n).toBeLessThan(expected * 1.8);
    }
  });

  it("never repeats a card until three others have been drawn", () => {
    const recent = ["ladder", "boat", "crown"];
    for (let i = 0; i < 400; i++) {
      expect(recent.slice(0, NO_REPEAT_WITHIN)).not.toContain(pickRoadCard(recent).id);
    }
  });

  it("does not follow a card with one that means nearly the same", () => {
    for (let i = 0; i < 400; i++) {
      expect(pickRoadCard(["key"]).id).not.toBe("door");
      expect(pickRoadCard(["ladder"]).id).not.toBe("mountain");
      expect(pickRoadCard(["boat"]).id).not.toBe("bridge");
      expect(pickRoadCard(["sun"]).id).not.toBe("lantern");
    }
  });

  it("still deals a card when the rules leave nothing", () => {
    // More history than deck: the rules relax rather than dealing nothing.
    const everything = CARD_IDS.slice();
    expect(pickRoadCard(everything).id).toBeTruthy();
    expect(CARD_IDS).toContain(pickRoadCard(everything).id);
  });

  it("a real person's run of draws has no repeat inside three", () => {
    const history: string[] = [];
    for (let i = 0; i < 60; i++) {
      const id = pickRoadCard(history).id;
      expect(history.slice(0, NO_REPEAT_WITHIN)).not.toContain(id);
      history.unshift(id);
    }
    expect(new Set(history).size).toBeGreaterThan(6);
  });

  it("the reproducible draw is still there for when one is needed", () => {
    const wish = "یک زندگی زیبا با دو بچه";
    expect(fallbackCard(wish).id).toBe(fallbackCard(wish).id);
    expect(CARD_IDS).toContain(fallbackCard(wish).id);
  });
});

describe("drawing the card seals the wish", () => {
  let db: DB;
  let api: ReturnType<typeof createApp>;

  beforeEach(() => {
    db = createDb(":memory:");
    api = createApp(db, { client: replying("crown") });
  });

  const h = (r: request.Test, date = "2026-09-01") =>
    r.set("x-device-id", DEVICE).set("x-local-date", date);

  it("no horizon, no card", async () => {
    const res = await h(request(api).post("/api/card"));
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("no_horizon");
  });

  it("draws once, then refuses every edit of the wish — forever", async () => {
    await h(request(api).put("/api/horizon")).send({ text: "to be someone my daughter is proud of" });
    // Before the card, the words are still hers to change.
    const edit = await h(request(api).put("/api/horizon")).send({ text: "to be someone I am proud of" });
    expect(edit.status).toBe(200);

    const drawn = await h(request(api).post("/api/card"));
    expect(drawn.status).toBe(200);
    expect(CARD_IDS).toContain(drawn.body.card.id);
    expect(drawn.body.card.name.length).toBeGreaterThan(2);
    // The deck's private note about when a card fits never leaves the server.
    expect(drawn.body.card.when).toBeUndefined();
    expect(drawn.body.alreadyDrawn).toBe(false);

    // Sealed: the words can never be edited again.
    const after = await h(request(api).put("/api/horizon")).send({ text: "something else entirely" });
    expect(after.status).toBe(409);
    expect(after.body.error).toBe("sealed");
    const home = await h(request(api).get("/api/home"));
    expect(home.body.horizon).toBe("to be someone I am proud of");
    expect(home.body.sealed).toBe(true);
    expect(home.body.card).toMatchObject({ id: drawn.body.card.id, name: drawn.body.card.name });
  });

  it("drawing again returns the same card — it is never redrawn", async () => {
    await h(request(api).put("/api/horizon")).send({ text: "my own business" });
    const first = await h(request(api).post("/api/card"));

    // Even if the model would now answer differently.
    api = createApp(db, { client: replying("boat") });
    const again = await h(request(api).post("/api/card"));
    expect(again.body.card.id).toBe(first.body.card.id);
    expect(again.body.alreadyDrawn).toBe(true);
  });
});

describe("the deeds — both answers count the same", () => {
  let db: DB;
  let api: ReturnType<typeof createApp>;

  beforeEach(() => {
    db = createDb(":memory:");
    api = createApp(db, { client: null });
  });

  const h = (r: request.Test, date = "2026-09-01") =>
    r.set("x-device-id", DEVICE).set("x-local-date", date);

  it("'I kept going' needs no words and brings back exactly as much color as 'I did something'", async () => {
    await h(request(api).put("/api/horizon")).send({ text: "a body I trust" });

    const stayed = await h(request(api).post("/api/deed")).send({ kind: "stayed" });
    expect(stayed.status).toBe(200);
    expect(stayed.body.deed.kind).toBe("stayed");
    expect(stayed.body.deed.text).toBeNull();
    const litAfterStaying = stayed.body.sketch.lit;
    expect(litAfterStaying).toBe(1);

    const did = await h(request(api).post("/api/deed"), "2026-09-02").send({
      kind: "did",
      text: "walked for ten minutes",
    });
    expect(did.body.deed.text).toBe("walked for ten minutes");
    // One more — the same weight. Enduring is not worth less than doing.
    expect(did.body.sketch.lit).toBe(litAfterStaying + 1);
  });

  it("'I did something' without saying what is refused; crisis words are met with care, not stored", async () => {
    const empty = await h(request(api).post("/api/deed")).send({ kind: "did", text: "   " });
    expect(empty.status).toBe(400);

    const crisis = await h(request(api).post("/api/deed")).send({ kind: "did", text: "I can't go on anymore" });
    expect(crisis.status).toBe(200);
    expect(crisis.body.isCrisis).toBe(true);
    const deeds = await h(request(api).get("/api/deeds"));
    expect(deeds.body.deeds).toHaveLength(0);
  });

  it("today's answer comes back on the home screen, and the book keeps them all", async () => {
    await h(request(api).put("/api/horizon")).send({ text: "a quiet house" });
    await h(request(api).post("/api/deed"), "2026-09-01").send({ kind: "stayed" });
    await h(request(api).post("/api/deed"), "2026-09-02").send({ kind: "did", text: "sent one email" });

    const today = await h(request(api).get("/api/home"), "2026-09-02");
    expect(today.body.todayDeed).toMatchObject({ kind: "did", text: "sent one email" });

    const tomorrow = await h(request(api).get("/api/home"), "2026-09-03");
    expect(tomorrow.body.todayDeed).toBeNull();

    const book = await h(request(api).get("/api/deeds"));
    expect(book.body.deeds.map((d: any) => d.kind)).toEqual(["did", "stayed"]);
  });
});
