# Dawnhalo — Project Handoff

_Last updated: July 23 2026 · newest work on branch `claude/flow-v3`_

Dawnhalo is a daily oracle-card companion: draw a daily card, ask the oracle a
question (or tell it a dream), get one warm card-reading back, save it, build a
streak, share a "Spark". Free daily card forever; unlimited draws behind a
$4.99–9.99/mo subscription. See `README.md` for architecture and API details.

---

## 0. Branches — read this first

There are now **three** feature branches. They stack: each builds on the last.

| Branch | What it is | Deployed? |
|---|---|---|
| `claude/app-review-monetization-n9o6k8` | The original launch branch. Backend goal layer + first goal UI (5-page onboarding, separate Goal tab, pre-card check-in). | **This is what Render + the live backend serve.** |
| `claude/flow-v2` | Experiment: cards first, all questions after the reading. One-scroll goal creation. Nav Today/Journal/Library/Me. | branch only |
| `claude/flow-v3` | **Newest / recommended.** Full product-flow spec (v3) + the "spec v2" pass: Reading Engine, Day-number-as-hero Today, one-primary-action reading, Journal/Library, "I need something now", Day-first share format. | branch only |

**Nothing is merged to `main` yet.** The three flows are alternatives the user is
comparing on-device (an APK was built from each). When the user picks one, merge
that branch to `main` and point Render's connected branch at it. Until then the
live app behaves like the first branch.

The Reading Engine (§1.7 below) only comes fully alive once its branch is the one
Render deploys **with** `ANTHROPIC_API_KEY` set — locally and in fallback mode the
cards are static, so the "speaks about MY day in my own words" effect isn't visible.

## 1. What exists and works today

| Layer | Where | Status |
|---|---|---|
| Web frontend | repo root (`src/`), React 19 + TanStack Start + Tailwind 4 | builds green |
| Backend API | `server/` — Node/Express + SQLite + Anthropic + Stripe | **243 tests green** on `flow-v3` |
| Android app | Capacitor shell; built by `.github/workflows/android.yml` | installable APK, one per flow branch |
| iOS app | Capacitor-ready (`cap add ios` on a Mac); purchase UI auto-hidden per App Store 3.1.1 | not yet built |
| Live backend | **https://dawnhalo-api.onrender.com** (Render free plan) | live, serving the FIRST branch |

Build any branch's APK via Actions → "Build Android app (.apk)" → Run workflow →
pick the branch → set `api_url=https://dawnhalo-api.onrender.com`. Artifacts expire
after ~30 days. All flow branches share one backend and one device DB, so installing
one APK over another keeps the user's goal + check-ins.

## 1.4 Flow redesign — v2 & v3 (July 18–22 2026, branch `claude/flow-v3`)

Built on top of §1.5. Two design docs drove this (both from the user, delivered
in chat): a full product-flow spec and a follow-up "Product Flow, UX Copy and
Reading Engine (v2)". The goal: make the app feel like **one uninterrupted
conversation**, and make the endurance layer — not the card — the visual anchor.
Everything below is on `flow-v3`; `flow-v2` is the earlier "cards first" cut.

**The Reading Engine (§1.7 — the highest-priority change).** `server/src/lib/
readingContext.ts` builds a per-reading data payload so the model writes about
*this* user's life, not generic sentences. It ships with every goal-aware daily
card, prompted draw, and writing reflection. Payload = goal title/reward/day/
target, today's + last-7 check-in states with dates, the 3 most recent written
entries (quoted), last honesty answer, milestones within 3 days — plus the
engine's rules (Specificity: ≥1 concrete detail from their data; evidence-based
reframe using *their own* history; documented disagreement; "I only see what you
have written here — but I do see it", never claim to feel or foretell). Rules
live in the same file (`READING_ENGINE_RULES`) so payload + rules travel together.
The Copy Rule lint still runs after. **Only visible with a real API key** (see §0).

**Today, restructured (`src/routes/index.tsx`).** With a goal, the phases run:
one-tap check-in → soft transition ("Thank you. Let us see what today has for
you.") → milestone/honesty only when due → three cards → immediate reveal →
reading → adaptive endurance response with per-state actions (strong: finish
quietly; barely/exhausted: help me through today / one small realistic action /
write what is heavy; can't: slow down / write / tell me the truth / I may need
to stop). Fixes from the v2 audit: **Day number is the typographic hero**
(largest text, no greeting when a goal exists); **streak hidden until Day 1,
never zero-padded** (no more "00 STREAK"); **"Draw another" and the free-draw
counter removed** (strict one-card rule — a second card exists only inside the
"pull another card" ritual as a smaller question); post-reading collapses to
**one primary action + a quiet More row**; **persistent crisis hotlines removed**
from under the reading — support is one tap away inside "I need something now"
("Talk to a person") and still fires immediately on crisis detection; ~800ms
reveal flip (`animate-card-flip`).

**Other v3 pieces.** Goal creation is one flowing screen with progressive
disclosure + a commitment summary. Honesty check has four positions incl.
"change how I'm doing it" (new server answer value `adjust` + optional
what-changed note; DB migration adds `honesty_checks.note`). Journal
(`calendar.tsx`) merges check-ins/writing/readings per day with search. Library
(`saved.tsx`) has saved cards + past readings + the deck's meanings (new public
`GET /api/deck`). Goal header framing "You have returned N times" (new
`checkinCount` in goal status) — never missed-day shaming. Share format
(`src/lib/shareImage.ts` `shareJourneyImage`): the **Day number is the hero** of
the image, card the guest, one line from the reading; goal title off by default.
Nav is Today / Journal / Library / Me (no separate Goal tab). Reminder copy
softened (no streak threats).

