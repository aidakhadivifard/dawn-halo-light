// Server bootstrap. Creates the SQLite DB and starts listening. Keep this thin
// — all wiring lives in app.ts so it stays testable.

import { createApp } from "./app";
import { createDb } from "./db";
import { getConfig } from "./config";

const cfg = getConfig();
const db = createDb(cfg.databaseUrl);
const app = createApp(db);

app.listen(cfg.port, () => {
  const aiState = cfg.anthropicApiKey ? "Claude enabled" : "Claude DISABLED (fallback cards)";
  const stripeState = cfg.stripeSecretKey ? "Stripe enabled" : "Stripe DISABLED";
  // eslint-disable-next-line no-console
  console.log(
    `Dawnhalo API on :${cfg.port} — model=${cfg.anthropicModel} · ${aiState} · ${stripeState}`,
  );
});
