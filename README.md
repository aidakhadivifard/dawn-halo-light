# Dawnhalo

A daily oracle-card companion — a quiet moment of clarity every morning. Draw a
daily card, ask a question or share how you're feeling, get a single warm,
grounded card back, ask one follow-up, save it, build a streak, and share a
"Spark" with someone you love.

This repo is a **two-part app**:

| Part | Stack | Location | Role |
|------|-------|----------|------|
| Frontend | React 19 + Vite + TanStack Start + Tailwind v4 | repo root (`src/`) | The UI (designed in Lovable). Deploys to Cloudflare Workers. |
| Backend | Node + Express + better-sqlite3 + Anthropic + Stripe | `server/` | Card generation, entitlement, persistence, payments. Keeps the Anthropic key off the client. |

All card data flows through one typed service seam — `src/lib/cards.ts` — which
calls the backend and **falls back to an offline mock** when the backend is
unreachable, so the UI always renders.

---

## How it works (the rules the backend enforces)

- **Card-first.** Every result is one card: an italic *opener*, a title, a message, and an illustration.
- **Validate before reframe.** Feelings are acknowledged first, then gently reframed — never dismissive positivity.
- **No appearance focus.** Mentions of looks are redirected to the underlying feeling.
- **Loneliness.** The card affirms the person directly; it never invents a fictional admirer.
- **Bounded.** Exactly **one** follow-up per card; afterward only *Save* or *Draw a new card*.
- **Safety first.** A **deterministic** crisis check runs *before any AI call* (works offline) on every input path — draw and follow-up. On a match, no card is produced; the user gets gentle support + resources (US 988, UK Samaritans 116 123).
- **Free tier (per the product decision):** the **daily card is free forever**. A **3 draws/day** allowance (daily card + ask/feel combined) applies during the first **14 active days** (counted in the user's local timezone). After that, the daily card stays free but ask/feel draws require a subscription.
- **No login.** Usage is tracked by an anonymous device UUID in `localStorage`. At checkout, Stripe collects the email and the subscription is attached to the device id.

### Plans
- **Yearly** — $4.99/mo billed once a year at $59.99 ("best value · save 50%").
- **Monthly** — $9.99/mo, cancel anytime.

### Illustrations
50 warm, dark-background images live in `src/assets/cards/` across 9 themes. The
AI tags each card with one theme; the backend picks an image for that theme and
applies a **2-week per-device no-repeat** rule. The backend stores only image
**ids**; the frontend maps ids to the bundled image URLs.

---

## Run the full stack locally

You need **two terminals**: the backend (Node) and the frontend (Vite).

### 1. Backend (`server/`)

```bash
cd server
npm install
cp .env.example .env     # fill in keys (works without them — see below)
npm run dev              # http://localhost:8787
```

- **No `ANTHROPIC_API_KEY`?** The API serves graceful deterministic fallback cards, so you can develop the whole flow offline.
- **No Stripe keys?** `/api/stripe/*` returns 503 and the app stays on the free tier.
- Database is a local SQLite file (`./dawnhalo.db`) created on first run.

### 2. Frontend (repo root)

```bash
bun install              # (or npm install)
cp .env.example .env     # set VITE_API_URL=http://localhost:8787
bun run dev              # http://localhost:3000
```

Open the frontend; it will call the backend through `src/lib/cards.ts`. If the
backend is down, the UI falls back to offline cards automatically.

---

## Tests (TDD)

The backend is test-driven. From `server/`:

```bash
npm test          # vitest — 150+ tests
npm run typecheck
```

Coverage highlights:
- **Crisis detection** — a large true-positive / true-negative corpus (idioms like "dying to see you" and negations like "I'd never hurt myself" are not flagged).
- **Input classification** — question vs feeling vs general.
- **Entitlement** — the 3-draw daily cap, the 14-active-day boundary, the inactive-then-return edge case, daily-card-free-forever, subscriber unlimited.
- **Illustration selection** — 50-image catalog + 2-week no-repeat window.
- **Card generation** — mocks the Claude response shape; verifies parsing, theme coercion, timeout, and the offline fallback.
- **Stripe** — webhook handling (checkout/updated/deleted) and plan/pricing constants.
- **End-to-end** — open → daily → ask → follow-up → save → calendar/streak → hit 3/day → paywall → subscribe (test webhook) → unlimited; plus "crisis can't be bypassed via the follow-up path".

Frontend typecheck + build from the repo root: `npx tsc --noEmit && bun run build`.

---

## API surface (backend)

All endpoints require an `x-device-id` header (anonymous UUID) except the
public spark read and the Stripe webhook. The user's local day is sent via
`x-local-date` (YYYY-MM-DD).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Liveness + active model |
| GET | `/api/plans` | Plan/pricing metadata |
| GET | `/api/entitlement` | Quota snapshot (subscribed, free draws remaining, trial state) |
| GET | `/api/cards/daily` | Today's daily card (idempotent per local day) |
| POST | `/api/cards/draw` | Draw from a prompt (`{intent, text}`) → card / crisis / 402 paywall |
| POST | `/api/cards/follow-up` | One follow-up (`{previousCardId, text}`) → card / crisis / 409 used |
| GET | `/api/history` | Card history |
| GET | `/api/calendar` | Cards grouped by day + streak |
| GET/POST/DELETE | `/api/saved` | Saved cards |
| GET/PUT | `/api/settings` | Reminder time + notification toggle |
| POST | `/api/spark` · GET `/api/spark/:token` | Create / read a shared card (read is public) |
| POST | `/api/stripe/checkout` | Create a Checkout Session |
| POST | `/api/stripe/webhook` | Stripe events (raw body, signature-verified) |

Cost controls: the card endpoints are rate-limited (token bucket, ~30/min per
device), and Claude calls have a timeout with a deterministic fallback.

---

## Deploying

**Frontend** deploys as a TanStack Start app to Cloudflare Workers (the repo's
default target via `@lovable.dev/vite-tanstack-config`). Set `VITE_API_URL` to
your deployed backend URL at build time.

**Backend** is a standard Node service (it uses `better-sqlite3`, a native
module, so it can't run on Workers). Deploy `server/` to any Node host (Railway,
Fly.io, Render, a VM, etc.):

1. Set the env vars from `server/.env.example` (real Anthropic + Stripe keys).
2. Point a persistent volume at `DATABASE_URL`, or migrate to Postgres (see below).
3. In the Stripe dashboard, create the monthly/yearly recurring prices and a
   webhook endpoint pointing at `https://<backend>/api/stripe/webhook`; put the
   signing secret in `STRIPE_WEBHOOK_SECRET`.
4. Set `CORS_ORIGINS` to your frontend origin and `APP_BASE_URL` to the frontend URL.

### SQLite vs Postgres
The default is a single-file SQLite DB (great for a single instance + a volume).
For horizontal scaling, swap `server/src/db/index.ts` for a Postgres-backed
implementation with the same method surface — the rest of the server is
storage-agnostic. The in-memory rate limiter would also need a shared store
(e.g. Redis) when running multiple instances.

---

## Security notes
- The Anthropic and Stripe **secret** keys live only in `server/.env`; they are never imported into client code or any `VITE_` variable.
- Crisis detection is deterministic and runs before any AI call on **every** input path (draw and follow-up), so it can't be bypassed by classification.
- Entitlement is enforced **server-side**; the client UI only mirrors it.
