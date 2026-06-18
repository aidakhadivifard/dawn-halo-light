import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createDb, type DB } from "../src/db";
import { createApp } from "../src/app";
import type { MessagesClient } from "../src/lib/anthropic";

const card = {
  opener: "I'm reading the energy of today's card for you…",
  title: "Small Steady Light",
  message: "Of course today feels like a lot. Let that be true, then take one slow breath.",
  theme: "quiet_strength",
};

function fakeClient(): MessagesClient {
  return { messages: { create: async () => ({ content: [{ type: "text", text: JSON.stringify(card) }] }) } };
}

const DEVICE = "device-e2e-0001";
const TODAY = "2026-06-17";

function app(db: DB) {
  return createApp(db, {
    client: fakeClient(),
    // Bypass Stripe signature verification; return a constructed event.
    verifyStripe: () => ({
      type: "checkout.session.completed",
      data: { object: { client_reference_id: DEVICE, metadata: { deviceId: DEVICE, plan: "yearly" } } },
    }),
  });
}

describe("core journey (e2e)", () => {
  let db: DB;
  let api: ReturnType<typeof createApp>;

  beforeEach(() => {
    db = createDb(":memory:");
    api = app(db);
  });

  const h = (r: request.Test) => r.set("x-device-id", DEVICE).set("x-local-date", TODAY);

  it("health", async () => {
    const res = await request(api).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("daily card -> ask -> follow-up -> save -> calendar -> paywall -> subscribe -> unlimited", async () => {
    // Daily card (free forever)
    const daily = await h(request(api).get("/api/cards/daily"));
    expect(daily.status).toBe(200);
    expect(daily.body.card.title).toBeTruthy();
    expect(daily.body.entitlement.dailyCardFree).toBe(true);

    // Draw #1 + #2 (prompted) — daily already used 1 of 3
    const d1 = await h(request(api).post("/api/cards/draw")).send({ intent: "ask", text: "what should I focus on?" });
    expect(d1.status).toBe(200);
    const cardId = d1.body.card.id;
    const d2 = await h(request(api).post("/api/cards/draw")).send({ intent: "feel", text: "I feel scattered" });
    expect(d2.status).toBe(200);

    // Follow-up on card #1 (one allowed)
    const f1 = await h(request(api).post("/api/cards/follow-up")).send({ previousCardId: cardId, text: "where do I start?" });
    expect(f1.status).toBe(200);
    expect(f1.body.card.followUpUsed).toBe(true);
    const f2 = await h(request(api).post("/api/cards/follow-up")).send({ previousCardId: cardId, text: "and then?" });
    expect(f2.status).toBe(409);

    // Save the card, see it in saved
    const save = await h(request(api).post("/api/saved")).send({ card: d1.body.card });
    expect(save.status).toBe(200);
    const saved = await h(request(api).get("/api/saved"));
    expect(saved.body.saved.length).toBe(1);
    expect(saved.body.saved[0].id).toBe(cardId);

    // Calendar shows today with a streak of 1
    const cal = await h(request(api).get("/api/calendar"));
    expect(cal.body.streak).toBe(1);
    expect(cal.body.byDay[TODAY].length).toBeGreaterThanOrEqual(3);

    // Hit the cap: daily(1)+draw(2)+draw(3) = 3 used, next prompted -> paywall
    const blocked = await h(request(api).post("/api/cards/draw")).send({ intent: "ask", text: "one more?" });
    expect(blocked.status).toBe(402);
    expect(blocked.body.paywall).toBe(true);

    // Subscribe via webhook (test mode)
    const hook = await request(api)
      .post("/api/stripe/webhook")
      .set("content-type", "application/json")
      .send(Buffer.from("{}"));
    expect(hook.status).toBe(200);
    expect(hook.body.handled).toBe(true);

    // Now unlimited
    const ent = await h(request(api).get("/api/entitlement"));
    expect(ent.body.subscribed).toBe(true);
    expect(ent.body.freeDrawsRemaining).toBe(-1);
    const after = await h(request(api).post("/api/cards/draw")).send({ intent: "ask", text: "unlimited now" });
    expect(after.status).toBe(200);
  });

  it("crisis input returns support copy and no card", async () => {
    const res = await h(request(api).post("/api/cards/draw")).send({ intent: "feel", text: "I want to kill myself" });
    expect(res.status).toBe(200);
    expect(res.body.isCrisis).toBe(true);
    expect(res.body.resources.some((r: any) => r.label.includes("988"))).toBe(true);
    expect(res.body.card).toBeUndefined();
  });

  it("crisis cannot be bypassed via the follow-up path", async () => {
    const d = await h(request(api).post("/api/cards/draw")).send({ intent: "feel", text: "I feel low" });
    const res = await h(request(api).post("/api/cards/follow-up")).send({
      previousCardId: d.body.card.id,
      text: "i can't go on anymore",
    });
    expect(res.body.isCrisis).toBe(true);
  });

  it("rejects requests without a device id", async () => {
    const res = await request(api).get("/api/cards/daily");
    expect(res.status).toBe(400);
  });

  it("spark share round-trips without auth on read", async () => {
    const created = await h(request(api).post("/api/spark")).send({ card, note: "thinking of you" });
    expect(created.status).toBe(200);
    const token = created.body.token;
    const fetched = await request(api).get(`/api/spark/${token}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.note).toBe("thinking of you");
    expect(fetched.body.card.title).toBe(card.title);
  });

  it("settings persist", async () => {
    await h(request(api).put("/api/settings")).send({ reminderTime: "08:15", notificationsOn: false });
    const res = await h(request(api).get("/api/settings"));
    expect(res.body.reminderTime).toBe("08:15");
    expect(res.body.notificationsOn).toBe(false);
  });
});
