# Dawnhalo — Project Handoff

_Last updated: July 2026 · branch `claude/app-review-monetization-n9o6k8`_

Dawnhalo is a daily oracle-card companion: draw a daily card, ask the oracle a
question (or tell it a dream), get one warm card-reading back, save it, build a
streak, share a "Spark". Free daily card forever; unlimited draws behind a
$4.99–9.99/mo subscription. See `README.md` for architecture and API details.

---

## 1. What exists and works today

| Layer | Where | Status |
|---|---|---|
| Web frontend | repo root (`src/`), React 19 + TanStack Start + Tailwind 4 | builds green |
| Backend API | `server/` — Node/Express + SQLite + Anthropic + Stripe | 178 tests green |
| Android app | Capacitor shell; built by `.github/workflows/android.yml` | installable APK |
| iOS app | Capacitor-ready (`cap add ios` on a Mac); purchase UI auto-hidden per App Store 3.1.1 | not yet built |
| Live backend | **https://dawnhalo-api.onrender.com** (Render free plan, branch above) | live |

The latest connected Android build (run #32, backend wired in):
`https://github.com/aidakhadivifard/dawn-halo-light/actions/runs/28752677671/artifacts/8095158267`
(GitHub artifacts expire after ~30 days — rebuild via Actions → "Build Android
app (.apk)" → Run workflow → set `api_url` to the Render URL.)

## 2. Work completed in this engagement (commits `4e9d401..4d524e7`)

**Growth instrumentation**
- `src/lib/analytics.ts`: dependency-free PostHog capture (no-ops without
  `VITE_POSTHOG_KEY`; never sends user text). Funnel events wired end-to-end:
  pageviews, `card_drawn`, `card_revealed`, `card_picked`, `follow_up_asked`,
  `card_saved`, `spark_shared`, `card_image_shared`, `paywall_viewed`,
  `checkout_started/completed/cancelled`, `reminder_scheduled`.
- `src/lib/shareImage.ts`: renders any card to a branded 1080×1920 PNG
  on-device → native share sheet (Instagram/WhatsApp) or download.
- `/spark/:token` loads server-side so shared links preview with the real
  card art/title/message. Site-wide `og:image` is `public/og.jpg`.
  Set `VITE_APP_URL` at build time for absolute OG URLs.

**Brand & icon**
- App icon redesigned (crescent halo + sun on warm cream). The previous
  foreground filled the full canvas, so Android's adaptive-icon mask cropped
  the ring away — the new mark sits inside the ~66% safe zone. All surfaces
  regenerated: `assets/icon-*.png`, `assets/splash*.png`, `public/app-icon.svg`,
  `assets/logo-dawnhalo.svg`.

**Retention**
- Daily reminder via `@capacitor/local-notifications` at the user's chosen
  time (Settings). Permission is only requested from the Settings toggle,
  never at cold start. Boot re-sync keeps the schedule alive.

**Store compliance**
- `/privacy` route (honest policy matching actual behavior), linked from
  Settings and paywall. Paywall hides all Stripe UI inside the iOS shell.
  Paywall benefit list only promises real features.

**Oracle voice (the big product fix)**
- `server/src/lib/prompt.ts` rewritten: readings ANSWER the question like a
  tarot reader — yes/no questions get the card's lean in the first sentence,
  "when" questions are answered in seasons (never dates), third-party
  questions lean but say what a card cannot see. Therapy/wellness vocabulary
  (relax, breathe, self-care, manifest…) is forbidden. Never guarantees,
  never doom. Crisis detection (deterministic, pre-AI) untouched.
- Fallback cards are domain-aware (money/children/love/career/timing) so
  offline answers differ by topic.

**Dreams**
- "I had a dream…" chip on the arrival screen → dream-telling flow.
- `dream` intent classified ahead of question/feeling.
- `server/src/lib/dreambook.ts`: ~40 classic symbols with anchored meanings
  (sources documented in the file: Miller's public-domain *10,000 Dreams
  Interpreted* 1901, Jungian symbolism, Ibn Sirin folk lineage; symbol list
  follows dream-content research). Detected symbols are injected into the
  prompt as anchors the reading must agree with. Editorial rule: inner
  weather, never doom.

**Virality surfaces**
- Pick-a-card spread: after setting an intention, three face-down cards
  appear; the user taps one. Designed to be screen-recorded (the TikTok
  "pick a card" format) with zero editing.
- Subtle DAWNHALO wordmark on the choose/drawing/reveal states so every
  screen recording is branded.

## 3. Accounts & secrets map (nothing secret is in the repo)

| What | Lives where |
|---|---|
| Anthropic API key | Render → service `dawnhalo-api` → Environment → `ANTHROPIC_API_KEY` |
| Render service | render.com account (branch: `claude/app-review-monetization-n9o6k8`) |
| Stripe keys | **not configured yet** — `server/.env.example` lists what's needed |
| PostHog key | **not configured yet** — `VITE_POSTHOG_KEY` at build time |
| GitHub repo | `aidakhadivifard/dawn-halo-light` (private) |

## 4. Launch checklist (remaining)

1. **Stripe**: create monthly ($9.99) / yearly ($59.99) recurring prices, a
   webhook to `https://<backend>/api/stripe/webhook`, put keys in Render env.
   Until then the app is free-tier only.
2. **Google Play** ($25 one-time): needs a signed AAB (keystore + workflow
   tweak) and the Data Safety form.
3. **PostHog** (free): set `VITE_POSTHOG_KEY` in the Android workflow env /
   web build.
4. **`VITE_APP_URL`**: set to the public web origin at build time for correct
   social previews.
5. **Render**: upgrade to the $7 plan before any marketing (free plan sleeps
   after 15 min; first request takes ~30–50 s).
6. **Merge to `main`** when ready (Render/App builds currently track the
   feature branch).
7. iOS later: Apple Developer ($99/yr) + a Mac; integrate RevenueCat/StoreKit
   before enabling purchases on iOS.

## 5. Marketing plan (agreed)

$1,000 initial budget, revenue reinvested: $600 → ~20 nano-influencers
(~$30/post, tarot-tok / mental-health / morning-routine niches, unique UTM
links); $250 → Spark Ads boosting the 2–3 winning posts; $150 → second round
with winners. Content format: screen-record the in-app pick-a-card flow;
comment-reply with share-images.

Decision gates: month 3 — any creative with CPI < $1.50, else change creative
not budget; month 6 — $500–1,000 MRR to justify reinvesting; month 12 —
~$3k MRR = exit track (small subscription apps sell around 2–3× annual profit).
Health thresholds: D7 retention > 15%, install→paid > 1.5%.

## 6. If the GitHub account changes

- Best: GitHub → repo **Settings → Danger Zone → Transfer ownership** to the
  new account (keeps history, Actions, artifacts).
- The full source (all branches + history) also exists as `dawnhalo.bundle`
  (restore with `git clone dawnhalo.bundle dawn-halo-light`) and a plain
  source zip — both delivered in the project chat. Keep copies somewhere safe.
- After moving: update the Render service's connected repo (Render →
  Settings → Build & Deploy), and nothing else — keys live in Render, not GitHub.

## 7. Day-to-day commands

```bash
# web dev            # backend dev              # tests
bun run dev          cd server && npm run dev   cd server && npm test
bun run build        # Android build: GitHub → Actions → Run workflow (api_url=<render url>)
```
