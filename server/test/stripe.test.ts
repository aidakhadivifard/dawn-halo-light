import { describe, it, expect, beforeEach } from "vitest";
import { createDb, type DB } from "../src/db";
import { handleStripeEvent, PLANS, priceIdFor } from "../src/lib/stripe";

describe("plans + pricing match the product rules", () => {
  it("yearly is $4.99/mo billed at $59.99 with save-50% note", () => {
    expect(PLANS.yearly.priceMonthly).toBe(4.99);
    expect(PLANS.yearly.billedAnnually).toBe(59.99);
    expect(PLANS.yearly.note.toLowerCase()).toContain("save 50%");
  });
  it("monthly is $9.99/mo, cancel anytime", () => {
    expect(PLANS.monthly.priceMonthly).toBe(9.99);
    expect(PLANS.monthly.note.toLowerCase()).toContain("cancel anytime");
  });
  it("price ids resolve from env", () => {
    process.env.STRIPE_PRICE_ID_YEARLY = "price_year_test";
    process.env.STRIPE_PRICE_ID_MONTHLY = "price_month_test";
    expect(priceIdFor("yearly")).toBe("price_year_test");
    expect(priceIdFor("monthly")).toBe("price_month_test");
  });
});

describe("handleStripeEvent", () => {
  let db: DB;
  const DEVICE = "dev-stripe-1";

  beforeEach(() => {
    db = createDb(":memory:");
    db.getOrCreateDevice(DEVICE);
  });

  it("checkout.session.completed grants the subscription, keyed by device", () => {
    const r = handleStripeEvent(db, {
      type: "checkout.session.completed",
      data: {
        object: {
          client_reference_id: DEVICE,
          customer: "cus_123",
          customer_details: { email: "a@b.com" },
          metadata: { deviceId: DEVICE, plan: "yearly" },
        },
      },
    });
    expect(r.handled).toBe(true);
    const d = db.getDevice(DEVICE)!;
    expect(d.subscribed).toBe(1);
    expect(d.plan).toBe("yearly");
    expect(d.email).toBe("a@b.com");
    expect(d.stripe_customer_id).toBe("cus_123");
  });

  it("subscription.updated active sets period end", () => {
    const end = Math.floor(Date.now() / 1000) + 86400;
    handleStripeEvent(db, {
      type: "customer.subscription.updated",
      data: { object: { metadata: { deviceId: DEVICE, plan: "monthly" }, status: "active", customer: "cus_9", current_period_end: end } },
    });
    const d = db.getDevice(DEVICE)!;
    expect(d.subscribed).toBe(1);
    expect(d.plan).toBe("monthly");
    expect(new Date(d.current_period_end!).getTime()).toBeGreaterThan(Date.now());
  });

  it("subscription.deleted revokes access", () => {
    handleStripeEvent(db, {
      type: "checkout.session.completed",
      data: { object: { client_reference_id: DEVICE, metadata: { deviceId: DEVICE, plan: "yearly" } } },
    });
    handleStripeEvent(db, {
      type: "customer.subscription.deleted",
      data: { object: { metadata: { deviceId: DEVICE } } },
    });
    expect(db.getDevice(DEVICE)!.subscribed).toBe(0);
  });

  it("ignores events with no device reference", () => {
    const r = handleStripeEvent(db, {
      type: "customer.subscription.updated",
      data: { object: { status: "active", customer: "cus_x" } },
    });
    expect(r.handled).toBe(false);
  });

  it("ignores unrelated event types", () => {
    const r = handleStripeEvent(db, { type: "invoice.paid", data: { object: {} } });
    expect(r.handled).toBe(false);
  });
});
