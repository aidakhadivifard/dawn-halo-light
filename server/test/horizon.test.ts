// Horizon & Roads — one horizon (the life they are walking toward, never
// measured), at most two roads (vows). These tests guard the invariants:
// the horizon has no day number and no closing; a third road is refused; every
// road action resolves to the right road; the horizon reaches the vow prompt
// and the daily reading; nothing about the horizon is ever counted.

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createDb, type DB } from "../src/db";
import { createApp } from "../src/app";
import { MAX_ROADS } from "../src/service";
import { buildVowPrompt, buildUserPrompt } from "../src/lib/prompt";
import type { MessagesClient } from "../src/lib/anthropic";

const DEVICE = "device-horizon-0001";

function makeApp(db: DB, client: MessagesClient | null = null) {
  return createApp(db, { client });
}

/** A fake Anthropic client that records the prompts it was asked. */
function recordingClient(reply: object): { client: MessagesClient; prompts: string[] } {
  const prompts: string[] = [];
  const client = {
    messages: {
      create: async (args: any) => {
        prompts.push(args.messages[0].content);
        return { content: [{ type: "text", text: JSON.stringify(reply) }] };
      },
    },
  } as unknown as MessagesClient;
  return { client, prompts };
}

describe("prompts", () => {
  it("vow prompt carries the horizon as something to witness, never to measure", () => {
    const p = buildVowPrompt({ enduring: "the gym", hope: "to feel at home in my body", horizon: "a rich, beautiful life with two kids" });
    expect(p).toContain("a rich, beautiful life with two kids");
    expect(p).toContain("never measure it");
  });

  it("vow prompt is unchanged in shape without a horizon", () => {
    const p = buildVowPrompt({ enduring: "x", hope: "y" });
    expect(p).not.toContain("horizon");
  });

  it("daily reading prompt mentions the horizon only when one exists", () => {
    const base = { enduring: "x", hope: "y", cardTitle: "The Long Road", dayNumber: 3 };
    expect(buildUserPrompt({ intent: "general", journey: base })).not.toContain("horizon");
    expect(buildUserPrompt({ intent: "general", journey: { ...base, horizon: "a quiet house by the sea" } })).toContain(
      "a quiet house by the sea",
    );
  });
});

