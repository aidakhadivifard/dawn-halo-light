// The sealed letter: written at vow time for someone who is never told,
// unsealed only at fulfillment, burned unread at release. The whole feature
// rests on one invariant — while the vow is active, the letter's text never
// leaves the server, and no message of any kind reaches the recipient.

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createDb, type DB } from "../src/db";
import { createApp } from "../src/app";

const DEVICE = "device-letter-01";

function makeApp(db: DB) {
  return createApp(db, { client: null }); // deterministic fallback vow
}

const VOW = {
  enduring: "doing exercise I hate, for a body I want",
  hope: "to like what I see in the mirror",
  letterTo: "Amin",
  letterText: "Amin, I made this vow today. If you are reading this, I made it.",
};

describe("the sealed letter", () => {
  let db: DB;
  let api: ReturnType<typeof createApp>;

  beforeEach(() => {
    db = createDb(":memory:");
    api = makeApp(db);
  });

  const h = (r: request.Test, date = "2026-08-26") =>
    r.set("x-device-id", DEVICE).set("x-local-date", date);

  it("while active: only the initial is visible — never the name or text", async () => {
    const created = await h(request(api).post("/api/journey")).send(VOW);
    expect(created.status).toBe(200);
    expect(created.body.journey.letter).toEqual({ initial: "A", sealed: true });

    const snap = await h(request(api).get("/api/journey"));
    const body = JSON.stringify(snap.body);
    expect(body).not.toContain("Amin");
    expect(body).not.toContain("If you are reading this");
    expect(snap.body.journey.letter.sealed).toBe(true);
  });

  it("a vow without a letter has letter: null, and a half-filled letter is dropped", async () => {
    const created = await h(request(api).post("/api/journey")).send({
      enduring: "x is hard",
      hope: "y",
      letterTo: "Amin", // name but no text -> no letter
    });
    expect(created.body.journey.letter).toBeNull();
  });

  it("dark night line quietly mentions the sealed letter by initial only", async () => {
    await h(request(api).post("/api/journey")).send(VOW);
    const night = await h(request(api).post("/api/journey/dark-night"), "2026-09-05").send({
      text: "people like me don't become fit",
    });
    expect(night.body.context.line).toContain("The letter to A. is still sealed.");
    expect(night.body.context.line).not.toContain("Amin");
  });

  it("fulfillment unseals: close returns the letter + url, and the public page works", async () => {
    await h(request(api).post("/api/journey")).send(VOW);
    const closed = await h(request(api).post("/api/journey/close"), "2027-02-22").send({
      outcome: "fulfilled",
      note: "my clothes fit",
    });
    expect(closed.body.letter.to).toBe("Amin");
    expect(closed.body.letter.text).toContain("I made this vow today");
    expect(closed.body.letter.url).toContain("/letter/");
    expect(closed.body.letterBurned).toBe(false);

    const token = closed.body.letter.url.split("/letter/")[1];
    const pub = await request(api).get(`/api/letter/${token}`); // no device header
    expect(pub.status).toBe(200);
    expect(pub.body.letter.to).toBe("Amin");
    expect(pub.body.letter.writtenLocalDate).toBe("2026-08-26");
    expect(pub.body.letter.keepsake.daysHeld).toBe(181);
  });

  it("release burns the letter: hard-deleted, no trace anywhere", async () => {
    await h(request(api).post("/api/journey")).send(VOW);
    const closed = await h(request(api).post("/api/journey/close"), "2026-10-01").send({
      outcome: "released",
    });
    expect(closed.body.letter).toBeNull();
    expect(closed.body.letterBurned).toBe(true);

    // Nothing recoverable: not in the journey row, not via any letter token.
    const row = db.getJourney(closed.body.journey.id)!;
    expect(row.letter_to).toBeNull();
    expect(row.letter_text).toBeNull();
    expect(row.letter_token).toBeNull();

    // And the keepsake carries no mention of it.
    const keepsake = await request(api).get(
      `/api/keepsake/${closed.body.journey.keepsakeToken}`,
    );
    expect(JSON.stringify(keepsake.body)).not.toContain("Amin");
  });

  it("crisis text in the letter is caught before any vow is created", async () => {
    const res = await h(request(api).post("/api/journey")).send({
      ...VOW,
      letterText: "if I fail I will end my life",
    });
    expect(res.body.isCrisis).toBe(true);
    const snap = await h(request(api).get("/api/journey"));
    expect(snap.body.journey).toBeNull();
  });

  it("an unknown letter token 404s", async () => {
    const res = await request(api).get("/api/letter/ltr_nope");
    expect(res.status).toBe(404);
  });
});
