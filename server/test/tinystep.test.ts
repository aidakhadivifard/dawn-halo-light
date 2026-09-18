// The tiny step.
//
// What these tests protect, in order of how badly it would hurt to lose it:
//   1. "I endured and kept going" is NEVER followed by an ask. The person who
//      only survived today is not handed a task. If this breaks, the app has
//      become the thing it was built not to be.
//   2. Without a model there is NO step. We never invent an action for a life
//      we know nothing about.
//   3. The ladder stops itself. At some point the honest thing is to stop.
//   4. When the app does not know what a thing she named IS, it asks — it
//      never decides that "dawnhalo" is a file. And once she has answered, it
//      never asks again.

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createDb, type DB } from "../src/db";
import { createApp } from "../src/app";
import { nextTinyStep, type MessagesClient } from "../src/lib/anthropic";
import { cleanStep, parseStep, tinyStepPrompt, MAX_RUNGS, MAX_ASKS } from "../src/lib/tinystep";

const DEVICE = "device-step-0001";

function replying(text: string): MessagesClient {
  return { messages: { create: async () => ({ content: [{ type: "text", text }] }) } } as unknown as MessagesClient;
}

/** Records the prompt it was asked, so we can check what the model was told. */
function recording(text: string): { client: MessagesClient; prompts: string[] } {
  const prompts: string[] = [];
  const client = {
    messages: {
      create: async (args: any) => {
        prompts.push(args.messages[0].content);
        return { content: [{ type: "text", text }] };
      },
    },
  } as unknown as MessagesClient;
  return { client, prompts };
}

describe("shaping the step", () => {
  it("keeps one line and strips fences, bullets and quotes", () => {
    expect(cleanStep('```\n- "Put on your running shoes."\n```')).toBe("Put on your running shoes.");
    expect(cleanStep("1) Open the document.")).toBe("Open the document.");
    expect(cleanStep("Put on your shoes.\n\nThen, once you have, consider that…")).toBe("Put on your shoes.");
    expect(cleanStep("   ")).toBeNull();
    expect(cleanStep("")).toBeNull();
  });

  it("a step is never long enough to be a plan", () => {
    expect(cleanStep("x".repeat(500))!.length).toBeLessThanOrEqual(180);
  });

  it("the prompt carries their words verbatim and forbids inventing", () => {
    const p = tinyStepPrompt({
      wish: "a quiet house by the sea",
      today: "wrote to one person about it",
      done: ["opened the laptop"],
    });
    expect(p).toContain("a quiet house by the sea");
    expect(p).toContain("wrote to one person about it");
    expect(p).toContain("1. opened the laptop");
    expect(p).toContain("Invent nothing");
  });

  it("the stuck prompt asks for the smallest possible thing, and never scolds", () => {
    const p = tinyStepPrompt({ wish: "a body I trust", today: null, done: [] });
    expect(p).toContain("a body I trust");
    expect(p).toContain("SMALLEST POSSIBLE");
    expect(p).toContain("no feeling ready");
    // The model is told explicitly not to hold the day against them.
    expect(p).toContain("Never refer to what they failed to do");
    expect(p).toContain("not lazy");
    expect(p).toContain("Invent nothing");
  });

  it("tells the model to ask, not guess, what a named thing is", () => {
    const p = tinyStepPrompt({ wish: "my career taking off", today: "working on dawnhalo", done: [] });
    expect(p).toContain("do NOT guess");
    expect(p).toContain("ASK:");
  });

  it("carries what she has already explained, and stops asking when told to", () => {
    const told = [{ question: "What is dawnhalo?", answer: "an app I'm building" }];
    const p = tinyStepPrompt({ wish: "my career taking off", today: "working on dawnhalo", done: [], told });
    expect(p).toContain('Asked "What is dawnhalo?" they said: "an app I\'m building"');
    expect(p).toContain("ASK:");

    const quiet = tinyStepPrompt({ wish: "w", today: "t", done: [], told, noAsking: true });
    expect(quiet).toContain("Do not ask them anything");
    expect(quiet).not.toContain("ASK:");
  });
});

