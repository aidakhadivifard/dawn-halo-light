// Express app factory. Kept separate from the listen() bootstrap so tests can
// import a fully-wired app with an in-memory DB and a mocked Claude client.

import express, { type Request, type Response } from "express";
import cors from "cors";
import type { DB } from "./db";
import { createService, type ServiceDeps } from "./service";
import { getConfig } from "./config";
import { requireDevice, resolveLocalDate, rateLimit } from "./middleware";
import { computeStreak } from "./lib/streak";
import { PLANS, getStripe, createCheckoutSession, handleStripeEvent, type PlanId } from "./lib/stripe";
import { HALO_DECK } from "./lib/deck";

export interface AppOptions extends ServiceDeps {
  /** Inject a custom Stripe webhook verifier (tests bypass signature checks). */
  verifyStripe?: (rawBody: Buffer, sig: string | undefined) => { type: string; data: { object: any } };
}

export function createApp(db: DB, opts: AppOptions = {}) {
  const app = express();
  const svc = createService(db, opts);
  const cfg = getConfig();
  const nowFn = opts.now ?? (() => new Date());

  app.use(
    cors({
      origin: cfg.corsOrigins === "*" ? true : cfg.corsOrigins.split(",").map((s) => s.trim()),
    }),
  );

  // Stripe webhook needs the RAW body for signature verification — mount it
  // before express.json().
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    (req: Request, res: Response) => {
      const sig = req.header("stripe-signature");
      let event: { type: string; data: { object: any } };
      try {
        if (opts.verifyStripe) {
          event = opts.verifyStripe(req.body as Buffer, sig);
        } else {
          const stripe = getStripe();
          if (!stripe || !cfg.stripeWebhookSecret) {
            return res.status(503).json({ error: "stripe_not_configured" });
          }
          event = stripe.webhooks.constructEvent(
            req.body as Buffer,
            sig ?? "",
            cfg.stripeWebhookSecret,
          ) as any;
        }
      } catch (err) {
        return res.status(400).json({ error: "invalid_signature" });
      }
      const result = handleStripeEvent(db, event);
      return res.json({ received: true, handled: result.handled });
    },
  );

  app.use(express.json({ limit: "32kb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true, model: cfg.anthropicModel }));

  app.get("/api/plans", (_req, res) => res.json({ plans: PLANS }));

  // --- Entitlement ---
  app.get("/api/entitlement", requireDevice, resolveLocalDate, (req, res) => {
    res.json(svc.entitlement(req.deviceId!, req.localDate!));
  });

  // --- Cards (rate-limited for cost control) ---
  const cardLimiter = rateLimit({ capacity: 30, refillPerSec: 0.5 });

  app.get("/api/cards/daily", requireDevice, resolveLocalDate, cardLimiter, async (req, res) => {
    const card = await svc.getDailyCard(req.deviceId!, req.localDate!);
    res.json({ card, entitlement: svc.entitlement(req.deviceId!, req.localDate!) });
  });

  app.post("/api/cards/draw", requireDevice, resolveLocalDate, cardLimiter, async (req, res) => {
    const intent = req.body?.intent === "ask" || req.body?.intent === "feel" ? req.body.intent : "ask";
    const text = (req.body?.text ?? "").toString();
    const result = await svc.drawCard(req.deviceId!, req.localDate!, { intent, text });
    respondDraw(res, result, svc.entitlement(req.deviceId!, req.localDate!));
  });

  app.post("/api/cards/follow-up", requireDevice, resolveLocalDate, cardLimiter, async (req, res) => {
    const previousCardId = (req.body?.previousCardId ?? "").toString();
    const text = (req.body?.text ?? "").toString();
    if (!previousCardId) return res.status(400).json({ error: "missing_previous_card_id" });
    const result = await svc.askFollowUp(req.deviceId!, req.localDate!, { previousCardId, text });
    if (result.kind === "not_found") return res.status(404).json({ error: "card_not_found" });
    if (result.kind === "already_used")
      return res.status(409).json({ error: "follow_up_already_used" });
    respondDraw(res, result, svc.entitlement(req.deviceId!, req.localDate!));
  });

  // --- History / calendar / streak ---
  app.get("/api/history", requireDevice, (req, res) => {
    const rows = db.history(req.deviceId!, 200).map((r) => svc.toCard(r));
    res.json({ history: rows });
  });

  app.get("/api/calendar", requireDevice, resolveLocalDate, (req, res) => {
    const rows = db.history(req.deviceId!, 365);
    const byDay: Record<string, ReturnType<typeof svc.toCard>[]> = {};
    for (const r of rows) (byDay[r.local_date] ||= []).push(svc.toCard(r));
    const streak = computeStreak(Object.keys(byDay), req.localDate!);
    res.json({ byDay, streak });
  });

  // --- Saved ---
  app.get("/api/saved", requireDevice, (req, res) => {
    const rows = db.listSaved(req.deviceId!).map((r) => ({
      id: r.id,
      opener: r.opener,
      title: r.title,
      message: r.message,
      reflection: r.reflection ?? undefined,
      theme: r.theme,
      illustrationId: r.illustration_id,
      createdAt: r.created_at,
      savedAt: r.saved_at,
    }));
    res.json({ saved: rows });
  });

  app.post("/api/saved", requireDevice, (req, res) => {
    const c = req.body?.card;
    if (!c?.id || !c?.title || !c?.message) return res.status(400).json({ error: "invalid_card" });
    db.saveCard({
      id: c.id,
      device_id: req.deviceId!,
      theme: c.theme ?? "daily_general",
      illustration_id: c.illustrationId ?? "",
      opener: c.opener ?? "",
      title: c.title,
      message: c.message,
      reflection: c.reflection ?? null,
      created_at: c.createdAt ?? new Date().toISOString(),
    });
    res.json({ ok: true });
  });

  app.delete("/api/saved/:id", requireDevice, (req, res) => {
    db.removeSaved(req.deviceId!, req.params.id);
    res.json({ ok: true });
  });

  // --- Settings ---
  app.get("/api/settings", requireDevice, (req, res) => {
    const s = db.getSettings(req.deviceId!);
    res.json({
      reminderTime: s?.reminder_time ?? "07:30",
      notificationsOn: s ? !!s.notifications_on : true,
    });
  });

  app.put("/api/settings", requireDevice, (req, res) => {
    const reminderTime = (req.body?.reminderTime ?? "07:30").toString();
    const notificationsOn = req.body?.notificationsOn !== false;
    db.setSettings(req.deviceId!, reminderTime, notificationsOn);
    res.json({ ok: true });
  });

  // --- Endurance goal ("what you're holding on for") ---
  app.get("/api/goal", requireDevice, resolveLocalDate, (req, res) => {
    res.json({ status: svc.goalStatus(req.deviceId!, req.localDate!) });
  });

  app.post("/api/goal", requireDevice, resolveLocalDate, (req, res) => {
    const result = svc.createGoal(req.deviceId!, req.localDate!, {
      title: (req.body?.title ?? "").toString(),
      reward: (req.body?.reward ?? "").toString(),
      targetDate: (req.body?.targetDate ?? "").toString(),
      photoUrl: req.body?.photoUrl ? req.body.photoUrl.toString() : undefined,
      ritual: (req.body?.ritual ?? "card").toString(),
    });
    if (result.kind === "exists") return res.status(409).json({ error: "goal_already_active" });
    if (result.kind === "invalid") return res.status(400).json({ error: result.reason });
    res.json({ status: result.status });
  });

  app.patch("/api/goal", requireDevice, resolveLocalDate, (req, res) => {
    const result = svc.updateGoal(req.deviceId!, {
      title: req.body?.title !== undefined ? req.body.title.toString() : undefined,
      photoUrl:
        req.body?.photoUrl !== undefined
          ? req.body.photoUrl === null
            ? null
            : req.body.photoUrl.toString()
          : undefined,
      ritual: req.body?.ritual !== undefined ? req.body.ritual.toString() : undefined,
    });
    if (result.kind === "no_goal") return res.status(404).json({ error: "no_active_goal" });
    res.json({ ok: true, status: svc.goalStatus(req.deviceId!, req.localDate!) });
  });

  app.post("/api/goal/close", requireDevice, resolveLocalDate, (req, res) => {
    const reason = req.body?.reason === "completed" ? "completed" : "abandoned";
    const result = svc.closeGoal(req.deviceId!, req.localDate!, reason);
    if (result.kind === "no_goal") return res.status(404).json({ error: "no_active_goal" });
    if (result.kind === "target_not_reached")
      return res.status(400).json({ error: "target_not_reached" });
    res.json({ summary: result.summary });
  });

  app.post("/api/goal/checkin", requireDevice, resolveLocalDate, (req, res) => {
    const result = svc.checkin(req.deviceId!, req.localDate!, {
      state: (req.body?.state ?? "").toString(),
      note: (req.body?.note ?? "").toString(),
    });
    if (result.kind === "crisis") {
      return res
        .status(200)
        .json({ isCrisis: true, message: result.message, resources: result.resources });
    }
    if (result.kind === "no_goal") return res.status(404).json({ error: "no_active_goal" });
    if (result.kind === "invalid") return res.status(400).json({ error: result.reason });
    res.json({ checkin: result.payload });
  });

  app.post("/api/goal/ritual", requireDevice, resolveLocalDate, cardLimiter, async (req, res) => {
    const type = req.body?.type === "writing" ? "writing" : "card";
    const text = (req.body?.text ?? "").toString();
    if (type === "writing" && !text.trim())
      return res.status(400).json({ error: "missing_text" });
    const result = await svc.ritual(req.deviceId!, req.localDate!, { type, text });
    if (result.kind === "crisis") {
      return res
        .status(200)
        .json({ isCrisis: true, message: result.message, resources: result.resources });
    }
    if (result.kind === "no_goal") return res.status(404).json({ error: "no_active_goal" });
    if (result.kind === "no_checkin") return res.status(400).json({ error: "checkin_required" });
    if (result.kind === "already_done")
      return res.status(409).json({ error: "ritual_already_done" });
    if (result.kind === "invalid") return res.status(400).json({ error: result.reason });
    if (result.kind === "paywall") {
      return res.status(402).json({
        paywall: true,
        reason: result.reason,
        entitlement: svc.entitlement(req.deviceId!, req.localDate!),
      });
    }
    if (result.kind === "card") return res.json({ card: result.card });
    res.json({ reflection: result.reflection, fallback: result.fallback });
  });

  app.post("/api/goal/honesty", requireDevice, resolveLocalDate, (req, res) => {
    const result = svc.honesty(
      req.deviceId!,
      req.localDate!,
      (req.body?.answer ?? "").toString(),
      (req.body?.note ?? "").toString(),
    );
    if (result.kind === "no_goal") return res.status(404).json({ error: "no_active_goal" });
    if (result.kind === "invalid") return res.status(400).json({ error: result.reason });
    res.json({ ok: true, summary: result.summary });
  });

  app.get("/api/goal/history", requireDevice, resolveLocalDate, (req, res) => {
    const result = svc.goalHistory(req.deviceId!, req.localDate!);
    if (result.kind === "no_goal") return res.status(404).json({ error: "no_active_goal" });
    if (result.kind === "paywall") {
      return res.status(402).json({
        paywall: true,
        reason: result.reason,
        entitlement: svc.entitlement(req.deviceId!, req.localDate!),
      });
    }
    res.json({ checkins: result.checkins, entries: result.entries, honesty: result.honesty });
  });

  // --- The Witness (one chosen person sees the Day number, nothing else) ---

  // Until the web frontend is deployed somewhere public, the API host itself
  // serves the witness page — the invite link must open in a plain browser
  // from day one, or the growth loop's killer test never runs.
  function publicBase(req: Request): string {
    if (cfg.appBaseUrl && !/localhost|127\.0\.0\.1/.test(cfg.appBaseUrl)) {
      return cfg.appBaseUrl.replace(/\/$/, "");
    }
    const host = req.get("host") ?? "localhost";
    const proto = (req.get("x-forwarded-proto") ?? req.protocol ?? "https").split(",")[0];
    return `${proto}://${host}`;
  }

  app.post("/api/goal/witness", requireDevice, (req, res) => {
    const invite = svc.createWitnessInvite(req.deviceId!);
    if (!invite) return res.status(404).json({ error: "no_active_goal" });
    res.json({ token: invite.token, url: `${publicBase(req)}/witness/${invite.token}` });
  });

  // The heavy-day signal — one dated flag, no words, no reply expected.
  app.post("/api/goal/witness/signal", requireDevice, resolveLocalDate, (req, res) => {
    const result = svc.witnessSignal(req.deviceId!, req.localDate!);
    if (!result) return res.status(404).json({ error: "no_witness" });
    res.json({ ok: true });
  });

  // Public — the witness opens this in a plain browser, no app required.
  app.get("/api/witness/:token", (req, res) => {
    const q = String(req.query.date ?? "");
    const date = /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : nowFn().toISOString().slice(0, 10);
    const view = svc.witnessView(req.params.token, date);
    if (!view) return res.status(404).json({ error: "witness_not_found" });
    res.json(view);
  });

  // The server-rendered witness page (all values are numbers/booleans — no
  // user text ever reaches this HTML, by design).
  app.get("/witness/:token", (req, res) => {
    const date = nowFn().toISOString().slice(0, 10);
    const view = svc.witnessView(req.params.token, date);
    const page = (body: string) =>
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>You are their witness — Dawnhalo</title><style>body{margin:0;background:#fdfcfb;color:#2d2a2e;font-family:Georgia,'Times New Roman',serif;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center}main{max-width:26rem;padding:3rem 1.5rem}.k{font-family:system-ui,sans-serif;font-size:.62rem;letter-spacing:.22em;text-transform:uppercase;opacity:.5}.day{font-size:6rem;font-weight:300;line-height:1;margin:.5rem 0 0}.card{background:#fff;border:1px solid rgba(45,42,46,.07);border-radius:1.25rem;padding:2.5rem 1.75rem;margin:2rem 0;box-shadow:0 30px 60px -30px rgba(45,42,46,.18)}.soft{opacity:.65;font-style:italic}.note{font-size:.9rem;line-height:1.6;opacity:.6}</style></head><body><main>${body}</main></body></html>`;
    if (!view) {
      return res
        .status(404)
        .send(page(`<h1 style="font-style:italic;font-weight:300">This door is closed.</h1><p class="note">The link couldn't be opened. Ask them to send you a fresh one.</p>`));
    }
    if (!view.active) {
      return res.send(
        page(`<p class="k">The witness page</p><h1 style="font-style:italic;font-weight:300">Their holding has ended.</h1><p class="note">What they were holding on for has closed. Thank you for having watched.</p>`),
      );
    }
    const returned =
      view.checkinCount === 1 ? "Once, they have returned." : `${view.checkinCount} times, they have returned.`;
    const heavy = view.heavyToday
      ? `<p style="color:#bd5c78;font-style:italic;margin-top:.75rem">Today is heavy for them.<br><span style="font-size:.8rem;opacity:.7">They chose to let you see that. No reply is expected — being seen is enough.</span></p>`
      : "";
    res.send(
      page(
        `<p class="k">You are their witness</p><p class="soft">Someone chose you to see their days.</p><div class="card"><p class="k">Day</p><p class="day">${view.day}</p><p class="soft" style="margin-top:1.5rem">${returned}</p>${view.showedUpToday ? '<p class="note">They showed up today.</p>' : ""}${heavy}</div><p class="note">You don't need to push them, or ask how it's going. Being seen is the whole gift — and you are the one they trusted to see.</p><p class="k" style="margin-top:2rem">Dawnhalo · a little light for your next step</p>`,
      ),
    );
  });

  // --- The deck (public content: titles + essences, for the Library) ---
  app.get("/api/deck", (_req, res) => {
    res.json({ deck: HALO_DECK.map((c) => ({ title: c.title, theme: c.theme, essence: c.essence })) });
  });

  // --- Send a Spark (share) ---
  app.post("/api/spark", requireDevice, (req, res) => {
    const c = req.body?.card;
    if (!c?.title || !c?.message) return res.status(400).json({ error: "invalid_card" });
    const token = `spk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    db.putShare({
      token,
      theme: c.theme ?? "daily_general",
      illustration_id: c.illustrationId ?? "",
      opener: c.opener ?? "",
      title: c.title,
      message: c.message,
      note: (req.body?.note ?? "").toString().slice(0, 280) || null,
      created_at: new Date().toISOString(),
    });
    res.json({ token, url: `${cfg.appBaseUrl}/spark/${token}` });
  });

  app.get("/api/spark/:token", (req, res) => {
    const s = db.getShare(req.params.token);
    if (!s) return res.status(404).json({ error: "spark_not_found" });
    res.json({
      card: {
        id: s.token,
        opener: s.opener,
        title: s.title,
        message: s.message,
        theme: s.theme,
        illustrationId: s.illustration_id,
        createdAt: s.created_at,
      },
      note: s.note ?? "",
    });
  });

  // --- Stripe checkout ---
  app.post("/api/stripe/checkout", requireDevice, async (req, res) => {
    const plan: PlanId = req.body?.plan === "monthly" ? "monthly" : "yearly";
    const stripe = getStripe();
    if (!stripe) return res.status(503).json({ error: "stripe_not_configured" });
    try {
      const { url } = await createCheckoutSession({ stripe, deviceId: req.deviceId!, plan });
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? "checkout_failed" });
    }
  });

  return app;
}

function respondDraw(
  res: Response,
  result: { kind: string; [k: string]: any },
  entitlement: unknown,
) {
  if (result.kind === "crisis") {
    return res.status(200).json({
      isCrisis: true,
      message: result.message,
      resources: result.resources,
    });
  }
  if (result.kind === "paywall") {
    return res.status(402).json({ paywall: true, reason: result.reason, entitlement });
  }
  return res.json({
    card: result.card,
    entitlement,
    ...(result.goalSeed ? { goalSeed: result.goalSeed } : {}),
  });
}
