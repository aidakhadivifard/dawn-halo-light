// Anonymous device identity. No login required (per product DECISION): we track
// a device by a UUID stored in localStorage and send it to the backend. This id
// also flows into Stripe checkout (client_reference_id) so a subscription can be
// attached without an account.

const KEY = "dawnhalo:deviceId";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Fallback for very old environments.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "ssr-no-device";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = uuid();
    localStorage.setItem(KEY, id);
  }
  return id;
}

/** The user's local calendar day as YYYY-MM-DD (drives per-day reset + streak). */
export function localDay(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
