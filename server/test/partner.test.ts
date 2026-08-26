// Partners (rev-share referrals): admin creation, first-touch attribution,
// revenue recording from Stripe checkout, idempotent webhooks, and the
// secret-gated stats endpoint.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createDb, type DB } from "../src/db";
import { createApp } from "../src/app";

const DEVICE = "device-ref-0001";
const OTHER = "device-ref-0002";

function makeApp(db: DB, event?: { type: string; data: { object: any } }) {
  return createApp(db, {
    client: null, // deterministic fallback cards; no AI needed here
    verifyStripe: () =>
      event ?? {
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_123",
            client_reference_id: DEVICE,
            metadata: { deviceId: DEVICE, plan: "yearly" },
            amount_total: 5999,
          },
        },
      },
  });
}

async function createPartner(api: ReturnType<typeof createApp>, code = "luna", pct = 30) {
  return request(api)
    .post("/api/partner")
    .set("x-admin-key", "test-admin")
    .send({ code, name: "Luna Tarot", revSharePct: pct });
}

describe("partners", () => {
  let db: DB;
  let api: ReturnType<typeof createApp>;

  beforeEach(() => {
    process.env.ADMIN_KEY = "test-admin";
    db = createDb(":memory:");
    api = makeApp(db);
  });

  afterEach(() => {
    delete process.env.ADMIN_KEY;
  });

  const h = (r: request.Test, device = DEVICE) =>
    r.set("x-device-id", device).set("x-local-date", "2026-06-01");

  it("admin can create a partner; wrong key cannot", async () => {
    const ok = await createPartner(api);
    expect(ok.status).toBe(200);
    expect(ok.body.secret).toMatch(/^pk_/);
    expect(ok.body.shareUrl).toContain("?ref=luna");

    const bad = await request(api)
      .post("/api/partner")
      .set("x-admin-key", "wrong")
      .send({ code: "x2", name: "X" });
    expect(bad.status).toBe(401);

    const dup = await createPartner(api);
    expect(dup.status).toBe(409);
  });

  it("attribution is first-touch: a second partner cannot steal the device", async () => {
    await createPartner(api, "luna");
    await createPartner(api, "sol");

    const first = await h(request(api).post("/api/partner/attribute")).send({ code: "luna" });
    expect(first.body.attributed).toBe(true);

    const second = await h(request(api).post("/api/partner/attribute")).send({ code: "sol" });
    expect(second.body.attributed).toBe(false);

    const unknown = await h(request(api).post("/api/partner/attribute")).send({ code: "ghost" });
    expect(unknown.status).toBe(404);
  });

  it("checkout revenue lands on the referring partner, idempotently", async () => {
    const created = await createPartner(api, "luna", 30);
    const secret = created.body.secret;

    await h(request(api).post("/api/partner/attribute")).send({ code: "luna" });

    // Same Stripe event delivered twice (webhook retry) — counted once.
    await request(api).post("/api/stripe/webhook").set("stripe-signature", "t").send({});
    await request(api).post("/api/stripe/webhook").set("stripe-signature", "t").send({});

    const stats = await request(api)
      .get("/api/partner/luna/stats")
      .set("x-partner-key", secret);
    expect(stats.status).toBe(200);
    expect(stats.body.installs).toBe(1);
    expect(stats.body.subscribers).toBe(1);
    expect(stats.body.revenueUsd).toBeCloseTo(59.99, 2);
    expect(stats.body.accruedUsd).toBeCloseTo(18.0, 2);
  });

  it("an unattributed subscription records no partner revenue", async () => {
    const created = await createPartner(api, "luna");
    const secret = created.body.secret;
    // OTHER device subscribes without ever being referred.
    const evApi = makeApp(db, {
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_other",
          client_reference_id: OTHER,
          metadata: { deviceId: OTHER, plan: "monthly" },
          amount_total: 999,
        },
      },
    });
    await request(evApi).post("/api/stripe/webhook").set("stripe-signature", "t").send({});

    const stats = await request(api)
      .get("/api/partner/luna/stats")
      .set("x-partner-key", secret);
    expect(stats.body.revenueUsd).toBe(0);
    expect(stats.body.subscribers).toBe(0);
  });

  it("stats require the partner secret", async () => {
    await createPartner(api, "luna");
    const noKey = await request(api).get("/api/partner/luna/stats");
    expect(noKey.status).toBe(401);
    const wrongKey = await request(api).get("/api/partner/luna/stats").set("x-partner-key", "nope");
    expect(wrongKey.status).toBe(401);
  });
});