describe("horizon & roads API", () => {
  let db: DB;
  let api: ReturnType<typeof createApp>;

  beforeEach(() => {
    db = createDb(":memory:");
    api = makeApp(db);
  });

  const h = (r: request.Test, date = "2026-09-01") =>
    r.set("x-device-id", DEVICE).set("x-local-date", date);

  it("home is empty before anything is named", async () => {
    const home = await h(request(api).get("/api/home"));
    expect(home.status).toBe(200);
    expect(home.body).toMatchObject({ horizon: null, roads: [], maxRoads: MAX_ROADS });
  });

  it("horizon: set, read, rename — and it carries no numbers of any kind", async () => {
    const set = await h(request(api).put("/api/horizon")).send({ text: "  rich, beautiful, two kids  " });
    expect(set.status).toBe(200);
    expect(set.body.horizon).toBe("rich, beautiful, two kids");

    const get = await h(request(api).get("/api/horizon"));
    expect(get.body.horizon).toBe("rich, beautiful, two kids");

    const renamed = await h(request(api).put("/api/horizon")).send({ text: "a life I am not ashamed of" });
    expect(renamed.body.horizon).toBe("a life I am not ashamed of");

    const home = await h(request(api).get("/api/home"));
    expect(home.body.horizon).toBe("a life I am not ashamed of");
    // The horizon is a string, never an object with a day count or progress.
    expect(typeof home.body.horizon).toBe("string");
  });

  it("horizon: empty is rejected, crisis language is met with care and not stored", async () => {
    const empty = await h(request(api).put("/api/horizon")).send({ text: "   " });
    expect(empty.status).toBe(400);

    const crisis = await h(request(api).put("/api/horizon")).send({ text: "I can't go on anymore" });
    expect(crisis.status).toBe(200);
    expect(crisis.body.isCrisis).toBe(true);
    const get = await h(request(api).get("/api/horizon"));
    expect(get.body.horizon).toBeNull();
  });

  it("roads: two open side by side with labels, a third is refused", async () => {
    const r1 = await h(request(api).post("/api/journey")).send({
      label: "Body",
      enduring: "going to the gym when I hate it",
      hope: "to feel at home in my body",
    });
    expect(r1.status).toBe(200);
    expect(r1.body.journey.label).toBe("Body");

    const r2 = await h(request(api).post("/api/journey")).send({
      label: "Pink Wallet",
      enduring: "the hard months of building",
      hope: "it pays my rent",
    });
    expect(r2.status).toBe(200);
    expect(r2.body.journey.label).toBe("Pink Wallet");
    expect(r2.body.journey.id).not.toBe(r1.body.journey.id);

    const r3 = await h(request(api).post("/api/journey")).send({ enduring: "a", hope: "b" });
    expect(r3.status).toBe(409);
    expect(r3.body.error).toBe("roads_full");
    expect(r3.body.roads).toHaveLength(2);
    expect(r3.body.maxRoads).toBe(MAX_ROADS);

    const home = await h(request(api).get("/api/home"));
    expect(home.body.roads.map((r: any) => r.label)).toEqual(["Body", "Pink Wallet"]);
    // Every road carries its own living state.
    for (const road of home.body.roads) {
      expect(road.living).toBeDefined();
      expect(typeof road.living.actionPrompt).toBe("string");
    }
  });

  it("road actions resolve by journeyId and never leak across roads", async () => {
    const r1 = await h(request(api).post("/api/journey")).send({ label: "Body", enduring: "e1", hope: "h1" });
    const r2 = await h(request(api).post("/api/journey")).send({ label: "Work", enduring: "e2", hope: "h2" });
    const id1 = r1.body.journey.id;
    const id2 = r2.body.journey.id;

    // A step on road 2 only.
    const step = await h(request(api).post("/api/journey/step")).send({ journeyId: id2, text: "send one email" });
    expect(step.status).toBe(200);
    const j1 = await h(request(api).get("/api/journey").query({ journeyId: id1 }));
    const j2 = await h(request(api).get("/api/journey").query({ journeyId: id2 }));
    expect(j1.body.journey.living.todayStep).toBeNull();
    expect(j2.body.journey.living.todayStep.text).toBe("send one email");

    // A dark night on road 1 only.
    const night = await h(request(api).post("/api/journey/dark-night")).send({ journeyId: id1, text: "I skipped again" });
    expect(night.status).toBe(200);
    expect(night.body.context.nightNumber).toBe(1);
    const after = await h(request(api).get("/api/home"));
    const road1 = after.body.roads.find((r: any) => r.id === id1);
    const road2 = after.body.roads.find((r: any) => r.id === id2);
    expect(road1.darkNights).toHaveLength(1);
    expect(road2.darkNights).toHaveLength(0);

    // A foreign or unknown journeyId is simply not found.
    const bogus = await h(request(api).post("/api/journey/step")).send({ journeyId: "vow_nope", text: "x" });
    expect(bogus.status).toBe(404);

    // Closing road 1 leaves road 2 untouched and reopens a slot.
    const closed = await h(request(api).post("/api/journey/close")).send({ outcome: "fulfilled", journeyId: id1 });
    expect(closed.status).toBe(200);
    expect(closed.body.journey.id).toBe(id1);
    const home = await h(request(api).get("/api/home"));
    expect(home.body.roads.map((r: any) => r.id)).toEqual([id2]);
    const r3 = await h(request(api).post("/api/journey")).send({ enduring: "e3", hope: "h3" });
    expect(r3.status).toBe(200);
  });

  it("with one road, journeyId is optional (old clients keep working)", async () => {
    await h(request(api).post("/api/journey")).send({ enduring: "e1", hope: "h1" });
    const step = await h(request(api).post("/api/journey/step")).send({ text: "walk ten minutes" });
    expect(step.status).toBe(200);
    const j = await h(request(api).get("/api/journey"));
    expect(j.body.journey.living.todayStep.text).toBe("walk ten minutes");
  });

  it("the horizon reaches the vow prompt and the daily reading", async () => {
    const { client, prompts } = recordingClient({
      opener: "Turning this one over…",
      title: "The Long Road",
      message: "a\n\nb\n\nc",
      reflection: "What holds?",
      theme: "guidance_decision",
    });
    api = makeApp(db, client);

    await h(request(api).put("/api/horizon")).send({ text: "a rich, beautiful life with two kids" });
    const vow = await h(request(api).post("/api/journey")).send({ enduring: "the gym", hope: "a body I trust" });
    expect(vow.status).toBe(200);
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("a rich, beautiful life with two kids");
    expect(prompts[0]).toContain("witness it, never measure it");

    const daily = await h(request(api).get("/api/cards/daily"));
    expect(daily.status).toBe(200);
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("a rich, beautiful life with two kids");
    expect(prompts[1]).toContain("never a goal to measure");
  });
});
