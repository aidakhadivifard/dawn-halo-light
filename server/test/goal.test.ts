// End-to-end tests for the endurance-goal layer: onboarding, adaptive daily
// check-in, rituals (premium), benchmarks, milestones, honesty check, paywall.

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createDb, type DB } from "../src/db";
import { createApp } from "../src/app";
import type { MessagesClient } from "../src/lib/anthropic";

const card = {
  opener: "I'm turning this one over for you…",
  title: "Small Steady Light",
  message: "This card is the small flame that outlasts the wind.\n\nDay by day it holds.",
  reflection: "What kept the flame lit today?",
  theme: "quiet_strength",
};

function fakeClient(text?: string): MessagesClient {
  return {
    messages: {
      create: async () => ({
        content: [{ type: "text", text: text ?? JSON.stringify(card) }],
      }),
    },
  };
}

const DEVICE = "device-goal-0001";
const START = "2026-07-01";

/** Local date N days after START (day 1 = START). */
function onDay(n: number): string {
  const d = new Date(Date.UTC(2026, 6, 1) + (n - 1) * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function app(db: DB, client: MessagesClient = fakeClient()) {
  return createApp(db, {
    client,
    verifyStripe: () => ({
      type: "checkout.session.completed",
      data: {
        object: {
          client_reference_id: DEVICE,
          metadata: { deviceId: DEVICE, plan: "yearly" },
        },
      },
    }),
  });
}

describe("endurance goal (e2e)", () => {
  let db: DB;
  let api: ReturnType<typeof createApp>;

  beforeEach(() => {
    db = createDb(":memory:");
    api = app(db);
  });

  const h = (r: request.Test, date = START) =>
    r.set("x-device-id", DEVICE).set("x-local-date", date);

  const createGoal = (targetDate = onDay(100)) =>
    h(request(api).post("/api/goal")).send({
      title: "fit into the corset",
      reward: "wearing it to the spring wedding",
      targetDate,
      ritual: "card",
    });

  it("no goal yet → status null", async () => {
    const res = await h(request(api).get("/api/goal"));
    expect(res.status).toBe(200);
    expect(res.body.status).toBeNull();
  });

  it("allows up to three active journeys; a fourth is rejected; bad target date rejected", async () => {
    const created = await createGoal();
    expect(created.status).toBe(200);
    expect(created.body.status.day).toBe(1);
    expect(created.body.status.goal.title).toBe("fit into the corset");
    expect(created.body.status.benchmark.sourceUrl).toMatch(/^https:\/\//);

    // Several roads may be held at once — but only three.
    expect((await createGoal()).status).toBe(200);
    expect((await createGoal()).status).toBe(200);
    const fourth = await createGoal();
    expect(fourth.status).toBe(409);
    expect(fourth.body.error).toBe("goal_already_active");

    // The multi-journey list shows all three, oldest first.
    const list = await h(request(api).get("/api/goals"));
    expect(list.status).toBe(200);
    expect(list.body.goals).toHaveLength(3);

    // A per-journey check-in touches only the named journey.
    const target = list.body.goals[0].goal.id;
    const chk = await h(request(api).post("/api/goal/checkin")).send({
      state: "strong",
      goalId: target,
    });
    expect(chk.status).toBe(200);
    const after = await h(request(api).get("/api/goals"));
    expect(after.body.goals.filter((g: any) => g.checkedInToday)).toHaveLength(1);
    expect(after.body.goals[0].checkedInToday).toBe(true);

    const db2 = createDb(":memory:");
    const api2 = app(db2);
    const past = await request(api2)
      .post("/api/goal")
      .set("x-device-id", "other-device-01")
      .set("x-local-date", START)
      .send({ title: "x", reward: "y", targetDate: "2026-06-01" });
    expect(past.status).toBe(400);
    expect(past.body.error).toBe("target_date_must_be_future");
  });

  it("PATCH edits title/photo/ritual but the date stays locked", async () => {
    await createGoal();
    const res = await h(request(api).patch("/api/goal")).send({
      title: "fit into the corset again",
      targetDate: "2027-01-01", // silently NOT accepted — no such field
      ritual: "writing",
    });
    expect(res.status).toBe(200);
    expect(res.body.status.goal.title).toBe("fit into the corset again");
    expect(res.body.status.goal.ritual).toBe("writing");
    expect(res.body.status.goal.targetDate).toBe(onDay(100));
  });

  describe("daily check-in", () => {
    beforeEach(() => createGoal());

    it("adapts to the state: strong = light ack only", async () => {
      const res = await h(request(api).post("/api/goal/checkin")).send({ state: "strong" });
      expect(res.status).toBe(200);
      const c = res.body.checkin;
      expect(c.day).toBe(1);
      expect(c.ack).toContain("Day 1");
      expect(c.benchmark).toBeNull(); // don't over-celebrate / no support moment
      expect(c.offerRitual).toBe(false);
      expect(c.offerHonesty).toBe(false);
    });

    it("adapts to the state: barely = support moment with benchmark + ritual", async () => {
      const res = await h(request(api).post("/api/goal/checkin")).send({ state: "barely" });
      const c = res.body.checkin;
      expect(c.ack).toContain("part of holding on");
      expect(c.benchmark.sourceUrl).toMatch(/^https:\/\//);
      expect(c.offerRitual).toBe(true);
    });

    it("adapts to the state: cant = gentlest mode, no benchmark, honesty offered", async () => {
      const res = await h(request(api).post("/api/goal/checkin")).send({ state: "cant" });
      const c = res.body.checkin;
      expect(c.ack).toBe("Today is heavy. You still showed up to say it.");
      expect(c.benchmark).toBeNull();
      expect(c.offerHonesty).toBe(true);
      expect(c.suggestedRitual).toBe("writing");
      expect(c.honestyOffer).toContain("a decision, not a failure");
    });

    it("is idempotent per local day (no double count)", async () => {
      const first = await h(request(api).post("/api/goal/checkin")).send({ state: "strong" });
      expect(first.body.checkin.already).toBe(false);
      const again = await h(request(api).post("/api/goal/checkin")).send({ state: "cant" });
      expect(again.body.checkin.already).toBe(true);
      expect(again.body.checkin.state).toBe("strong"); // first answer stands
      expect(again.body.checkin.streak).toBe(1);
    });

    it("missing a day NEVER resets days-since-commitment; streak is separate", async () => {
      await h(request(api).post("/api/goal/checkin")).send({ state: "strong" });
      // skip day 2 entirely
      const day3 = await h(request(api).post("/api/goal/checkin"), onDay(3)).send({
        state: "strong",
      });
      expect(day3.body.checkin.day).toBe(3); // calendar days, not check-ins
      expect(day3.body.checkin.streak).toBe(1); // streak did reset
      expect(day3.body.checkin.milestone.id).toBe("day3"); // milestone fires
      expect(day3.body.checkin.milestone.message).toContain("Most people never see this day");
    });

    it("a crisis note routes to resources — no day count, no motivation", async () => {
      const res = await h(request(api).post("/api/goal/checkin")).send({
        state: "cant",
        note: "I don't want to be here anymore",
      });
      expect(res.status).toBe(200);
      expect(res.body.isCrisis).toBe(true);
      expect(res.body.resources.length).toBeGreaterThan(0);
      expect(res.body.checkin).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toMatch(/Day \d/);
      // and the day was NOT consumed
      const retry = await h(request(api).post("/api/goal/checkin")).send({ state: "cant" });
      expect(retry.body.checkin.already).toBe(false);
    });

    it("an ordinary-hardship note is NOT referred out", async () => {
      const res = await h(request(api).post("/api/goal/checkin")).send({
        state: "exhausted",
        note: "I can't do this anymore",
      });
      expect(res.body.isCrisis).toBeUndefined();
      expect(res.body.checkin.day).toBe(1);
    });
  });

  describe("rituals (premium, reuse of the card pipeline)", () => {
    beforeEach(() => createGoal());

    it("requires a check-in first", async () => {
      const res = await h(request(api).post("/api/goal/ritual")).send({ type: "card" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("checkin_required");
    });

    it("card ritual draws a real card once per day", async () => {
      await h(request(api).post("/api/goal/checkin")).send({ state: "barely" });
      const res = await h(request(api).post("/api/goal/ritual")).send({ type: "card" });
      expect(res.status).toBe(200);
      expect(res.body.card.title).toBeTruthy();
      expect(res.body.card.theme).toBe("quiet_strength");
      expect(res.body.card.illustrationId).toBeTruthy();

      const again = await h(request(api).post("/api/goal/ritual")).send({ type: "card" });
      expect(again.status).toBe(409);
      expect(again.body.error).toBe("ritual_already_done");
    });

    it("writing ritual returns one reflection and stores the entry", async () => {
      await h(request(api).post("/api/goal/checkin")).send({ state: "exhausted" });
      const res = await h(request(api).post("/api/goal/ritual")).send({
        type: "writing",
        text: "I dreamed I was running from something all night",
      });
      expect(res.status).toBe(200);
      expect(res.body.reflection).toBeTruthy();

      const hist = await h(request(api).get("/api/goal/history"));
      expect(hist.status).toBe(200);
      expect(hist.body.entries).toHaveLength(1);
      expect(hist.body.entries[0].type).toBe("writing");
      expect(hist.body.entries[0].userText).toContain("running from");
    });

    it("a Copy-Rule-violating AI reflection falls back to the safe static line", async () => {
      const bragging = app(db, fakeClient("Keep going and you will succeed — I promise!"));
      await h(request(bragging).post("/api/goal/checkin")).send({ state: "barely" });
      const res = await h(request(bragging).post("/api/goal/ritual")).send({
        type: "writing",
        text: "today was hard",
      });
      expect(res.status).toBe(200);
      expect(res.body.fallback).toBe(true);
      expect(res.body.reflection).not.toMatch(/you will|promise/i);
    });

    it("crisis text in the writing ritual routes to resources", async () => {
      await h(request(api).post("/api/goal/checkin")).send({ state: "cant" });
      const res = await h(request(api).post("/api/goal/ritual")).send({
        type: "writing",
        text: "I want to end it all tonight",
      });
      expect(res.body.isCrisis).toBe(true);
      expect(res.body.reflection).toBeUndefined();
    });

    it("after the 14-day trial, rituals hit the paywall; subscribing unlocks", async () => {
      // Burn 15 active days with check-ins only (no draws at all).
      for (let day = 1; day <= 15; day++) {
        await h(request(api).post("/api/goal/checkin"), onDay(day)).send({ state: "strong" });
      }
      const gated = await h(request(api).post("/api/goal/ritual"), onDay(15)).send({
        type: "writing",
        text: "still here",
      });
      expect(gated.status).toBe(402);
      expect(gated.body.paywall).toBe(true);

      // Subscribe via the (test-verified) Stripe webhook → unlimited.
      await request(api)
        .post("/api/stripe/webhook")
        .set("stripe-signature", "test")
        .send({});
      const open = await h(request(api).post("/api/goal/ritual"), onDay(15)).send({
        type: "writing",
        text: "still here",
      });
      expect(open.status).toBe(200);
      expect(open.body.reflection).toBeTruthy();

      // history/journal is premium too — now open
      const hist = await h(request(api).get("/api/goal/history"), onDay(15));
      expect(hist.status).toBe(200);
      expect(hist.body.checkins).toHaveLength(15);
    });
  });

  describe("honesty check", () => {
    beforeEach(() => createGoal());

    it("due on day 21 (and not before, without a low run)", async () => {
      await h(request(api).post("/api/goal/checkin"), onDay(20)).send({ state: "strong" });
      const before = await h(request(api).get("/api/goal"), onDay(20));
      expect(before.body.status.honestyDue).toBe(false);

      const at21 = await h(request(api).post("/api/goal/checkin"), onDay(21)).send({
        state: "strong",
      });
      expect(at21.body.checkin.honestyDue).toBe(true);

      // answering "continue" silences it until day 42
      await h(request(api).post("/api/goal/honesty"), onDay(21)).send({ answer: "continue" });
      const after = await h(request(api).get("/api/goal"), onDay(22));
      expect(after.body.status.honestyDue).toBe(false);
    });

    it("triggers EARLY after 3 consecutive cant/exhausted days", async () => {
      await h(request(api).post("/api/goal/checkin"), onDay(4)).send({ state: "cant" });
      await h(request(api).post("/api/goal/checkin"), onDay(5)).send({ state: "exhausted" });
      const third = await h(request(api).post("/api/goal/checkin"), onDay(6)).send({
        state: "exhausted",
      });
      expect(third.body.checkin.honestyDue).toBe(true);
    });

    it("'adjust' and 'thinking' log with a note and never close the goal", async () => {
      const r1 = await h(request(api).post("/api/goal/honesty"), onDay(21)).send({
        answer: "adjust",
        note: "the method is wrong, the goal is right",
      });
      expect(r1.status).toBe(200);
      expect(r1.body.summary).toBeUndefined();
      const r2 = await h(request(api).post("/api/goal/honesty"), onDay(42)).send({
        answer: "thinking",
      });
      expect(r2.status).toBe(200);
      const status = await h(request(api).get("/api/goal"), onDay(43));
      expect(status.body.status).not.toBeNull(); // still active

      const hist = await h(request(api).get("/api/goal/history"), onDay(43));
      expect(hist.body.honesty).toHaveLength(2);
      expect(hist.body.honesty[0].answer).toBe("adjust");
      expect(hist.body.honesty[0].note).toContain("method is wrong");
    });

    it("'done' closes the goal with a respectful summary — zero guilt language", async () => {
      await h(request(api).post("/api/goal/checkin"), onDay(1)).send({
        state: "strong",
        note: "day one, hopeful",
      });
      const res = await h(request(api).post("/api/goal/honesty"), onDay(30)).send({
        answer: "done",
      });
      expect(res.status).toBe(200);
      const s = res.body.summary;
      expect(s.outcome).toBe("abandoned");
      expect(s.daysHeld).toBe(30);
      expect(s.heading).toContain("a decision, not a failure");
      expect(s.notes).toContain("day one, hopeful");
      const text = JSON.stringify(s).toLowerCase();
      for (const guilt of ["gave up", "quit", "shame", "wasted", "should have"]) {
        expect(text.includes(guilt), guilt).toBe(false);
      }
      // goal is closed → no active goal
      const status = await h(request(api).get("/api/goal"), onDay(31));
      expect(status.body.status).toBeNull();
    });
  });

  describe("goal end", () => {
    it("reaching the target date completes the goal with a summary", async () => {
      await createGoal(onDay(30));
      const res = await h(request(api).post("/api/goal/checkin"), onDay(30)).send({
        state: "strong",
      });
      const c = res.body.checkin;
      expect(c.milestone.id).toBe("target");
      expect(c.summary.outcome).toBe("completed");
      expect(c.summary.daysHeld).toBe(30);
      const status = await h(request(api).get("/api/goal"), onDay(30));
      expect(status.body.status).toBeNull(); // no longer active
    });

    it("'completed' close is rejected before the target date", async () => {
      await createGoal(onDay(100));
      const res = await h(request(api).post("/api/goal/close"), onDay(10)).send({
        reason: "completed",
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("target_not_reached");
    });
  });

  it("the deck is public content for the Library", async () => {
    const res = await request(api).get("/api/deck");
    expect(res.status).toBe(200);
    expect(res.body.deck.length).toBeGreaterThanOrEqual(40);
    expect(res.body.deck[0]).toHaveProperty("title");
    expect(res.body.deck[0]).toHaveProperty("essence");
    expect(res.body.deck[0]).toHaveProperty("theme");
  });

  it("goal-aware cards: the daily card prompt carries the goal context", async () => {
    let capturedPrompt = "";
    const spying: MessagesClient = {
      messages: {
        create: async (args: any) => {
          capturedPrompt = args.messages[0].content;
          return { content: [{ type: "text", text: JSON.stringify(card) }] };
        },
      },
    };
    const spyApi = app(db, spying);
    await h(request(spyApi).post("/api/goal")).send({
      title: "stay at this job",
      reward: "equity vests in January",
      targetDate: onDay(200),
    });
    const daily = await h(request(spyApi).get("/api/cards/daily"), onDay(47));
    expect(daily.status).toBe(200);
    expect(capturedPrompt).toContain('Holding on for: "stay at this job"');
    expect(capturedPrompt).toContain("Day 47 of 200");
    expect(capturedPrompt).toContain("READING ENGINE RULES");
    expect(capturedPrompt).toContain("never promise the outcome");
  });

  it("the Reading Engine payload carries the reader's own life (spec 3.7)", async () => {
    let capturedPrompt = "";
    const spying: MessagesClient = {
      messages: {
        create: async (args: any) => {
          capturedPrompt = args.messages[0].content;
          return { content: [{ type: "text", text: JSON.stringify(card) }] };
        },
      },
    };
    const spyApi = app(db, spying);
    await h(request(spyApi).post("/api/goal")).send({
      title: "finish my thesis",
      reward: "the defense behind me",
      targetDate: onDay(60),
    });
    // Build a history: check-ins with a note, and a written ritual.
    await h(request(spyApi).post("/api/goal/checkin"), onDay(1)).send({ state: "strong" });
    await h(request(spyApi).post("/api/goal/checkin"), onDay(2)).send({
      state: "barely",
      note: "the Monday meeting drained me",
    });
    await h(request(spyApi).post("/api/goal/ritual"), onDay(2)).send({
      type: "writing",
      text: "I keep dreaming about unfinished chapters",
    });
    await h(request(spyApi).post("/api/goal/honesty"), onDay(3)).send({ answer: "continue" });
    await h(request(spyApi).post("/api/goal/checkin"), onDay(3)).send({ state: "exhausted" });

    capturedPrompt = "";
    const draw = await h(request(spyApi).post("/api/cards/draw"), onDay(3)).send({
      intent: "ask",
      text: "am I going to make it?",
    });
    expect(draw.status).toBe(200);
    // goal + numbers
    expect(capturedPrompt).toContain('Holding on for: "finish my thesis"');
    expect(capturedPrompt).toContain("Day 3 of 60");
    // today's + recent check-in states with dates
    expect(capturedPrompt).toContain("Today's check-in: exhausted");
    expect(capturedPrompt).toContain(`${onDay(2)} barely holding on`);
    // their own words, quoted
    expect(capturedPrompt).toContain("the Monday meeting drained me");
    expect(capturedPrompt).toContain("unfinished chapters");
    // honesty answer + the engine's rules
    expect(capturedPrompt).toContain('answered "continue"');
    expect(capturedPrompt).toContain("counter-evidence");
    // milestone within 3 days (day 3 milestone fires today)
    expect(capturedPrompt).toContain("milestone");
  });
});
