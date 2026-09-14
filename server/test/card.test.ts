// The road card and the deeds.
//
// The invariants this guards:
//   • Every card in the deck says the wish CAN happen. None of them says no.
//   • The card is drawn ONCE. Drawing it seals the words forever.
//   • Without a model the card is deterministic — a flaky network can never
//     quietly hand someone a different card than the one they were given.
//   • 'stayed' (I endured and kept going) counts EXACTLY as much as 'did'.
//     That is the heart of the app; if this test ever fails, the app is wrong.

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createDb, type DB } from "../src/db";
import { createApp } from "../src/app";
import { ROAD_CARDS, CARD_IDS, fallbackCard, cardPrompt } from "../src/lib/roadcards";
import { chooseRoadCard, type MessagesClient } from "../src/lib/anthropic";

const DEVICE = "device-card-0001";

function replying(text: string): MessagesClient {
  return {
    messages: { create: async () => ({ content: [{ type: "text", text }] }) },
  } as unknown as MessagesClient;
}

describe("the deck", () => {
  it("has twelve cards with unique ids, a name, a line and a when", () => {
    expect(ROAD_CARDS).toHaveLength(12);
    expect(new Set(CARD_IDS).size).toBe(12);
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

  it("the fallback is stable: the same wish always draws the same card", () => {
    const wish = "یک زندگی زیبا با دو بچه";
    expect(fallbackCard(wish).id).toBe(fallbackCard(wish).id);
    expect(CARD_IDS).toContain(fallbackCard(wish).id);
    // Different wishes are not all funnelled into one card.
    const ids = new Set(
      ["a house by the sea", "to finish my degree", "to feel at home in my body", "my own company"].map(
        (w) => fallbackCard(w).id,
      ),
    );
    expect(ids.size).toBeGreaterThan(1);
  });

  it("the prompt quotes the wish verbatim and asks for an id only", () => {
    const p = cardPrompt("a quiet house and work I am proud of");
    expect(p).toContain("a quiet house and work I am proud of");
    expect(p).toContain("ONLY the id");
    for (const id of CARD_IDS) expect(p).toContain(id);
  });
});

describe("choosing the card", () => {
  it("takes the model's id when it is on the deck", async () => {
    const out = await chooseRoadCard("I want to move to another country", { client: replying("boat") });
    expect(out).toEqual({ id: "boat", fallback: false });
  });

  it("tolerates a chatty model", async () => {
    const out = await chooseRoadCard("x", { client: replying("The card is: ladder.") });
    expect(out.id).toBe("ladder");
  });

  it("falls back deterministically on nonsense, on an error, and with no key", async () => {
    const wish = "a life I am not ashamed of";
    const expected = fallbackCard(wish).id;
    expect((await chooseRoadCard(wish, { client: replying("banana") })).id).toBe(expected);
    expect((await chooseRoadCard(wish, { client: null })).id).toBe(expected);
    const broken = { messages: { create: async () => { throw new Error("boom"); } } } as unknown as MessagesClient;
    expect((await chooseRoadCard(wish, { client: broken })).id).toBe(expected);
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
    expect(drawn.body.card.id).toBe("crown");
    expect(drawn.body.card.name).toBe("The Crown");
    // The model's private hint about when a card fits never leaves the server.
    expect(drawn.body.card.when).toBeUndefined();
    expect(drawn.body.alreadyDrawn).toBe(false);

    // Sealed: the words can never be edited again.
    const after = await h(request(api).put("/api/horizon")).send({ text: "something else entirely" });
    expect(after.status).toBe(409);
    expect(after.body.error).toBe("sealed");
    const home = await h(request(api).get("/api/home"));
    expect(home.body.horizon).toBe("to be someone I am proud of");
    expect(home.body.sealed).toBe(true);
    expect(home.body.card).toMatchObject({ id: "crown", name: "The Crown" });
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
