# Dawnhalo on mobile — phone install & app stores

Three levels, easiest first. Do them in order.

---

## Level 1 — Use it on your phone today (no stores, ~10 min)

Dawnhalo is installable as a home-screen web app (PWA). Once the site is
deployed (see `README.md` → Deploying):

- **Android (Chrome):** open the site → menu **⋮ → Add to Home screen → Install**.
- **iPhone (Safari):** open the site → **Share → Add to Home Screen**.

It launches full-screen with the Dawnhalo icon — no browser bars. Good for
testing and for users who don't want a store download.

---

## Level 2 — Build the native apps (Capacitor)

This produces the actual Android (`.aab`) and iOS apps the stores require. The
native shell loads your **deployed** site and adds native features on top.

### Prerequisites
- **Node 18+** and this repo on your computer.
- **Android:** [Android Studio](https://developer.android.com/studio) (any OS).
- **iOS:** a **Mac** with **Xcode** (Apple requires this; there is no way around it).

### One-time setup
```bash
# from the repo root
bun install                      # installs the Capacitor packages now in package.json

# Point the native shell at your deployed frontend URL:
export CAP_SERVER_URL="https://YOUR-DEPLOYED-SITE"   # e.g. https://dawnhalo.pages.dev

bun run cap:add:android          # creates the android/ project
bun run cap:add:ios              # creates the ios/ project (Mac only)

# App icon + splash from public/app-icon.svg:
#   export public/app-icon.svg to a 1024x1024 PNG named "icon.png" in an
#   "assets/" folder, then:
npx @capacitor/assets generate --iconBackgroundColor '#fdfcfb' --splashBackgroundColor '#fdfcfb'
```

### Every time you change config or the deployed URL
```bash
export CAP_SERVER_URL="https://YOUR-DEPLOYED-SITE"
bun run cap:sync
```

### Open and run
```bash
bun run cap:open:android   # opens Android Studio → press Run to test on a device/emulator
bun run cap:open:ios       # opens Xcode (Mac) → press Run
```

> The `android/` and `ios/` folders are generated locally and are **not** committed
> (they're large and machine-specific). Regenerate with the commands above.

---

## Level 3 — Publish to Google Play & the App Store

### Accounts (do this early — approval can take a day)
- **Google Play Console** — one-time **$25**: <https://play.google.com/console>
- **Apple Developer Program** — **$99/year**: <https://developer.apple.com/programs/>

### ⚠️ Two things both stores will REQUIRE before approval
1. **In-app purchases for the subscription.** Apple & Google do **not** allow
   selling digital subscriptions through Stripe inside the app — it must go
   through Apple In-App Purchase / Google Play Billing. The clean way to support
   both is **[RevenueCat](https://www.revenuecat.com/)** (one SDK, both stores).
   Stripe stays for the web version. *This is a code change we still need to do
   — see "Remaining work" below.*
2. **A privacy policy URL** and a **support contact**. Required by both stores.
   (Dawnhalo is privacy-friendly: anonymous device id, no login — easy to state.)

### Other review notes for a mental-health app
- Keep the crisis support resources (988 / Samaritans) — reviewers expect them.
- Avoid medical claims ("treats", "cures", "diagnoses").
- Apple **Guideline 4.2**: a pure website-in-a-wrapper can be rejected. We satisfy
  it by adding native value — **daily reminder notifications** (your Settings
  screen already has the toggle; delivery is part of "Remaining work").
- Age rating: answer the questionnaires honestly (mild mature themes possible).

### Build the store binaries
- **Android:** Android Studio → **Build → Generate Signed Bundle / APK → Android App Bundle (.aab)** → create a keystore (keep it safe!) → upload the `.aab` in Play Console → fill the listing → submit.
- **iOS:** Xcode → set your Team & a unique Bundle ID (`com.dawnhalo.app`) → **Product → Archive → Distribute App → App Store Connect** → fill the listing in App Store Connect → submit.

### Store listing assets you'll need (both stores)
- App icon (1024×1024 PNG), feature graphic (Play), screenshots (phone sizes),
  short + full description, privacy policy URL, support email, category
  (Lifestyle / Health & Fitness).

---

## Remaining work before store submission (code)
These are the pieces I can still add to the repo:
1. **RevenueCat in-app purchases** for the monthly/yearly plans on mobile (replaces Stripe inside the apps; entitlement still verified server-side).
2. **Reminder push/local notifications** wired to the existing Settings screen (also satisfies Apple 4.2).
3. **Offline polish** for the native shell (cache the last cards).

Tell me to proceed and I'll implement them next.
