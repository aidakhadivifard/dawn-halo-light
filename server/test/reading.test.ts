// The reading — what a card means for one particular wish.
//
// What these tests protect:
//   1. It never promises the wish will happen — one enthusiastic sentence and
//      the app is a fortune teller. And it never says the opposite either: no
//      impossible, no predicting failure, no suggesting she want something
//      smaller. A person must finish reading with somewhere to put their feet.
//   2. It keeps her concrete words. Two children are two children, not
//      "building a secure family". The moment the app paraphrases a person's
//      life into a concept, it stops sounding like it heard her.
//   3. Without a model there is NO reading — not an invented one. The card's
//      own line was written by a person and is enough on its own.
//   4. It is written once, at the draw, and then it is hers. Looking at the
//      card again does not rewrite what it said.

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createDb, type DB } from "../src/db";
import { createApp } from "../src/app";
import { cardReading, type MessagesClient } from "../src/lib/anthropic";
import { readingPrompt, cleanReading } from "../src/lib/reading";

const DEVICE = "device-read-0001";
const WISH = "I wish i had 2 kids and Pinkwallet was successful and i was a part of it";

/**
 * The reading is written in the background, so the test waits for it the way
 * the app does — by looking again.
 */
async function readingOn(app: ReturnType<typeof createApp>, device: string): Promise<string | null> {
  for (let i = 0; i < 40; i++) {
    const home = await request(app).get("/api/home").set("x-device-id", device);
    const reading = home.body?.card?.reading ?? null;
    if (reading) return reading;
    await new Promise((r) => setTimeout(r, 10));
  }
  return null;
}

function replying(text: string): MessagesClient {
  return { messages: { create: async () => ({ content: [{ type: "text", text }] }) } } as unknown as MessagesClient;
}

const INPUT = {
  wish: WISH,
  card: "The Ladder",
  line: "Yes — slowly. One rung at a time.",
  when: "a big wish made of many stages",
  lang: "en" as const,
};

describe("asking for the reading", () => {
  it("carries her wish verbatim and the card it is for", () => {
    const p = readingPrompt(INPUT);
    expect(p).toContain("I wish i had 2 kids");
    expect(p).toContain("Pinkwallet");
    expect(p).toContain("The Ladder");
  });

  it("forbids promising and abstracting", () => {
    const p = readingPrompt(INPUT);
    expect(p).toContain("promise the wish will happen");
    // The exact failure this rule exists for.
    expect(p).toContain("If they said two\n  children, say two children");
  });

  it("allows the card's own ask, and forbids running her life", () => {
    const p = readingPrompt(INPUT);
    // What the card asks is the point of the paragraph.
    expect(p).toContain("what this card asks of them, in the card's own terms");
    // A plan for her week is not.
    expect(p).toContain("no plans, no steps, no numbers, no");
  });

  it("says out loud when a wish holds several things at once", () => {
    expect(readingPrompt(INPUT)).toContain("will not move at the same speed");
  });

  it("forbids the other direction too — no impossible, no failure, no giving up", () => {
    const p = readingPrompt(INPUT);
    expect(p).toContain("impossible, unlikely, too much, or out of reach");
    expect(p).toContain("predict that\n  it will fail");
    expect(p).toContain("suggest letting it go");
    expect(p).toContain("hope and somewhere to put their feet");
  });

  it("tells it the card was drawn, and never to say it does not fit", () => {
    const p = readingPrompt(INPUT);
    expect(p).toContain("drawn, not picked to match their wish");
    expect(p).toContain("does not fit their wish, or mention how the card was chosen");
  });

  it("asks in her language", () => {
    expect(readingPrompt({ ...INPUT, lang: "fa" })).toContain("Persian");
    expect(readingPrompt(INPUT)).toContain("English");
  });
});

describe("shaping the reading", () => {
  it("keeps one paragraph and strips fences and quotes", () => {
    expect(cleanReading('```\n"Your wish holds several things you want to build."\n```')).toBe(
      "Your wish holds several things you want to build.",
    );
    expect(cleanReading("First paragraph, long enough to keep.\n\nSecond one.")).toBe(
      "First paragraph, long enough to keep.",
    );
  });

  it("refuses a scrap", () => {
    expect(cleanReading("")).toBeNull();
    expect(cleanReading("   ")).toBeNull();
    expect(cleanReading("Sure!")).toBeNull();
  });

  it("never runs long enough to become an essay", () => {
    expect(cleanReading("x".repeat(900))!.length).toBeLessThanOrEqual(420);
  });
});