**Deferred (need bigger data-model changes):** approximate/no target date, goal
pause, deadline change, and a full SVG line-art card-face set (spec §7 — phase in
the 20 most common cards first).

## 1.5 The endurance-goal layer ("KeepGoing", July 16 2026, commits `11a0318..8e9e52e`)

Implemented per `keepgoing-dawnhalo-spec.md`: one active goal per device
("what you're holding on for" — never surfaced as a feature brand), daily
emotional check-in that adapts to the answer, rituals (card / written AI
reflection, premium), sourced benchmark lines, rare milestones (3/7/30,
25/50/75%, target, with share image + confetti), 21-day honesty check with
early trigger after 3 hard days, respectful goal-end summaries, premium
journal. Key facts:

- **Copy Rule is enforced in code**: `server/src/lib/copyrule.ts` lints every
  goal-aware AI line before display (fallback to reviewed static copy in
  `server/src/lib/keepgoing-copy.ts` / `src/lib/goalCopy.ts` — the two
  reviewed copy files).
- **Safety calibration**: `server/test/safety-calibration.json` (33 labeled
  cases) + tests. Run it on every prompt/crisis change. Deliberate
  recalibration: "can't do this (anymore)" is ordinary hardship now
  (reflection, never referral); "can't go on" / "can't keep going" remain
  crisis. Detection is still deterministic and pre-AI on every text path
  (check-in note + writing ritual included).
- **Day count is calendar math** (Day 1 = commitment day); missing days never
  reset it; streak is separate and secondary. Check-in is idempotent per
  local day (DB unique index).
- Existing cards become goal-aware server-side via `goalAnchor` in
  `server/src/lib/prompt.ts`; without a goal nothing changes.
- Goal check-in days age the 14-day trial like draw days (rituals/journal are
  the premium hooks; check-in + benchmark stay free).
- The goal photo never leaves the device (downscaled into localStorage).
- New API under `/api/goal*` (see `server/src/app.ts`); frontend seam:
  `src/lib/goalStore.ts`, screens `src/routes/goal.tsx` + Today integration
  (holding question before the card, discovery moment, goal strip, benchmark
  footer). Analytics: `goal_created`, `checkin_completed(state)`,
  `ritual_completed(type)`, `benchmark_viewed`, `honesty_check_answered`,
  `goal_completed/abandoned`, `goal_prompt_shown/accepted/dismissed`,
  `dN_retention(day)`. (`subscription_cancelled` needs a webhook-side hook —
  not client-visible; not wired yet.)

## 2. Work completed in the previous engagement (commits `4e9d401..4d524e7`)

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

0. **Pick a flow (do this first).** The user is comparing the three branches in
   §0 on-device. Once they choose, merge that branch to `main`, then point
   Render → Settings → Build & Deploy at the chosen branch so the live backend
   serves the matching Reading Engine. `flow-v3` is the recommended target.
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
   after 15 min; first request takes ~30–50 s). This cold start is also why
   Today/Goal show a 2.5s fallback before real data arrives — a paid plan
   removes the wait.
6. iOS later: Apple Developer ($99/yr) + a Mac; integrate RevenueCat/StoreKit
   before enabling purchases on iOS.

**Working from a phone (context for whoever picks this up).** This repo is
driven from the Claude Code desktop app; `/remote-control` mirrors a desktop
conversation to the phone. One conversation hit a desktop-app bug
("Cannot read properties of undefined (reading 'session_url')") after the PC
went offline, and can't re-pair. Fix: start a **fresh** desktop conversation in
this folder and run `/remote-control` there (it inherits project memory + this
file), or start a cloud session on the GitHub repo from the phone's Code tab.

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
# newest work lives here:
git checkout claude/flow-v3

# web dev            # backend dev              # tests (243 on flow-v3)
bun run dev          cd server && npm run dev   cd server && npm test
bun run build        # frontend typecheck: npx tsc --noEmit
# Android build: GitHub → Actions → "Build Android app (.apk)" → Run workflow
#   → choose the branch → api_url=https://dawnhalo-api.onrender.com
```

Local dev note: the frontend Vite server prints `localhost:8080` (not 3000);
set `VITE_API_URL=http://localhost:8787` in a repo-root `.env` (gitignored).
The backend runs without keys — it serves deterministic fallback cards and
Stripe returns 503 — so the whole flow works offline for development.
