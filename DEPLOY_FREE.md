# Deploying Dawnhalo for free — with data that survives

Render's free plan has no persistent disk: a plain SQLite file is wiped on every
deploy, restart, or spin-down. This repo solves that with **Litestream**: the
server's Docker image continuously replicates the SQLite database to
S3-compatible object storage and restores it on boot. Kill the instance,
redeploy — your vows, letters, and metrics come back.

Total cost: **$0**. (Backblaze B2 free tier: 10GB storage, no credit card.
Render free web service: spins down when idle; first request after idle takes
~30-60s to wake.)

## 1. Create the storage (Backblaze B2, ~5 minutes)

1. Sign up at backblaze.com → B2 Cloud Storage.
2. **Create a bucket**: name e.g. `dawnhalo-db`, private.
3. Note the bucket's **endpoint** shown on the bucket page, e.g.
   `s3.us-west-004.backblazeb2.com` — the Litestream endpoint is
   `https://` + that host.
4. **App Keys → Add a New Application Key**: name `litestream`, allow access to
   only the `dawnhalo-db` bucket, Read & Write. Save the **keyID** and
   **applicationKey** (shown once).

## 2. Deploy the API (Render)

1. render.com → New → **Blueprint**, point it at this repo. It reads
   `render.yaml` and creates the `dawnhalo-api` service (Docker, free plan).
2. In the service's **Environment** tab fill in:

   | Key | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | your key (optional — fallback cards without it) |
   | `ADMIN_KEY` | any long random string — unlocks `/admin` and partner creation |
   | `LITESTREAM_REPLICA_URL` | `s3://dawnhalo-db/replica` |
   | `LITESTREAM_ENDPOINT` | `https://s3.us-west-004.backblazeb2.com` (yours) |
   | `LITESTREAM_ACCESS_KEY_ID` | the B2 keyID |
   | `LITESTREAM_SECRET_ACCESS_KEY` | the B2 applicationKey |
   | `APP_BASE_URL` | your frontend URL (once deployed) |

3. Deploy. The logs should show `[litestream] restoring…` then the server boot.

**Verify persistence:** create a vow through the app, then in Render choose
"Manual Deploy → Clear build cache & deploy". When the service comes back, the
vow is still there.

## 3. Deploy the frontend

The frontend is a static-friendly TanStack Start app (Cloudflare Workers by
default — also free). Set `VITE_API_URL` to the Render URL
(`https://dawnhalo-api.onrender.com`) at build time.

## 4. Your dashboard

Open `<frontend>/admin` and enter `ADMIN_KEY`. The three numbers that decide
everything — vow creation, D30 return, share — plus supporting counts. Check it
weekly; optimize revenue only after D30 return is healthy.

## Notes & limits

- Free Render spins down after ~15 min idle; the first request wakes it
  (~30-60s). Fine for testing; upgrade the plan (or move hosts) before a
  creator launch so first-tap users don't hit a cold start.
- Litestream syncs every 10s; in the worst case a crash loses ~10s of writes.
- One instance only (SQLite + in-memory rate limiter). That's plenty for
  thousands of users; revisit at scale (see README's Postgres note).
- The Stripe webhook URL for this deployment is
  `https://<render-url>/api/stripe/webhook`.
