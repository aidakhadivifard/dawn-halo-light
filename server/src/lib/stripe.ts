// Stripe subscriptions. Entitlement is keyed to the anonymous device id, which
// we put in client_reference_id AND subscription metadata so every webhook can
// attach the subscription back to the right device. The webhook handler is a
// pure function over (db, event) so it's testable without real Stripe.

import Stripe from "stripe";
import type { DB } from "../db";
import { getConfig } from "../config";

export const PLANS = {
  yearly: { label: "Yearly", priceMonthly: 4.99, billedAnnually: 59.99, note: "Best value · save 50%" },
  monthly: { label: "Monthly", priceMonthly: 9.99, note: "Cancel anytime" },
} as const;

export type PlanId = keyof typeof PLANS;

let cached: Stripe | null = null;
export function getStripe(): Stripe | null {
  const { stripeSecretKey } = getConfig();
  if (!stripeSecretKey) return null;
  if (!cached) cached = new Stripe(stripeSecretKey);
  return cached;
}

export function priceIdFor(plan: PlanId): string | undefined {
  const cfg = getConfig();
  return plan === "yearly" ? cfg.stripePriceIdYearly : cfg.stripePriceIdMonthly;
}

export async function createCheckoutSession(args: {
  stripe: Stripe;
  deviceId: string;
  plan: PlanId;
}): Promise<{ url: string | null; id: string }> {
  const cfg = getConfig();
  const price = priceIdFor(args.plan);
  if (!price) throw new Error(`missing_price_id_for_${args.plan}`);

  const session = await args.stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    client_reference_id: args.deviceId,
    metadata: { deviceId: args.deviceId, plan: args.plan },
    subscription_data: { metadata: { deviceId: args.deviceId, plan: args.plan } },
    success_url: `${cfg.appBaseUrl}/?checkout=success`,
    cancel_url: `${cfg.appBaseUrl}/paywall?checkout=cancelled`,
    allow_promotion_codes: true,
  });
  return { url: session.url, id: session.id };
}

function isoFromUnix(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

/**
 * If the paying device was referred by a partner, record the payment toward
 * that partner's revenue. Idempotent per Stripe object id (webhook retries and
 * duplicate deliveries insert-or-ignore on the same row id).
 *
 * v1 records the initial checkout only; renewals arrive as invoice events that
 * this webhook does not yet subscribe to. Prefer amount_total from Stripe
 * (source of truth, in cents); fall back to the plan's list price.
 */
function recordReferralRevenue(
  db: DB,
  args: {
    deviceId: string;
    plan: string | null;
    kind: "checkout" | "renewal";
    eventObjectId: string | undefined;
    amountTotal: number | null | undefined;
  },
) {
  const device = db.getDevice(args.deviceId);
  const code = device?.partner_code;
  if (!code) return;
  const fallbackUsd = args.plan === "yearly" ? PLANS.yearly.billedAnnually : PLANS.monthly.priceMonthly;
  const amountUsd =
    typeof args.amountTotal === "number" && args.amountTotal > 0
      ? args.amountTotal / 100
      : fallbackUsd;
  db.recordPartnerRevenue({
    id: args.eventObjectId ?? `rev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    partner_code: code,
    device_id: args.deviceId,
    kind: args.kind,
    plan: args.plan,
    amount_usd: amountUsd,
    created_at: new Date().toISOString(),
  });
}

/**
 * Apply a Stripe event to the DB. Pure and synchronous so tests can feed it
 * constructed event objects. Returns whether the event was handled.
 */
export function handleStripeEvent(
  db: DB,
  event: { type: string; data: { object: any } },
): { handled: boolean; deviceId?: string } {
  const obj = event.data.object;

  switch (event.type) {
    case "checkout.session.completed": {
      const deviceId = obj.client_reference_id || obj.metadata?.deviceId;
      if (!deviceId) return { handled: false };
      const plan = obj.metadata?.plan ?? null;
      db.setSubscription({
        deviceId,
        email: obj.customer_details?.email ?? obj.customer_email ?? null,
        customerId: typeof obj.customer === "string" ? obj.customer : (obj.customer?.id ?? null),
        subscribed: true,
        plan,
        periodEnd: null,
      });
      recordReferralRevenue(db, { deviceId, plan, kind: "checkout", eventObjectId: obj.id, amountTotal: obj.amount_total });
      return { handled: true, deviceId };
    }

    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const deviceId = obj.metadata?.deviceId;
      if (!deviceId) return { handled: false };
      const active = obj.status === "active" || obj.status === "trialing";
      db.setSubscription({
        deviceId,
        email: null,
        customerId: typeof obj.customer === "string" ? obj.customer : (obj.customer?.id ?? null),
        subscribed: active,
        plan: obj.metadata?.plan ?? null,
        periodEnd: isoFromUnix(obj.current_period_end),
      });
      return { handled: true, deviceId };
    }

    case "customer.subscription.deleted": {
      const deviceId = obj.metadata?.deviceId;
      if (!deviceId) return { handled: false };
      db.setSubscription({
        deviceId,
        email: null,
        customerId: typeof obj.customer === "string" ? obj.customer : (obj.customer?.id ?? null),
        subscribed: false,
        plan: null,
        periodEnd: isoFromUnix(obj.current_period_end),
      });
      return { handled: true, deviceId };
    }

    default:
      return { handled: false };
  }
}
