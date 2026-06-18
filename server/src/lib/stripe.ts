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
      db.setSubscription({
        deviceId,
        email: obj.customer_details?.email ?? obj.customer_email ?? null,
        customerId: typeof obj.customer === "string" ? obj.customer : (obj.customer?.id ?? null),
        subscribed: true,
        plan: obj.metadata?.plan ?? null,
        periodEnd: null,
      });
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
