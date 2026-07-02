// Lightweight product analytics via the PostHog HTTP capture API — no SDK,
// no bundle weight. Every call no-ops unless VITE_POSTHOG_KEY is set, never
// throws, and never blocks the UI.
//
// Privacy rule for this app: send event NAMES and coarse properties only.
// Never send the user's typed text, card messages, or anything that could
// identify them beyond the anonymous device id already used by the backend.

import { getDeviceId } from "@/lib/device";

const KEY = (import.meta.env.VITE_POSTHOG_KEY as string | undefined) ?? "";
const HOST = ((import.meta.env.VITE_POSTHOG_HOST as string | undefined) || "https://us.i.posthog.com").replace(/\/$/, "");

type EventProps = Record<string, string | number | boolean | null | undefined>;

export function track(event: string, properties: EventProps = {}): void {
  if (!KEY || typeof window === "undefined") return;
  try {
    const payload = JSON.stringify({
      api_key: KEY,
      event,
      distinct_id: getDeviceId(),
      properties: {
        ...properties,
        $current_url: window.location.href,
        $pathname: window.location.pathname,
        $lib: "dawnhalo-web",
      },
      timestamp: new Date().toISOString(),
    });
    const url = `${HOST}/capture/`;
    // sendBeacon survives page unloads (e.g. the redirect to Stripe checkout).
    if (navigator.sendBeacon?.(url, new Blob([payload], { type: "application/json" }))) return;
    void fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analytics must never break the app.
  }
}

export function trackPageview(pathname: string): void {
  track("$pageview", { $pathname: pathname });
}