describe("reading the model's answer", () => {
  it("a step is a step", () => {
    expect(parseStep("Open the laptop. That's all.")).toEqual({ kind: "step", text: "Open the laptop. That's all." });
  });

  it("an old-style DONE line under the step is dropped, not shown", () => {
    expect(parseStep("Put your shoes by the door.\nDONE: Shoes are by the door.")).toEqual({
      kind: "step",
      text: "Put your shoes by the door.",
    });
  });

  it("a question, marked ASK, is a question — however it was wrapped", () => {
    expect(parseStep("ASK: What is dawnhalo?")).toEqual({ kind: "ask", text: "What is dawnhalo?" });
    expect(parseStep('```\n- "ask: What is dawnhalo?"\n```')).toEqual({ kind: "ask", text: "What is dawnhalo?" });
    expect(parseStep("ASK: داون‌هیلو چیست؟")).toEqual({ kind: "ask", text: "داون‌هیلو چیست؟" });
  });

  it("nothing is nothing", () => {
    expect(parseStep("")).toBeNull();
    expect(parseStep("ASK:")).toBeNull();
    expect(parseStep("DONE: Sent.")).toBeNull();
  });
});

describe("asking for a step", () => {
  const input = { wish: "a body I trust", today: "walked to the corner", done: [] };

  it("returns the model's action", async () => {
    expect(await nextTinyStep(input, { client: replying("Put your shoes by the door.") })).toEqual({
      kind: "step",
      text: "Put your shoes by the door.",
    });
  });

  it("returns the model's question when it has one", async () => {
    expect(await nextTinyStep(input, { client: replying("ASK: What is dawnhalo?") })).toEqual({
      kind: "ask",
      text: "What is dawnhalo?",
    });
  });

  it("a question when questions were forbidden is nothing — never a guess", async () => {
    expect(await nextTinyStep({ ...input, noAsking: true }, { client: replying("ASK: What is it?") })).toBeNull();
  });

  it("offers NOTHING rather than invent one — no model, or a failing one", async () => {
    expect(await nextTinyStep(input, { client: null })).toBeNull();
    const broken = { messages: { create: async () => { throw new Error("boom"); } } } as unknown as MessagesClient;
    expect(await nextTinyStep(input, { client: broken })).toBeNull();
    expect(await nextTinyStep(input, { client: replying("") })).toBeNull();
  });
});

