// Admin metrics — the three numbers that decide everything: vow creation,
// D30 return, and share (public pages actually opened).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createDb, type DB } from "../src/db";
import { createApp } from "../src/app";

function makeApp(db: DB) {
  return createApp(db, { client: null });
}

const h = (r: request.Test, device: string, date: string) =>
  r.set("x-device-id", device).set("x-local-date", date);

describe("admin metrics", () => {
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

  it("requires the admin key", async () => {
    const noKey = await request(api).get("/api/admin/metrics");
    expect(noKey.status).toBe(401);
    const wrong = await request(api).get("/api/admin/metrics").set("x-admin-key", "nope");
    expect(wrong.status).toBe(401);
  });

  it("computes the three numbers from real activity", async () => {
    // Device A: makes a vow on June 1, still visiting on day 35 -> D30 returned.
    await h(request(api).post("/api/journey"), "device-a", "2026-06-01").send({
      enduring: "a hard thing",
      hope: "a good end",
    });
    await h(request(api).get("/api/journey"), "device-a", "2026-07-05"); // day 35 visit

    // Device B: vow on June 1, abandoned after day 3 -> D30 not returned.
    await h(request(api).post("/api/journey"), "device-b", "2026-06-01").send({
      enduring: "another hard thing",
      hope: "hope",
    });
    await h(request(api).get("/api/journey"), "device-b", "2026-06-03");

    // Device C: installs (touches entitlement) but never makes a vow.
    await h(request(api).get("/api/entitlement"), "device-c", "2026-06-02");

    // Device A fulfills; the keepsake gets opened once (the share signal).
    const closed = await h(request(api).post("/api/journey/close"), "device-a", "2026-07-20").send({
      outcome: "fulfilled",
    });
    const token = closed.body.journey.keepsakeToken;
    await request(api).get(`/api/keepsake/${token}`);

    const res = await request(api)
      .get("/api/admin/metrics")
      .set("x-admin-key", "test-admin")
      .set("x-local-date", "2026-08-01");
    expect(res.status).toBe(200);
    const m = res.body.metrics;

    expect(m.installs).toBe(3);
    expect(m.vows.total).toBe(2);
    expect(m.vows.creationRate).toBeCloseTo(2 / 3, 5);

    expect(m.d30.eligible).toBe(2);
    expect(m.d30.returned).toBe(1); // only device A got past day 30
    expect(m.d30.rate).toBeCloseTo(0.5, 5);

    expect(m.share.closedVows).toBe(1);
    expect(m.share.keepsakesViewed).toBe(1);
    expect(m.share.rate).toBe(1);

    expect(m.vows.active).toBe(1); // device B's abandoned-but-open vow
    expect(m.vows.fulfilled).toBe(1);
  });

  it("young vows are not judged for D30", async () => {
    await h(request(api).post("/api/journey"), "device-y", "2026-08-01").send({
      enduring: "x",
      hope: "y",
    });
    const res = await request(api)
      .get("/api/admin/metrics")
      .set("x-admin-key", "test-admin")
      .set("x-local-date", "2026-08-10");
    expect(res.body.metrics.d30.eligible).toBe(0);
    expect(res.body.metrics.d30.rate).toBe(0);
  });
});
