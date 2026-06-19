import { describe, it, expect, beforeEach } from "vitest";
import { createDb, type DB } from "../src/db";
import { createService } from "../src/service";
import {
  generateCardText,
  parseCardJson,
  type MessagesClient,
} from "../src/lib/anthropic";

function fakeClient(json: object): MessagesClient {
  return {
    messages: {
      create: async () => ({ content: [{ type: "text", text: JSON.stringify(json) }] }),
    },
  };
}

const goodCard = {
  opener: "I'm reading the energy of today's card for you…",
  title: "The Quiet Harbor", // a real deck card (theme exhaustion_rest)
  message: "Of course this feels heavy. Let it be true first, then take one small breath.",
  theme: "exhaustion_rest",
};

describe("generateCardText", () => {
  it("parses a valid model response and keeps a deck title", async () => {
    const r = await generateCardText({ intent: "feeling", text: "I'm tired" }, { client: fakeClient(goodCard) });
    expect(r.fallback).toBe(false);
    expect(r.title).toBe("The Quiet Harbor");
    expect(r.theme).toBe("exhaustion_rest");
  });

  it("snaps an off-deck title back onto the fixed deck", async () => {
    const offDeck = { ...goodCard, title: "Some Invented Title", theme: "exhaustion_rest" };
    const r = await generateCardText({ intent: "feeling", text: "I'm tired" }, { client: fakeClient(offDeck) });
    expect(r.fallback).toBe(false);
    // Title must be a real deck card, never the invented one.
    expect(r.title).not.toBe("Some Invented Title");
    expect(r.title.length).toBeGreaterThan(0);
  });

  it("falls back when JSON is malformed", async () => {
    const client: MessagesClient = {
      messages: { create: async () => ({ content: [{ type: "text", text: "not json at all" }] }) },
    };
    const r = await generateCardText({ intent: "general" }, { client });
    expect(r.fallback).toBe(true);
    expect(r.opener).toBeTruthy();
    expect(r.title).toBeTruthy();
  });

  it("falls back when no client is configured", async () => {
    const r = await generateCardText({ intent: "question", text: "should I?" }, { client: null });
    expect(r.fallback).toBe(true);
    expect(r.theme).toBe("guidance_decision");
  });

  it("falls back on timeout", async () => {
    const slow: MessagesClient = {
      messages: { create: () => new Promise(() => {}) }, // never resolves
    };
    const r = await generateCardText({ intent: "general" }, { client: slow, timeoutMs: 20 });
    expect(r.fallback).toBe(true);
  });

  it("coerces an invalid theme to a sensible default (off-deck title)", async () => {
    // With an off-deck title, the deck can't supply a theme, so the invalid
    // theme falls back to the intent default.
    const r = await generateCardText(
      { intent: "question", text: "x" },
      { client: fakeClient({ ...goodCard, title: "Some Invented Title", theme: "not_a_theme" }) },
    );
    expect(r.theme).toBe("guidance_decision");
  });

  it("a valid deck title sets the card's canonical theme", async () => {
    // "The Quiet Harbor" is an exhaustion_rest card; its theme wins even if the
    // model returns a different (or invalid) theme.
    const r = await generateCardText(
      { intent: "question", text: "x" },
      { client: fakeClient({ ...goodCard, title: "The Quiet Harbor", theme: "not_a_theme" }) },
    );
    expect(r.theme).toBe("exhaustion_rest");
  });
});

describe("parseCardJson", () => {
  it("strips code fences", () => {
    const parsed = parseCardJson("```json\n{\"opener\":\"a\",\"title\":\"b\",\"message\":\"c\",\"theme\":\"daily_general\"}\n```");
    expect(parsed?.title).toBe("b");
  });
  it("returns null on garbage", () => {
    expect(parseCardJson("hello")).toBeNull();
  });
});

