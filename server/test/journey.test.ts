// The Vow (journey): day math, the witness lines, the one-vow rule, keepsakes,
// and the crisis gate on every input path.

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createDb, type DB } from "../src/db";
import { createApp } from "../src/app";
import type { MessagesClient } from "../src/lib/anthropic";
import { dayNumber, daysBetween, darkNightContext } from "../src/lib/journey";

const vowCard = {
  opener: "This card stepped forward to walk with you…",
  title: "The Long Road",
  message: "The weight is real.\n\nThe hope is yours; the card keeps it company.\n\nWhat holds is you, staying.",
  reflection: "What will you want to remember on the hardest night?",
  theme: "guidance_decision",
};

function fakeClient(): MessagesClient {
  return {
    messages: {
      create: async () => ({ content: [{ type: "text", text: JSON.stringify(vowCard) }] }),
    },
  };
}

const DEVICE = "device-vow-0001";

function makeApp(db: DB) {
  return createApp(db, { client: fakeClient() });
}

describe("journey day math", () => {
  it("day 1 on the day the vow is made", () => {
    expect(dayNumber("2026-06-01", "2026-06-01")).toBe(1);
  });
  it("counts across months", () => {
    expect(dayNumber("2026-06-01", "2026-07-01")).toBe(31);
  });
  it("never drops below 1 when the clock moves backwards", () => {
    expect(dayNumber("2026-06-10", "2026-06-08")).toBe(1);
  });
  it("daysBetween is whole days", () => {
    expect(daysBetween("2026-06-01", "2026-06-04")).toBe(3);
  });
});

describe("dark night witness lines", () => {
  const journey = { started_local_date: "2026-06-01", card_title: "The Long Road" };

  it("first night: day number, recorded, card unchanged", () => {
    const ctx = darkNightContext({ journey, priorNights: [], todayLocalDate: "2026-06-16" });
    expect(ctx.journeyDay).toBe(16);
    expect(ctx.nightNumber).toBe(1);
    expect(ctx.daysSincePrevious).toBeNull();
    expect(ctx.line).toContain("Day 16");
    expect(ctx.line).toContain("The Long Road");
  });

  it("later night references the gap since the previous one", () => {
    const ctx = darkNightContext({
      journey,
      priorNights: [{ local_date: "2026-06-05" }, { local_date: "2026-06-10" }],
      todayLocalDate: "2026-06-20",
    });
    expect(ctx.nightNumber).toBe(3);
    expect(ctx.daysSincePrevious).toBe(10);
    expect(ctx.line).toContain("night 3");
    expect(ctx.line).toContain("10 days ago");
  });

  it("clustered nights get the gentler line, not the 'you came through it' one", () => {
    const ctx = darkNightContext({
      journey,
      priorNights: [{ local_date: "2026-06-19" }],
      todayLocalDate: "2026-06-20",
    });
    expect(ctx.line).toContain("cluster");
  });
});

describe("vow API (e2e)", () => {
  let db: DB;
  let api: ReturnType<typeof createApp>;

  beforeEach(() => {
    db = createDb(":memory:");
    api = makeApp(db);
  });

  const h = (r: request.Test, date = "2026-06-01") =>
    r.set("x-device-id", DEVICE).set("x-local-date", date);

  it("create -> read -> dark night -> close(fulfilled) -> public keepsake", async () => {
    // No vow yet.
    const none = await h(request(api).get("/api/journey"));
    expect(none.body.journey).toBeNull();

    // Make the vow.
    const created = await h(request(api).post("/api/journey")).send({
      enduring: "my product makes no money yet",
      hope: "it starts paying my rent",
    });
    expect(created.status).toBe(200);
    expect(created.body.journey.card.title).toBe("The Long Road");
    expect(created.body.journey.dayNumber).toBe(1);

    // A second vow is refused while one is active — never quietly replaced.
    const again = await h(request(api).post("/api/journey")).send({
      enduring: "x",
      hope: "y",
    });
    expect(again.status).toBe(409);

    // Two weeks later: day number counts, dark night is witnessed.
    const later = "2026-06-16";
    const snap = await h(request(api).get("/api/journey"), later);
    expect(snap.body.journey.dayNumber).toBe(16);

    const night = await h(request(api).post("/api/journey/dark-night"), later).send({
      text: "I think I'm wasting my time",
    });
    expect(night.status).toBe(200);
    expect(night.body.context.nightNumber).toBe(1);
    expect(night.body.context.journeyDay).toBe(16);

    // Close as fulfilled; keepsake is public.
    const closed = await h(request(api).post("/api/journey/close"), "2026-07-10").send({
      outcome: "fulfilled",
      note: "first paying customer",
    });
    expect(closed.status).toBe(200);
    expect(closed.body.keepsake.daysHeld).toBe(40);
    expect(closed.body.keepsake.darkNights).toBe(1);
    const token = closed.body.journey.keepsakeToken;
    expect(token).toBeTruthy();

    const pub = await request(api).get(`/api/keepsake/${token}`); // no device header
    expect(pub.status).toBe(200);
    expect(pub.body.keepsake.status).toBe("fulfilled");
    expect(pub.body.keepsake.hope).toContain("rent");

    // After closing, a new vow may begin.
    const fresh = await h(request(api).post("/api/journey"), "2026-07-11").send({
      enduring: "waiting on my visa",
      hope: "approval",
    });
    expect(fresh.status).toBe(200);
  });

  it("crisis text in the vow is caught before any card is drawn", async () => {
    const res = await h(request(api).post("/api/journey")).send({
      enduring: "I want to end my life",
      hope: "peace",
    });
    expect(res.status).toBe(200);
    expect(res.body.isCrisis).toBe(true);
    expect(res.body.resources?.length).toBeGreaterThan(0);
    // And no vow was created.
    const snap = await h(request(api).get("/api/journey"));
    expect(snap.body.journey).toBeNull();
  });

  it("crisis text in a dark night is caught and the night is not logged", async () => {
    await h(request(api).post("/api/journey")).send({ enduring: "hard job", hope: "promotion" });
    const res = await h(request(api).post("/api/journey/dark-night")).send({
      text: "there's no point, I can't go on anymore",
    });
    expect(res.body.isCrisis).toBe(true);
    const snap = await h(request(api).get("/api/journey"));
    expect(snap.body.journey.darkNights.length).toBe(0);
  });

  it("empty vow fields are rejected", async () => {
    const res = await h(request(api).post("/api/journey")).send({ enduring: "", hope: "" });
    expect(res.status).toBe(400);
  });

  it("daily card generation receives the vow context", async () => {
    let seenPrompt = "";
    const spyClient: MessagesClient = {
      messages: {
        create: async (args: any) => {
          seenPrompt = args.messages?.[0]?.content ?? "";
          return { content: [{ type: "text", text: JSON.stringify(vowCard) }] };
        },
      },
    };
    const spyApi = createApp(db, { client: spyClient });
    await h(request(spyApi).post("/api/journey")).send({
      enduring: "the long wait",
      hope: "good news",
    });
    await h(request(spyApi).get("/api/cards/daily"), "2026-06-03");
    expect(seenPrompt).toContain("inside a vow");
    expect(seenPrompt).toContain("the long wait");
  });
});
