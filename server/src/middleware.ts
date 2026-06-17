// Express middleware: device identity, local-day resolution, and a simple
// in-memory rate limiter for the cost-sensitive card endpoints.

import type { Request, Response, NextFunction } from "express";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      deviceId?: string;
      localDate?: string;
    }
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Require an anonymous device id (UUID) via header or body. */
export function requireDevice(req: Request, res: Response, next: NextFunction) {
  const id =
    (req.header("x-device-id") || (req.body && req.body.deviceId) || "").toString().trim();
  if (!id || (!UUID_RE.test(id) && id.length < 8)) {
    return res.status(400).json({ error: "missing_or_invalid_device_id" });
  }
  req.deviceId = id;
  next();
}

/** Resolve the user's local day (header/body/query), defaulting to UTC today. */
export function resolveLocalDate(req: Request, _res: Response, next: NextFunction) {
  const raw = (
    req.header("x-local-date") ||
    (req.body && req.body.localDate) ||
    req.query.localDate ||
    ""
  )
    .toString()
    .trim();
  req.localDate = DATE_RE.test(raw) ? raw : new Date().toISOString().slice(0, 10);
  next();
}

interface Bucket {
  tokens: number;
  updated: number;
}

/**
 * Token-bucket rate limiter keyed by device id (falls back to IP). Defaults to
 * 30 requests/minute, enough for real use but a guardrail against runaway AI
 * cost. In-memory: fine for a single instance; use a shared store if you scale
 * horizontally.
 */
export function rateLimit(opts: { capacity?: number; refillPerSec?: number } = {}) {
  const capacity = opts.capacity ?? 30;
  const refillPerSec = opts.refillPerSec ?? 30 / 60;
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.deviceId || req.ip || "anon";
    const now = Date.now();
    let b = buckets.get(key);
    if (!b) {
      b = { tokens: capacity, updated: now };
      buckets.set(key, b);
    }
    const elapsed = (now - b.updated) / 1000;
    b.tokens = Math.min(capacity, b.tokens + elapsed * refillPerSec);
    b.updated = now;
    if (b.tokens < 1) {
      res.setHeader("Retry-After", "5");
      return res.status(429).json({ error: "rate_limited" });
    }
    b.tokens -= 1;
    next();
  };
}
