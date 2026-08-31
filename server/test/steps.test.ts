// One Small Step — "Count the staying. Remember the doing. Never count the
// failing." These tests guard the invariants that make the feature safe:
// no failure is ever aggregated or displayed, the ask is paced after
// declines, memory is rare and narrative, and the return line never counts
// absence.

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createDb, type DB } from "../src/db";
import { createApp } from "../src/app";
import { shouldAskStep, memoryLine, returnLine, cardActionPrompt } from "../src/lib/journey";

const DEVICE = "device-step-0001";

function makeApp(db: DB) {
  return createApp(db, { client: null });
}

describe("pure logic", () => {
  it("cardActionPrompt: card-flavored, with a generic fallback", () => {
    expect(cardActionPrompt("The Long Road")).toContain("Move one marker");
    expect(cardActionPrompt("The Watchful Moon")).toBe("Is there one thing you can move today?");
  });

  it("shouldAskStep: quiet after two consecutive declines, until days pass", () => {
    const twoDeclines = [
      { status: "declined", local_date: "2026-08-25" },
      { status: "declined", local_date: "2026-08-24" },
    ];
    expect(shouldAskStep(twoDeclines, "2026-08-26")).toBe(false);
    expect(shouldAskStep(twoDeclines, "2026-08-28")).toBe(true); // 3 days later
    expect(
      shouldAskStep(
        [{ status: "done", local_date: "2026-08-25" }, { status: "declined", local_date: "2026-08-24" }],
        "2026-08-26",
      ),
    ).toBe(true);
  });

  it("memoryLine: appears on some days, absent on others (rare by design)", () => {
    const base = {
      journeyId: "vow_x",
      startedLocalDate: "2026-06-01",
      moves: [{ text: "Go to the gym", local_date: "2026-06-22" }],
      nights: [],
    };
    const results = Array.from({ length: 20 }, (_, i) =>
      memoryLine({ ...base, todayLocalDate: `2026-07-${String(i + 1).padStart(2, "0")}` }),
    );
    const shown = results.filter(Boolean);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThan(results.length); // not every day
  });

  it("memoryLine: never phrases the count as a ratio of days", () => {
    // Even when it shows the count, it must be narrative, not N-of-M scoring.
    for (let i = 1; i <= 28; i++) {
      const line = memoryLine({
        journeyId: "vow_y",
        todayLocalDate: `2026-07-${String(i).padStart(2, "0")}`,
        startedLocalDate: "2026-06-01",
        moves: [
          { text: "Open the document", local_date: "2026-06-10" },
          { text: "Walk ten minutes", local_date: "2026-06-15" },
        ],
        nights: [],
      });
      if (line) {
        expect(line).not.toMatch(/\d+\s*\/\s*\d+/);
        expect(line.toLowerCase()).not.toContain("missed");
        expect(line.toLowerCase()).not.toContain("fail");
      }
    }
  });

  it("returnLine: quiet welcome after a gap, silence about the gap itself", () => {
    expect(returnLine("2026-08-20", "2026-08-01", "2026-08-21")).toBeNull(); // 1 day
    const line = returnLine("2026-08-10", "2026-08-01", "2026-08-24");
    expect(line).toBe("Day 24. The silence did not end the vow.");
    expect(line).not.toContain("14"); // never counts the absent days
  });
});

describe("step API (e2e)", () => {
  let db: DB;
  let api: ReturnType<typeof createApp>;

  beforeEach(async () => {
    db = createDb(":memory:");
    api = makeApp(db);
    await h(request(api).post("/api/journey")).send({
      enduring: "exercise I hate, for a body I want",
      hope: "to like the mirror",
    });
  });

  const h = (r: request.Test, date = "2026-08-26") =>
    r.set("x-device-id", DEVICE).set("x-local-date", date);

  it("commit -> snapshot shows the step -> resolve done -> witness line", async () => {
    const commit = await h(request(api).post("/api/journey/step")).send({
      text: "Go to the gym for 20 minutes",
    });
    expect(commit.body.step.status).toBe("committed");

    const snap = await h(request(api).get("/api/journey"));
    expect(snap.body.journey.living.todayStep.text).toContain("gym");
    expect(snap.body.journey.living.askStep).toBe(false); // already committed today

    const resolved = await h(request(api).post("/api/journey/step/resolve")).send({ done: true });
    expect(resolved.body.line).toBe("It moved today.");
  });

  it("NOT THIS TIME: no shame in the line, and nothing surfaces it later", async () => {
    await h(request(api).post("/api/journey/step")).send({ text: "One call" });
    const resolved = await h(request(api).post("/api/journey/step/resolve")).send({ done: false });
    expect(resolved.body.line).toBe("The vow is still here.");

    // The whole snapshot must never carry aggregate failure language.
    const snap = await h(request(api).get("/api/journey"), "2026-08-27");
    const body = JSON.stringify(snap.body).toLowerCase();
    expect(body).not.toContain("not_moved_count");
    expect(body).not.toContain("missed");
    expect(body).not.toContain("streak");
  });

  it("two declines silence the ask for a few days", async () => {
    await h(request(api).post("/api/journey/step/decline"), "2026-08-26").send({});
    await h(request(api).post("/api/journey/step/decline"), "2026-08-27").send({});
    const quiet = await h(request(api).get("/api/journey"), "2026-08-28");
    expect(quiet.body.journey.living.askStep).toBe(false);
    const later = await h(request(api).get("/api/journey"), "2026-08-30");
    expect(later.body.journey.living.askStep).toBe(true);
  });

  it("return after silence gets the quiet welcome line", async () => {
    await h(request(api).get("/api/journey"), "2026-08-26"); // seen today
    const back = await h(request(api).get("/api/journey"), "2026-09-09"); // 14 days later
    expect(back.body.journey.living.returnLine).toBe("Day 15. The silence did not end the vow.");
    // And immediately after, no more welcome (seen was touched).
    const again = await h(request(api).get("/api/journey"), "2026-09-09");
    expect(again.body.journey.living.returnLine).toBeNull();
  });

  it("crisis text in a step is caught", async () => {
    const res = await h(request(api).post("/api/journey/step")).send({
      text: "if this fails I will kill myself",
    });
    expect(res.body.isCrisis).toBe(true);
  });

  it("the vow card shapes the action prompt", async () => {
    const snap = await h(request(api).get("/api/journey"));
    expect(typeof snap.body.journey.living.actionPrompt).toBe("string");
    expect(snap.body.journey.living.actionPrompt.length).toBeGreaterThan(10);
  });
});
