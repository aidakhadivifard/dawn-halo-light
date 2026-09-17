// Hearing what someone actually wished for.
//
// What these tests protect, in order of how badly it would hurt to lose it:
//   1. Nothing is invented. The app may tidy her words; it may never add a
//      wish she did not write.
//   2. Writing a wish NEVER dead-ends. With no model, a slow model, or a model
//      answering nonsense, she still gets an answer she can act on.
//   3. "Nothing is lost" is true before it is said. The wishes she did not
//      pick are on the shelf, and they are still there tomorrow.
//   4. One wish stays in her exact words. The split is for people who wrote
//      several things, not a licence to rewrite a single sentence.

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createDb, type DB } from "../src/db";
import { createApp } from "../src/app";
import { hearWishes, type MessagesClient } from "../src/lib/anthropic";
import { parseHeard, fallbackHearing, hearPrompt, MAX_WISHES } from "../src/lib/hearing";

const DEVICE = "device-hear-0001";

function replying(text: string): MessagesClient {
  return { messages: { create: async () => ({ content: [{ type: "text", text }] }) } } as unknown as MessagesClient;
}

const FIVE = [
  "I wish for smaller stomache",
  "Being wealthy",
  "Do sports",
  "I wish i had 2 kids and alot of money",
  "Pinkwallet was successful and i was a part of it",
].join("\n");

describe("reading the model's answer", () => {
  it("takes the wishes out of JSON, even wrapped in chatter", () => {
    const got = parseHeard(
      'Sure! Here you go:\n{"wishes":[{"label":"Have two children","echo":"having two children"},' +
        '{"label":"Become wealthy","echo":"becoming wealthy"}]}\nHope that helps.',
    );
    expect(got).toEqual([
      { label: "Have two children", echo: "having two children" },
      { label: "Become wealthy", echo: "becoming wealthy" },
    ]);
  });

  it("derives the spoken phrase when the model forgot one", () => {
    expect(parseHeard('{"wishes":[{"label":"Become wealthy"}]}')).toEqual([
      { label: "Become wealthy", echo: "become wealthy" },
    ]);
  });

  it("drops repeats and never returns more than the cap", () => {
    const many = Array.from({ length: 12 }, (_, i) => `{"label":"Wish ${i}","echo":"wish ${i}"}`);
    expect(parseHeard(`{"wishes":[${many.join(",")}]}`)!.length).toBe(MAX_WISHES);
    expect(parseHeard('{"wishes":[{"label":"Do sports"},{"label":"do sports"}]}')!.length).toBe(1);
  });

  it("refuses to guess at a broken answer", () => {
    expect(parseHeard("no json here")).toBeNull();
    expect(parseHeard('{"wishes":"not a list"}')).toBeNull();
    expect(parseHeard('{"wishes":[]}')).toBeNull();
    expect(parseHeard('{"wishes":[{"label":"   "}]}')).toBeNull();
  });
});

describe("hearing without a model", () => {
  it("splits the way people actually write a list", () => {
    const got = fallbackHearing(FIVE);
    expect(got.length).toBe(5);
    expect(got[1].label).toBe("Being wealthy");
    expect(got.map((w) => w.label)).toContain("Do sports");
  });

  it("strips bullets and splits on semicolons too", () => {
    const got = fallbackHearing("- move to the sea; • finish the book");
    expect(got.map((w) => w.label)).toEqual(["move to the sea", "finish the book"]);
  });

  it("one sentence is one wish, in exactly her words", () => {
    const words = "I want to feel at home in my own body again";
    const got = fallbackHearing(words);
    expect(got.length).toBe(1);
    expect(got[0].label).toBe(words);
  });
});

describe("asking the model", () => {
  it("carries her words verbatim and forbids inventing", () => {
    const p = hearPrompt(FIVE, "en");
    expect(p).toContain("Pinkwallet was successful");
    expect(p).toContain("Add nothing they did not write");
    // The rule that stops it shattering one wish into pieces.
    expect(p).toContain("could come true without the other");
  });

  it("asks for the answer in her language", () => {
    expect(hearPrompt("x", "fa")).toContain("Persian");
    expect(hearPrompt("x", "en")).toContain("English");
  });

  it("uses the model's split when it answers well", async () => {
    const out = await hearWishes(FIVE, "en", {
      client: replying('{"wishes":[{"label":"Have two children","echo":"having two children"}]}'),
    });
    expect(out.fallback).toBe(false);
    expect(out.wishes[0].label).toBe("Have two children");
  });

  it("still answers when there is no model at all", async () => {
    const out = await hearWishes(FIVE, "en", { client: null });
    expect(out.fallback).toBe(true);
    expect(out.wishes.length).toBe(5);
  });

  it("still answers when the model returns rubbish", async () => {
    const out = await hearWishes(FIVE, "en", { client: replying("I'm afraid I can't help with that.") });
    expect(out.fallback).toBe(true);
    expect(out.wishes.length).toBe(5);
  });

  it("still answers when the model hangs", async () => {
    const hanging = {
      messages: { create: () => new Promise(() => {}) },
    } as unknown as MessagesClient;
    const out = await hearWishes(FIVE, "en", { client: hanging, timeoutMs: 20 });
    expect(out.fallback).toBe(true);
    expect(out.wishes.length).toBe(5);
  });
});