describe("the ladder, end to end", () => {
  let db: DB;

  const h = (r: request.Test, date = "2026-09-01") =>
    r.set("x-device-id", DEVICE).set("x-local-date", date);

  beforeEach(() => {
    db = createDb(":memory:");
  });

  it("NEVER offers a step after 'I endured and kept going'", async () => {
    const api = createApp(db, { client: replying("Put on your running clothes.") });
    await h(request(api).put("/api/horizon")).send({ text: "a body I trust" });
    await h(request(api).post("/api/deed")).send({ kind: "stayed" });

    const step = await h(request(api).post("/api/step/next"));
    expect(step.status).toBe(200);
    expect(step.body.step).toBeNull();
  });

  it("offers one after 'I did one small thing', and tells the model what was done", async () => {
    const { client, prompts } = recording("Put on your running clothes. That's all.");
    const api = createApp(db, { client });
    await h(request(api).put("/api/horizon")).send({ text: "a body I trust" });
    await h(request(api).post("/api/deed")).send({ kind: "did", text: "walked to the corner" });

    const step = await h(request(api).post("/api/step/next"));
    expect(step.body.step).toBe("Put on your running clothes. That's all.");
    expect(prompts[0]).toContain("a body I trust");
    expect(prompts[0]).toContain("walked to the corner");
  });

  it("a finished step counts exactly like any other answer — it brings color", async () => {
    const api = createApp(db, { client: replying("Put on your running clothes.") });
    await h(request(api).put("/api/horizon")).send({ text: "a body I trust" });
    const first = await h(request(api).post("/api/deed")).send({ kind: "did", text: "walked to the corner" });
    expect(first.body.sketch.lit).toBe(1);

    // The client records a finished step as an ordinary deed.
    const done = await h(request(api).post("/api/deed")).send({ kind: "did", text: "Put on your running clothes." });
    expect(done.body.sketch.lit).toBe(2);
  });

  it("stops itself once the ladder has run its length", async () => {
    const api = createApp(db, { client: replying("One more small thing.") });
    await h(request(api).put("/api/horizon")).send({ text: "a body I trust" });
    await h(request(api).post("/api/deed")).send({ kind: "did", text: "walked to the corner" });

    for (let i = 0; i < MAX_RUNGS; i++) {
      const step = await h(request(api).post("/api/step/next"));
      expect(step.body.step).not.toBeNull();
      await h(request(api).post("/api/deed")).send({ kind: "did", text: `rung ${i}` });
    }
    const after = await h(request(api).post("/api/step/next"));
    expect(after.body.step).toBeNull();

    // And tomorrow it opens again — the limit is a day's limit, not a verdict.
    await h(request(api).post("/api/deed"), "2026-09-02").send({ kind: "did", text: "a new day" });
    const tomorrow = await h(request(api).post("/api/step/next"), "2026-09-02");
    expect(tomorrow.body.step).not.toBeNull();
  });

  it("'I did nothing, and it bothers me' opens the ladder — this is who it is for", async () => {
    const { client, prompts } = recording("Put on your running clothes. That's all.");
    const api = createApp(db, { client });
    await h(request(api).put("/api/horizon")).send({ text: "a body I trust" });

    const said = await h(request(api).post("/api/deed")).send({ kind: "stuck" });
    expect(said.status).toBe(200);
    expect(said.body.deed.kind).toBe("stuck");
    // Saying it out loud counts exactly as much as anything else. She came.
    expect(said.body.sketch.lit).toBe(1);

    const step = await h(request(api).post("/api/step/next"));
    expect(step.body.step).toBe("Put on your running clothes. That's all.");
    expect(prompts[0]).toContain("SMALLEST POSSIBLE");
    expect(prompts[0]).toContain("a body I trust");
  });

  it("all three answers bring back exactly the same amount of color", async () => {
    const api = createApp(db, { client: null });
    await h(request(api).put("/api/horizon")).send({ text: "a body I trust" });
    const a = await h(request(api).post("/api/deed"), "2026-09-01").send({ kind: "stayed" });
    const b = await h(request(api).post("/api/deed"), "2026-09-02").send({ kind: "stuck" });
    const c = await h(request(api).post("/api/deed"), "2026-09-03").send({ kind: "did", text: "walked" });
    expect([a.body.sketch.lit, b.body.sketch.lit, c.body.sketch.lit]).toEqual([1, 2, 3]);
  });

  it("no wish, and no answer given yet, mean no step", async () => {
    const api = createApp(db, { client: replying("Something.") });
    expect((await h(request(api).post("/api/step/next"))).body.step).toBeNull();
    await h(request(api).put("/api/horizon")).send({ text: "a body I trust" });
    expect((await h(request(api).post("/api/step/next"))).body.step).toBeNull();
  });

  it("answers with the step and no question", async () => {
    const api = createApp(db, { client: replying("Open the laptop.") });
    await h(request(api).put("/api/horizon")).send({ text: "my career taking off" });
    await h(request(api).post("/api/deed")).send({ kind: "did", text: "working on dawnhalo" });
    const step = await h(request(api).post("/api/step/next"));
    expect(step.body).toEqual({ step: "Open the laptop.", ask: null });
  });
});

