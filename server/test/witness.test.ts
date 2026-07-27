// The Witness: one chosen person sees the Day number — nothing else.
// Also covers the daily-card variety fix (the "Morning Field every morning"
// bug): the server cuts the deck, so consecutive days give different cards.

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createDb, type DB } from "../src/db";
import { createApp } from "../src/app";
import { createService } from "../src/service";
import { generateCardText, type MessagesClient } from "../src/lib/anthropic";
import { HALO_DECK } from "../src/lib/deck";

const DEVICE = "device-witness-01";

function fakeClient(json: object): MessagesClient {
  return {
    messages: {
      create: async () => ({ content: [{ type: "text", text: JSON.stringify(json) }] }),
    },
  };
}

/** A model that always answers with the same on-the-nose daily card. */
const convergentClient = fakeClient({
  opener: "Here — this is the card that wanted to be seen today…",
  title: "The Morning Field",
  message: "The morning asks for your presence, not your hurry.",
  reflection: "What would it feel like to begin today without hurrying?",
  theme: "daily_general",
});

describe("daily card variety (server cuts the deck)", () => {
  let db: DB;

  beforeEach(() => {
    db = createDb(":memory:");
  });

  it("different days give different cards even when the model converges", async () => {
    const svc = createService(db, { client: convergentClient });
    const titles = new Set<string>();
    for (let day = 1; day <= 7; day++) {
      const date = `2026-07-${String(day + 10).padStart(2, "0")}`;
      const card = await svc.getDailyCard(DEVICE, date);
      titles.add(card.title);
    }
    // Recent-title exclusion guarantees 7 consecutive days = 7 distinct cards.
    expect(titles.size).toBe(7);
  });

  it("the daily card is stable within one day (idempotent)", async () => {
    const svc = createService(db, { client: convergentClient });
    const a = await svc.getDailyCard(DEVICE, "2026-07-20");
    const b = await svc.getDailyCard(DEVICE, "2026-07-20");
    expect(a.title).toBe(b.title);
    expect(a.id).toBe(b.id);
  });

  it("a forced card keeps its title through the fallback path too", async () => {
    const drawn = HALO_DECK[3];
    const r = await generateCardText(
      { intent: "general", forcedCard: drawn },
      { client: null },
    );
    expect(r.fallback).toBe(true);
    expect(r.title).toBe(drawn.title);
    expect(r.theme).toBe(drawn.theme);
    expect(r.message).toContain(drawn.essence);
  });

  it("a forced card overrides whatever title the model returns", async () => {
    const drawn = HALO_DECK.find((c) => c.title === "The Distant Lantern")!;
    const r = await generateCardText(
      { intent: "general", forcedCard: drawn },
      { client: convergentClient },
    );
    expect(r.fallback).toBe(false);
    expect(r.title).toBe("The Distant Lantern");
    expect(r.theme).toBe(drawn.theme);
  });
});

describe("witness (e2e)", () => {
  let db: DB;
  let api: ReturnType<typeof createApp>;

  beforeEach(() => {
    db = createDb(":memory:");
    api = createApp(db, { client: null });
  });

  const headers = { "x-device-id": DEVICE, "x-local-date": "2026-07-10" };

  async function createGoal() {
    await request(api)
      .post("/api/goal")
      .set(headers)
      .send({ title: "hold on through the visa wait", reward: "a real vacation", targetDate: "2026-12-01" })
      .expect(200);
  }

  it("requires an active goal to create an invite", async () => {
    const res = await request(api).post("/api/goal/witness").set(headers);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("no_active_goal");
  });

  it("creates an invite and reuses the same token", async () => {
    await createGoal();
    const a = await request(api).post("/api/goal/witness").set(headers).expect(200);
    const b = await request(api).post("/api/goal/witness").set(headers).expect(200);
    expect(a.body.token).toBeTruthy();
    expect(a.body.url).toContain(`/witness/${a.body.token}`);
    expect(b.body.token).toBe(a.body.token);
  });

  it("the public view shows Day + returns count and NEVER the goal title", async () => {
    await createGoal();
    await request(api).post("/api/goal/checkin").set(headers).send({ state: "barely" }).expect(200);
    const { body: invite } = await request(api).post("/api/goal/witness").set(headers).expect(200);

    // No device headers — a plain browser tab.
    const res = await request(api).get(`/api/witness/${invite.token}?date=2026-07-12`).expect(200);
    expect(res.body.active).toBe(true);
    expect(res.body.day).toBe(3); // day 1 = 2026-07-10
    expect(res.body.checkinCount).toBe(1);
    expect(res.body.showedUpToday).toBe(false);

    // Privacy is the feature: nothing intimate crosses the wire.
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain("visa");
    expect(raw).not.toContain("vacation");
    expect(raw).not.toContain("barely");
  });

  it("reports showedUpToday on the check-in day itself", async () => {
    await createGoal();
    await request(api).post("/api/goal/checkin").set(headers).send({ state: "strong" }).expect(200);
    const { body: invite } = await request(api).post("/api/goal/witness").set(headers).expect(200);
    const res = await request(api).get(`/api/witness/${invite.token}?date=2026-07-10`).expect(200);
    expect(res.body.showedUpToday).toBe(true);
  });

  it("a closed goal turns the view inactive without erroring", async () => {
    await createGoal();
    const { body: invite } = await request(api).post("/api/goal/witness").set(headers).expect(200);
    await request(api).post("/api/goal/close").set(headers).send({ reason: "abandoned" }).expect(200);
    const res = await request(api).get(`/api/witness/${invite.token}`).expect(200);
    expect(res.body.active).toBe(false);
  });

  it("an unknown token 404s", async () => {
    await request(api).get("/api/witness/nope").expect(404);
  });
});
