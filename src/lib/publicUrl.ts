// Absolute-URL helper for social link previews. Crawlers (WhatsApp, Telegram,
// Facebook, iMessage) need ABSOLUTE og:image URLs. Set VITE_APP_URL to the
// deployed frontend origin (e.g. https://dawnhalo.app) at build time; without
// it we fall back to the browser origin, which covers client-side navigation
// but leaves SSR-rendered previews with a path-relative URL.

const APP = (((import.meta.env.VITE_APP_URL as string | undefined) ?? "") || "").replace(/\/$/, "");

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const origin = APP || (typeof window !== "undefined" ? window.location.origin : "");
  return origin ? `${origin}${path}` : path;
}