describe("without a model", () => {
  it("there is no reading at all — we do not invent one", async () => {
    expect(await cardReading(INPUT, { client: null })).toBeNull();
  });

  it("a hung model is the same as no model", async () => {
    const hanging = { messages: { create: () => new Promise(() => {}) } } as unknown as MessagesClient;
    expect(await cardReading(INPUT, { client: hanging, timeoutMs: 20 })).toBeNull();
  });

  it("an empty answer is the same as no model", async () => {
    expect(await cardReading(INPUT, { client: replying("  ") })).toBeNull();
  });
});

describe("drawing the card", () => {
  let db: DB;

  beforeEach(() => {
    db = createDb(":memory:");
  });

  const reading =
    "Your wish holds two things you want to build: having two children, and seeing " +
    "Pinkwallet succeed with you as part of it. The Ladder does not ask you to reach " +
    "both today. It asks you to choose the next rung.";

  it("arrives a beat after the card, and is kept with it", async () => {
    const app = createApp(db, { client: replying(reading) });
    await request(app).put("/api/horizon").set("x-device-id", DEVICE).send({ text: WISH }).expect(200);

    // The card does not wait for the paragraph: the turn is the moment.
    const drawn = await request(app).post("/api/card").set("x-device-id", DEVICE).send({ lang: "en" }).expect(200);
    expect(drawn.body.card.id).toBeTruthy();
    expect(drawn.body.card.reading).toBeNull();

    // It lands on the wish a moment later, and stays.
    expect(await readingOn(app, DEVICE)).toBe(reading);
  });

  it("is written once — looking again does not rewrite it", async () => {
    let answer = reading;
    const client = {
      messages: { create: async () => ({ content: [{ type: "text", text: answer }] }) },
    } as unknown as MessagesClient;
    const app = createApp(db, { client });
    await request(app).put("/api/horizon").set("x-device-id", DEVICE).send({ text: WISH }).expect(200);
    await request(app).post("/api/card").set("x-device-id", DEVICE).expect(200);
    await readingOn(app, DEVICE);

    answer = "Something completely different that she never read.";
    const again = await request(app).post("/api/card").set("x-device-id", DEVICE).expect(200);
    expect(again.body.card.reading).toBe(reading);
    expect(again.body.alreadyDrawn).toBe(true);
  });

  it("the card still arrives when there is no reading to be had", async () => {
    const app = createApp(db, { client: null });
    await request(app).put("/api/horizon").set("x-device-id", DEVICE).send({ text: WISH }).expect(200);
    const drawn = await request(app).post("/api/card").set("x-device-id", DEVICE).expect(200);
    expect(drawn.body.card.id).toBeTruthy();
    expect(drawn.body.card.line).toBeTruthy();
    const home = await request(app).get("/api/home").set("x-device-id", DEVICE);
    expect(home.body.card.reading).toBeNull();
  });

  it("each wish keeps its own reading", async () => {
    let answer = "The first reading, for the first wish, long enough to be kept.";
    const client = {
      messages: { create: async () => ({ content: [{ type: "text", text: answer }] }) },
    } as unknown as MessagesClient;
    const app = createApp(db, { client });

    await request(app).put("/api/horizon").set("x-device-id", DEVICE).send({ text: WISH }).expect(200);
    await request(app).post("/api/card").set("x-device-id", DEVICE).expect(200);
    await readingOn(app, DEVICE);

    answer = "The second reading, for a different wish entirely, also long enough.";
    await request(app)
      .post("/api/wishes")
      .set("x-device-id", DEVICE)
      .send({ text: "a quiet house by the sea" })
      .expect(200);
    await request(app).post("/api/card").set("x-device-id", DEVICE).expect(200);
    await readingOn(app, DEVICE);

    const list = await request(app).get("/api/wishes").set("x-device-id", DEVICE).expect(200);
    const home = await request(app).get("/api/home").set("x-device-id", DEVICE);
    expect(home.body.horizon).toBe("a quiet house by the sea");
    expect(home.body.card.reading).toContain("second reading");
    expect(list.body.wishes.length).toBe(2);
  });

  it("the deck's private note never leaves the server", async () => {
    const app = createApp(db, { client: replying(reading) });
    await request(app).put("/api/horizon").set("x-device-id", DEVICE).send({ text: WISH }).expect(200);
    const drawn = await request(app).post("/api/card").set("x-device-id", DEVICE).expect(200);
    expect(drawn.body.card.when).toBeUndefined();
  });
});
