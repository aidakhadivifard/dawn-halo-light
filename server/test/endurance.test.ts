// "The oracle notices" — endurance-shaped questions from goal-less users
// earn a Begin Day 1 invitation; longing questions and goal-holders never do.

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createDb, type DB } from "../src/db";
import { createApp } from "../src/app";
import { detectEnduranceSeed } from "../src/lib/endurance";
import type { MessagesClient } from "../src/lib/anthropic";

const card = {
  opener: "Let me turn this over…",
  title: "The Long Road",
  message: "This card is progress that continues even when it feels invisible.",
  reflection: "What mile are you on?",
  theme: "guidance_decision",
};

const client: MessagesClient = {
  messages: { create: async () => ({ content: [{ type: "text", text: JSON.stringify(card) }] }) },
};

describe("detectEnduranceSeed", () => {
  it("catches waiting/enduring questions", () => {
    expect(detectEnduranceSeed("when will my visa come?")).toBeTruthy();
    expect(detectEnduranceSeed("will I survive this divorce")).toBeTruthy();
    expect(detectEnduranceSeed("I am quitting smoking and it is so hard")).toBeTruthy();
    expect(detectEnduranceSeed("how long until I pay off my debt?")).toBeTruthy();
  });

  it("never triggers on longing about another person's heart", () => {
    expect(detectEnduranceSeed("does he still think about me?")).toBeNull();
    expect(detectEnduranceSeed("does she love me")).toBeNull();
  });

  it("ignores short or empty text", () => {
    expect(detectEnduranceSeed("")).toBeNull();
    expect(detectEnduranceSeed("visa")).toBeNull();
  });

  it("strips the question scaffold so the seed reads like a title", () => {
    expect(detectEnduranceSeed("when will my visa come?")).toBe("my visa come");
  });
});

describe("goalSeed on draws (e2e)", () => {
  let db: DB;
  let api: ReturnType<typeof createApp>;
  const headers = { "x-device-id": "device-seed-01", "x-local-date": "2026-07-10" };

  beforeEach(() => {
    db = createDb(":memory:");
    api = createApp(db, { client });
  });

  it("an endurance question with no goal returns a goalSeed", async () => {
    const res = await request(api)
      .post("/api/cards/draw")
      .set(headers)
      .send({ intent: "ask", text: "when will my visa finally come?" })
      .expect(200);
    expect(res.body.goalSeed).toBeTruthy();
    expect(res.body.card.title).toBeTruthy();
  });

  it("an ordinary question returns no goalSeed", async () => {
    const res = await request(api)
      .post("/api/cards/draw")
      .set(headers)
      .send({ intent: "ask", text: "does he still think about me?" })
      .expect(200);
    expect(res.body.goalSeed).toBeUndefined();
  });

  it("an active goal suppresses the seed (they already have a road)", async () => {
    await request(api)
      .post("/api/goal")
      .set(headers)
      .send({ title: "the visa wait", reward: "home", targetDate: "2026-12-01" })
      .expect(200);
    const res = await request(api)
      .post("/api/cards/draw")
      .set(headers)
      .send({ intent: "ask", text: "when will my visa finally come?" })
      .expect(200);
    expect(res.body.goalSeed).toBeUndefined();
  });
});