describe("choosing one and keeping the rest", () => {
  let db: DB;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    db = createDb(":memory:");
    app = createApp(db, { client: null });
  });

  const put = (body: object) =>
    request(app).put("/api/horizon").set("x-device-id", DEVICE).send(body);
  const wishes = () => request(app).get("/api/wishes").set("x-device-id", DEVICE);
  const texts = (res: { body: { wishes: { text: string }[] } }) => res.body.wishes.map((w) => w.text);

  it("says back what it heard without saving anything", async () => {
    const res = await request(app)
      .post("/api/wish/hear")
      .set("x-device-id", DEVICE)
      .send({ text: FIVE, lang: "en" })
      .expect(200);
    expect(res.body.wishes.length).toBe(5);
    // Nothing committed: the person has not chosen yet.
    const home = await request(app).get("/api/home").set("x-device-id", DEVICE).expect(200);
    expect(home.body.horizon).toBeNull();
    expect((await wishes().expect(200)).body.wishes).toEqual([]);
  });

  it("the chosen wish is opened and the others are written down beside it", async () => {
    await put({ text: "Have two children", park: ["Become wealthy", "Do sports"], lang: "en" }).expect(200);

    const home = await request(app).get("/api/home").set("x-device-id", DEVICE).expect(200);
    expect(home.body.horizon).toBe("Have two children");

    const list = await wishes().expect(200);
    expect(texts(list)).toEqual(["Have two children", "Become wealthy", "Do sports"]);
    // The ones still waiting have no card, and they are not the open one.
    const waiting = list.body.wishes.filter((w: { card: unknown }) => !w.card);
    expect(waiting.length).toBe(3);
    expect(list.body.currentId).toBe(
      list.body.wishes.find((w: { text: string }) => w.text === "Have two children").id,
    );
  });

  it("never writes down the wish she is actually living twice", async () => {
    await put({ text: "Do sports", park: ["Do sports", "Become wealthy"] }).expect(200);
    expect(texts(await wishes())).toEqual(["Do sports", "Become wealthy"]);
  });

  it("rewriting the wish does not double the list", async () => {
    await put({ text: "Have two children", park: ["Become wealthy"] }).expect(200);
    await put({ text: "Have two children", park: ["Become wealthy"] }).expect(200);
    expect(texts(await wishes())).toEqual(["Have two children", "Become wealthy"]);
  });

  it("the list belongs to one person only", async () => {
    await put({ text: "Have two children", park: ["Become wealthy"] }).expect(200);
    const other = await request(app).get("/api/wishes").set("x-device-id", "device-hear-0002");
    expect(other.body.wishes).toEqual([]);
  });

  it("a sealed wish cannot be re-heard or renamed", async () => {
    await put({ text: "Have two children", park: [] }).expect(200);
    await request(app).post("/api/card").set("x-device-id", DEVICE).expect(200);
    await request(app)
      .post("/api/wish/hear")
      .set("x-device-id", DEVICE)
      .send({ text: FIVE })
      .expect(409);
    await put({ text: "Something else entirely" }).expect(409);
  });

  it("but another wish can always be begun — and the sealed one keeps its card", async () => {
    await put({ text: "Have two children", park: ["Become wealthy"] }).expect(200);
    await request(app).post("/api/card").set("x-device-id", DEVICE).expect(200);

    // Take the one that was waiting.
    const list = await wishes();
    const waiting = list.body.wishes.find((w: { text: string }) => w.text === "Become wealthy");
    await request(app).post(`/api/wishes/${waiting.id}/open`).set("x-device-id", DEVICE).expect(200);

    const home = await request(app).get("/api/home").set("x-device-id", DEVICE);
    expect(home.body.horizon).toBe("Become wealthy");
    expect(home.body.card).toBeNull(); // its own road has not been asked for yet
    expect(home.body.sealed).toBe(false);

    // And the first one is exactly where she left it.
    const after = await wishes();
    const first = after.body.wishes.find((w: { text: string }) => w.text === "Have two children");
    expect(first.card).not.toBeNull();
  });

  it("a wish begun from scratch opens straight away", async () => {
    await put({ text: "Have two children" }).expect(200);
    await request(app).post("/api/card").set("x-device-id", DEVICE).expect(200);

    const made = await request(app)
      .post("/api/wishes")
      .set("x-device-id", DEVICE)
      .send({ text: "A quiet house by the sea" })
      .expect(200);
    const home = await request(app).get("/api/home").set("x-device-id", DEVICE);
    expect(home.body.horizon).toBe("A quiet house by the sea");
    expect(home.body.wishId).toBe(made.body.wishId);
  });

  it("one person's wish cannot be opened by another", async () => {
    await put({ text: "Have two children", park: ["Become wealthy"] }).expect(200);
    const mine = (await wishes()).body.wishes[0].id;
    await request(app).post(`/api/wishes/${mine}/open`).set("x-device-id", "device-hear-0002").expect(404);
  });

  it("today's answer belongs to the wish it was given for", async () => {
    await put({ text: "Have two children" }).expect(200);
    await request(app)
      .post("/api/deed")
      .set("x-device-id", DEVICE)
      .set("x-local-date", "2026-09-17")
      .send({ kind: "stayed" })
      .expect(200);

    await request(app)
      .post("/api/wishes")
      .set("x-device-id", DEVICE)
      .send({ text: "A quiet house by the sea" })
      .expect(200);

    // The new wish has not been answered today, even though the day has been.
    const home = await request(app)
      .get("/api/home")
      .set("x-device-id", DEVICE)
      .set("x-local-date", "2026-09-17");
    expect(home.body.todayDeed).toBeNull();
  });
});