describe("when the app does not know what a thing is", () => {
  let db: DB;
  const h = (r: request.Test, date = "2026-09-01") =>
    r.set("x-device-id", DEVICE).set("x-local-date", date);

  /** A model that asks until it has been told, then gives a step built on the answer. */
  function honest(): { client: MessagesClient; prompts: string[] } {
    const prompts: string[] = [];
    const client = {
      messages: {
        create: async (args: any) => {
          const p: string = args.messages[0].content;
          prompts.push(p);
          const text = p.includes("they said:")
            ? "Open the dawnhalo project. Just look at it."
            : "ASK: What is dawnhalo?";
          return { content: [{ type: "text", text }] };
        },
      },
    } as unknown as MessagesClient;
    return { client, prompts };
  }

  beforeEach(() => {
    db = createDb(":memory:");
  });

  it("asks instead of deciding that dawnhalo is a file", async () => {
    const { client } = honest();
    const api = createApp(db, { client });
    await h(request(api).put("/api/horizon")).send({ text: "my career taking off" });
    await h(request(api).post("/api/deed")).send({ kind: "did", text: "working on dawnhalo" });

    const first = await h(request(api).post("/api/step/next"));
    expect(first.body).toEqual({ step: null, ask: "What is dawnhalo?" });
  });

  it("her answer is kept with the wish, and the step is built on it", async () => {
    const { client, prompts } = honest();
    const api = createApp(db, { client });
    await h(request(api).put("/api/horizon")).send({ text: "my career taking off" });
    await h(request(api).post("/api/deed")).send({ kind: "did", text: "working on dawnhalo" });
    await h(request(api).post("/api/step/next"));

    const answered = await h(request(api).post("/api/step/answer")).send({
      question: "What is dawnhalo?",
      answer: "an app I'm building",
    });
    expect(answered.body.step).toBe("Open the dawnhalo project. Just look at it.");
    expect(prompts[1]).toContain(`Asked "What is dawnhalo?" they said: "an app I'm building"`);

    // Tomorrow it still knows. It does not ask what dawnhalo is a second time.
    await h(request(api).post("/api/deed"), "2026-09-02").send({ kind: "did", text: "more dawnhalo" });
    const tomorrow = await h(request(api).post("/api/step/next"), "2026-09-02");
    expect(tomorrow.body.ask).toBeNull();
    expect(tomorrow.body.step).not.toBeNull();
    expect(prompts[2]).toContain("an app I'm building");
  });

  it("an empty answer is not an answer", async () => {
    const api = createApp(db, { client: honest().client });
    await h(request(api).put("/api/horizon")).send({ text: "w" });
    await h(request(api).post("/api/deed")).send({ kind: "did", text: "t" });
    await h(request(api).post("/api/step/answer")).send({ question: "What is it?", answer: "  " }).expect(400);
  });

  it("stops asking after a couple of questions and just offers a step", async () => {
    // A model that would ask forever.
    const prompts: string[] = [];
    const client = {
      messages: {
        create: async (args: any) => {
          prompts.push(args.messages[0].content);
          return { content: [{ type: "text", text: "ASK: And what is that?" }] };
        },
      },
    } as unknown as MessagesClient;
    const api = createApp(db, { client });
    await h(request(api).put("/api/horizon")).send({ text: "w" });
    await h(request(api).post("/api/deed")).send({ kind: "did", text: "t" });

    for (let i = 0; i < MAX_ASKS; i++) {
      const r = await h(request(api).post("/api/step/answer")).send({ question: `q${i}`, answer: `a${i}` });
      // Still allowed to ask before the cap is reached; the last answer hits it.
      if (i < MAX_ASKS - 1) expect(r.body.ask).toBe("And what is that?");
    }
    // Once it may not ask, it was told so — and its question is not passed on.
    expect(prompts[prompts.length - 1]).toContain("Do not ask them anything");
    const after = await h(request(api).post("/api/step/next"));
    expect(after.body.ask).toBeNull();
    expect(after.body.step).toBeNull();
  });
});