describe("service", () => {
  let db: DB;
  const DEVICE = "dev-123";
  const TODAY = "2026-06-17";

  beforeEach(() => {
    db = createDb(":memory:");
  });

  it("daily card is idempotent within a local day", async () => {
    const svc = createService(db, { client: fakeClient(goodCard) });
    const a = await svc.getDailyCard(DEVICE, TODAY);
    const b = await svc.getDailyCard(DEVICE, TODAY);
    expect(a.id).toBe(b.id);
    // Only one daily draw recorded
    expect(db.countDrawsToday(DEVICE, TODAY)).toBe(1);
  });

  it("crisis input returns support, never a card, and records no draw", async () => {
    const svc = createService(db, { client: fakeClient(goodCard) });
    const r = await svc.drawCard(DEVICE, TODAY, { intent: "feel", text: "I want to kill myself" });
    expect(r.kind).toBe("crisis");
    expect(db.countDrawsToday(DEVICE, TODAY)).toBe(0);
  });

  it("enforces the 3-draw daily cap during trial -> paywall", async () => {
    const svc = createService(db, { client: fakeClient(goodCard) });
    for (let i = 0; i < 3; i++) {
      const r = await svc.drawCard(DEVICE, TODAY, { intent: "ask", text: "what now?" });
      expect(r.kind).toBe("card");
    }
    const blocked = await svc.drawCard(DEVICE, TODAY, { intent: "ask", text: "again?" });
    expect(blocked).toEqual({ kind: "paywall", reason: "daily_cap" });
  });

  it("allows exactly one follow-up per card", async () => {
    const svc = createService(db, { client: fakeClient(goodCard) });
    const draw = await svc.drawCard(DEVICE, TODAY, { intent: "feel", text: "I feel lost" });
    if (draw.kind !== "card") throw new Error("expected card");
    const f1 = await svc.askFollowUp(DEVICE, TODAY, { previousCardId: draw.card.id, text: "what do I do?" });
    expect(f1.kind).toBe("card");
    const f2 = await svc.askFollowUp(DEVICE, TODAY, { previousCardId: draw.card.id, text: "and then?" });
    expect(f2.kind).toBe("already_used");
  });

  it("follow-up crisis text returns support, not a card", async () => {
    const svc = createService(db, { client: fakeClient(goodCard) });
    const draw = await svc.drawCard(DEVICE, TODAY, { intent: "feel", text: "I feel lost" });
    if (draw.kind !== "card") throw new Error("expected card");
    const f = await svc.askFollowUp(DEVICE, TODAY, { previousCardId: draw.card.id, text: "honestly I want to die" });
    expect(f.kind).toBe("crisis");
  });

  it("unknown follow-up parent -> not_found", async () => {
    const svc = createService(db, { client: fakeClient(goodCard) });
    const r = await svc.askFollowUp(DEVICE, TODAY, { previousCardId: "nope", text: "hi" });
    expect(r.kind).toBe("not_found");
  });

  it("entitlement snapshot reflects draws", async () => {
    const svc = createService(db, { client: fakeClient(goodCard) });
    await svc.drawCard(DEVICE, TODAY, { intent: "ask", text: "q" });
    const ent = svc.entitlement(DEVICE, TODAY);
    expect(ent.drawsToday).toBe(1);
    expect(ent.freeDrawsRemaining).toBe(2);
    expect(ent.withinTrial).toBe(true);
  });

  it("respects the 2-week no-repeat window for a theme", async () => {
    const svc = createService(db, { client: fakeClient(goodCard) }); // always exhaustion_rest (5 imgs)
    const seen = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const r = await svc.drawCard(DEVICE, TODAY, { intent: "feel", text: "tired" + i });
      // bypass the cap for this test by subscribing the device each loop
      db.setSubscription({ deviceId: DEVICE, email: null, customerId: null, subscribed: true, plan: "yearly", periodEnd: null });
      if (r.kind === "card") seen.add(r.card.illustrationId);
    }
    // 5 distinct images in the theme, all should be unique within the window
    expect(seen.size).toBe(5);
  });
});
