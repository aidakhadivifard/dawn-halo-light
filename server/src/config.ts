// Centralized environment/config access. Reads happen lazily so tests can
// override process.env before the first call.

export interface AppConfig {
  nodeEnv: string;
  port: number;
  anthropicApiKey: string | undefined;
  anthropicModel: string;
  stripeSecretKey: string | undefined;
  stripeWebhookSecret: string | undefined;
  stripePriceIdMonthly: string | undefined;
  stripePriceIdYearly: string | undefined;
  databaseUrl: string;
  /** Comma-separated allowed CORS origins, or "*" for any. */
  corsOrigins: string;
  /** Public base URL of the frontend, used for Stripe redirect URLs. */
  appBaseUrl: string;
  /** Admin key protecting partner creation. Unset = partner admin disabled. */
  adminKey: string | undefined;
}

export function getConfig(): AppConfig {
  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port: Number(process.env.PORT ?? 8787),
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    // DECISION (authoritative): use claude-sonnet-4-6. Never the retired
    // claude-sonnet-4-20250514. Overridable only via env for testing.
    anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_ID_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_ID_YEARLY,
    databaseUrl: process.env.DATABASE_URL ?? "./dawnhalo.db",
    corsOrigins: process.env.CORS_ORIGINS ?? "*",
    appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
    adminKey: process.env.ADMIN_KEY,
  };
}
