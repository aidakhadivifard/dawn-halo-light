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

export interface AppOptions extends ServiceDeps {
  /** Inject a custom Stripe webhook verifier (tests bypass signature checks). */
  verifyStripe?: (rawBody: Buffer, sig: string | undefined) => { type: string; data: { object: any } };
}

export function createApp(db: DB, opts: AppOptions = {}) {
  const app = express();
  const svc = createService(db, opts);
  const cfg = getConfig();

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

  // --- The Vow (journey) — rate-limited where AI is involved ---
  app.get("/api/journey", requireDevice, resolveLocalDate, (req, res) => {
    res.json({ journey: svc.getJourney(req.deviceId!, req.localDate!) });
  });

  app.get("/api/journeys", requireDevice, resolveLocalDate, (req, res) => {
    res.json({ journeys: svc.listJourneys(req.deviceId!, req.localDate!) });
  });

  app.post("/api/journey", requireDevice, resolveLocalDate, cardLimiter, async (req, res) => {
    const enduring = (req.body?.enduring ?? "").toString();
    const hope = (req.body?.hope ?? "").toString();
    const result = await svc.createJourney(req.deviceId!, req.localDate!, { enduring, hope });
    if (result.kind === "crisis")
      return res.json({ isCrisis: true, message: result.message, resources: result.resources });
    if (result.kind === "invalid") return res.status(400).json({ error: "missing_enduring_or_hope" });
    if (result.kind === "exists")
      return res.status(409).json({ error: "vow_already_active", journey: result.journey });
    res.json({ journey: result.journey });
  });

  app.post("/api/journey/dark-night", requireDevice, resolveLocalDate, (req, res) => {
    const text = (req.body?.text ?? "").toString();
    const result = svc.addDarkNight(req.deviceId!, req.localDate!, text);
    if (result.kind === "crisis")
      return res.json({ isCrisis: true, message: result.message, resources: result.resources });
    if (result.kind === "no_journey") return res.status(404).json({ error: "no_active_vow" });
    res.json({ context: result.context });
  });

  app.post("/api/journey/close", requireDevice, resolveLocalDate, (req, res) => {
    const outcome = req.body?.outcome === "released" ? "released" : "fulfilled";
    const note = (req.body?.note ?? "").toString();
    const result = svc.closeJourney(req.deviceId!, req.localDate!, { outcome, note });
    if (result.kind === "no_journey") return res.status(404).json({ error: "no_active_vow" });
    res.json({
      journey: result.journey,
      keepsake: result.keepsake,
      url: `${cfg.appBaseUrl}/keepsake/${result.journey.keepsakeToken}`,
    });
  });

  // Public keepsake read (like the spark read).
  app.get("/api/keepsake/:token", resolveLocalDate, (req, res) => {
    const keepsake = svc.getKeepsake(req.params.token, req.localDate!);
    if (!keepsake) return res.status(404).json({ error: "keepsake_not_found" });
    res.json({ keepsake });
  });

  // --- Partners (rev-share referrals) ---

  // First-touch attribution: called once by the client when it sees ?ref=CODE.
  app.post("/api/partner/attribute", requireDevice, (req, res) => {
    const code = (req.body?.code ?? "").toString().trim().toLowerCase().slice(0, 40);
    if (!code) return res.status(400).json({ error: "missing_code" });
    const partner = db.getPartner(code);
    if (!partner) return res.status(404).json({ error: "unknown_partner" });
    const attributed = db.attributeDevice(req.deviceId!, code);
    res.json({ ok: true, attributed });
  });

  // Create a partner (admin only — set ADMIN_KEY in the server env).
  app.post("/api/partner", (req, res) => {
    if (!cfg.adminKey) return res.status(503).json({ error: "admin_disabled" });
    if (req.header("x-admin-key") !== cfg.adminKey)
      return res.status(401).json({ error: "unauthorized" });
    const code = (req.body?.code ?? "").toString().trim().toLowerCase().slice(0, 40);
    const name = (req.body?.name ?? "").toString().trim().slice(0, 120);
    const pct = Number(req.body?.revSharePct ?? 30);
    if (!/^[a-z0-9_-]{2,40}$/.test(code) || !name)
      return res.status(400).json({ error: "invalid_code_or_name" });
    if (!(pct > 0 && pct <= 90)) return res.status(400).json({ error: "invalid_rev_share_pct" });
    if (db.getPartner(code)) return res.status(409).json({ error: "code_taken" });
    const secret = `pk_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
    db.createPartner({
      code,
      name,
      rev_share_pct: pct,
      secret,
      created_at: new Date().toISOString(),
    });
    res.json({
      code,
      name,
      revSharePct: pct,
      secret,
      shareUrl: `${cfg.appBaseUrl}/?ref=${code}`,
      dashboardUrl: `${cfg.appBaseUrl}/partner/${code}`,
    });
  });

  // Partner dashboard stats — authenticated by the partner's own secret.
  app.get("/api/partner/:code/stats", (req, res) => {
    const code = req.params.code.toLowerCase();
    const partner = db.getPartner(code);
    if (!partner) return res.status(404).json({ error: "unknown_partner" });
    const key = req.header("x-partner-key") ?? (req.query.key ?? "").toString();
    if (key !== partner.secret) return res.status(401).json({ error: "unauthorized" });
    const stats = db.partnerStats(code);
    res.json({
      code,
      name: partner.name,
      revSharePct: partner.rev_share_pct,
      installs: stats.installs,
      subscribers: stats.subscribers,
      revenueUsd: Math.round(stats.revenueUsd * 100) / 100,
      accruedUsd: Math.round(stats.revenueUsd * partner.rev_share_pct) / 100,
      shareUrl: `${cfg.appBaseUrl}/?ref=${code}`,
    });
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
  return res.json({ card: result.card, entitlement });
}
