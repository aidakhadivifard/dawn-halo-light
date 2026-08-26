// SQLite persistence (better-sqlite3). One module owns the schema + all
// queries so routes stay thin. Pass ":memory:" for tests.

import Database from "better-sqlite3";
import type { CardTheme } from "../types";

export interface DeviceRow {
  device_id: string;
  created_at: string;
  email: string | null;
  stripe_customer_id: string | null;
  subscribed: number; // 0/1
  plan: string | null; // "monthly" | "yearly" | null
  current_period_end: string | null;
  partner_code: string | null; // first-touch referral attribution
  attributed_at: string | null;
}

export interface JourneyRow {
  id: string;
  device_id: string;
  enduring: string;
  hope: string;
  card_title: string;
  card_essence: string;
  theme: string;
  illustration_id: string;
  opener: string;
  message: string;
  reflection: string | null;
  started_local_date: string; // YYYY-MM-DD local
  status: string; // "active" | "fulfilled" | "released"
  closed_at: string | null;
  closed_local_date: string | null;
  closing_note: string | null;
  keepsake_token: string | null;
  fallback: number; // 0/1
  created_at: string;
}

export interface DarkNightRow {
  id: string;
  journey_id: string;
  device_id: string;
  text: string;
  local_date: string;
  created_at: string;
}

export interface PartnerRow {
  code: string;
  name: string;
  rev_share_pct: number;
  secret: string;
  created_at: string;
}

export interface DrawRow {
  id: string;
  device_id: string;
  local_date: string; // YYYY-MM-DD in the user's local day
  type: string; // "daily" | "prompted" | "followup"
  theme: string;
  illustration_id: string;
  opener: string;
  title: string;
  message: string;
  reflection: string | null; // one gentle reflection question
  prompt: string | null;
  parent_id: string | null;
  follow_up_used: number; // 0/1
  fallback: number; // 0/1
  created_at: string;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS devices (
  device_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  email TEXT,
  stripe_customer_id TEXT,
  subscribed INTEGER NOT NULL DEFAULT 0,
  plan TEXT,
  current_period_end TEXT
);

CREATE TABLE IF NOT EXISTS draws (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  local_date TEXT NOT NULL,
  type TEXT NOT NULL,
  theme TEXT NOT NULL,
  illustration_id TEXT NOT NULL,
  opener TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  reflection TEXT,
  prompt TEXT,
  parent_id TEXT,
  follow_up_used INTEGER NOT NULL DEFAULT 0,
  fallback INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_draws_device_date ON draws(device_id, local_date);
CREATE INDEX IF NOT EXISTS idx_draws_device_created ON draws(device_id, created_at);

CREATE TABLE IF NOT EXISTS saved (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  theme TEXT NOT NULL,
  illustration_id TEXT NOT NULL,
  opener TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  reflection TEXT,
  created_at TEXT NOT NULL,
  saved_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_saved_device ON saved(device_id, saved_at);

CREATE TABLE IF NOT EXISTS settings (
  device_id TEXT PRIMARY KEY,
  reminder_time TEXT NOT NULL DEFAULT '07:30',
  notifications_on INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS shares (
  token TEXT PRIMARY KEY,
  theme TEXT NOT NULL,
  illustration_id TEXT NOT NULL,
  opener TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS journeys (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  enduring TEXT NOT NULL,
  hope TEXT NOT NULL,
  card_title TEXT NOT NULL,
  card_essence TEXT NOT NULL,
  theme TEXT NOT NULL,
  illustration_id TEXT NOT NULL,
  opener TEXT NOT NULL,
  message TEXT NOT NULL,
  reflection TEXT,
  started_local_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  closed_at TEXT,
  closed_local_date TEXT,
  closing_note TEXT,
  keepsake_token TEXT,
  fallback INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_journeys_device ON journeys(device_id, created_at);

CREATE TABLE IF NOT EXISTS dark_nights (
  id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  text TEXT NOT NULL,
  local_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dark_nights_journey ON dark_nights(journey_id, created_at);

CREATE TABLE IF NOT EXISTS partners (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rev_share_pct REAL NOT NULL DEFAULT 30,
  secret TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS partner_revenue (
  id TEXT PRIMARY KEY,
  partner_code TEXT NOT NULL,
  device_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  plan TEXT,
  amount_usd REAL NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_partner_rev ON partner_revenue(partner_code, created_at);
`;

export type DB = ReturnType<typeof createDb>;

export function createDb(path = ":memory:") {
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(SCHEMA);

  // Idempotent migrations for databases created before a column existed.
  for (const sql of [
    "ALTER TABLE draws ADD COLUMN reflection TEXT",
    "ALTER TABLE saved ADD COLUMN reflection TEXT",
    "ALTER TABLE devices ADD COLUMN partner_code TEXT",
    "ALTER TABLE devices ADD COLUMN attributed_at TEXT",
  ]) {
    try {
      sqlite.exec(sql);
    } catch {
      /* column already exists */
    }
  }

  const stmts = {
    getDevice: sqlite.prepare<[string]>("SELECT * FROM devices WHERE device_id = ?"),
    insertDevice: sqlite.prepare(
      "INSERT OR IGNORE INTO devices (device_id, created_at) VALUES (?, ?)",
    ),
    setSubscription: sqlite.prepare(
      `UPDATE devices SET email = @email, stripe_customer_id = @customerId,
         subscribed = @subscribed, plan = @plan, current_period_end = @periodEnd
       WHERE device_id = @deviceId`,
    ),
    insertDraw: sqlite.prepare(
      `INSERT INTO draws (id, device_id, local_date, type, theme, illustration_id,
         opener, title, message, reflection, prompt, parent_id, follow_up_used, fallback, created_at)
       VALUES (@id, @device_id, @local_date, @type, @theme, @illustration_id,
         @opener, @title, @message, @reflection, @prompt, @parent_id, 0, @fallback, @created_at)`,
    ),
    countDrawsToday: sqlite.prepare<[string, string]>(
      "SELECT COUNT(*) AS n FROM draws WHERE device_id = ? AND local_date = ? AND type != 'followup'",
    ),
    countActiveDays: sqlite.prepare<[string]>(
      "SELECT COUNT(DISTINCT local_date) AS n FROM draws WHERE device_id = ?",
    ),
    recentIllustrations: sqlite.prepare<[string, string, string]>(
      `SELECT DISTINCT illustration_id FROM draws
       WHERE device_id = ? AND theme = ? AND created_at >= ?`,
    ),
    getDraw: sqlite.prepare<[string]>("SELECT * FROM draws WHERE id = ?"),
    markFollowUpUsed: sqlite.prepare<[string]>(
      "UPDATE draws SET follow_up_used = 1 WHERE id = ?",
    ),
    history: sqlite.prepare<[string, number]>(
      `SELECT * FROM draws WHERE device_id = ? AND type != 'followup'
       ORDER BY created_at DESC LIMIT ?`,
    ),
    insertSaved: sqlite.prepare(
      `INSERT OR REPLACE INTO saved (id, device_id, theme, illustration_id, opener, title, message, reflection, created_at, saved_at)
       VALUES (@id, @device_id, @theme, @illustration_id, @opener, @title, @message, @reflection, @created_at, @saved_at)`,
    ),
    listSaved: sqlite.prepare<[string]>(
      "SELECT * FROM saved WHERE device_id = ? ORDER BY saved_at DESC",
    ),
    getSaved: sqlite.prepare<[string, string]>(
      "SELECT * FROM saved WHERE device_id = ? AND id = ?",
    ),
    removeSaved: sqlite.prepare<[string, string]>(
      "DELETE FROM saved WHERE device_id = ? AND id = ?",
    ),
    getSettings: sqlite.prepare<[string]>("SELECT * FROM settings WHERE device_id = ?"),
    upsertSettings: sqlite.prepare(
      `INSERT INTO settings (device_id, reminder_time, notifications_on)
       VALUES (@deviceId, @reminderTime, @notificationsOn)
       ON CONFLICT(device_id) DO UPDATE SET
         reminder_time = @reminderTime, notifications_on = @notificationsOn`,
    ),
    insertShare: sqlite.prepare(
      `INSERT OR REPLACE INTO shares (token, theme, illustration_id, opener, title, message, note, created_at)
       VALUES (@token, @theme, @illustration_id, @opener, @title, @message, @note, @created_at)`,
    ),
    getShare: sqlite.prepare<[string]>("SELECT * FROM shares WHERE token = ?"),

    // --- Journeys (the vow) ---
    insertJourney: sqlite.prepare(
      `INSERT INTO journeys (id, device_id, enduring, hope, card_title, card_essence, theme,
         illustration_id, opener, message, reflection, started_local_date, status, fallback, created_at)
       VALUES (@id, @device_id, @enduring, @hope, @card_title, @card_essence, @theme,
         @illustration_id, @opener, @message, @reflection, @started_local_date, 'active', @fallback, @created_at)`,
    ),
    activeJourney: sqlite.prepare<[string]>(
      "SELECT * FROM journeys WHERE device_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
    ),
    getJourney: sqlite.prepare<[string]>("SELECT * FROM journeys WHERE id = ?"),
    listJourneys: sqlite.prepare<[string]>(
      "SELECT * FROM journeys WHERE device_id = ? ORDER BY created_at DESC",
    ),
    closeJourney: sqlite.prepare(
      `UPDATE journeys SET status = @status, closed_at = @closed_at, closed_local_date = @closed_local_date,
         closing_note = @closing_note, keepsake_token = @keepsake_token
       WHERE id = @id AND status = 'active'`,
    ),
    getJourneyByKeepsake: sqlite.prepare<[string]>(
      "SELECT * FROM journeys WHERE keepsake_token = ?",
    ),
    insertDarkNight: sqlite.prepare(
      `INSERT INTO dark_nights (id, journey_id, device_id, text, local_date, created_at)
       VALUES (@id, @journey_id, @device_id, @text, @local_date, @created_at)`,
    ),
    listDarkNights: sqlite.prepare<[string]>(
      "SELECT * FROM dark_nights WHERE journey_id = ? ORDER BY created_at ASC",
    ),

    // --- Partners (rev-share referrals) ---
    insertPartner: sqlite.prepare(
      `INSERT INTO partners (code, name, rev_share_pct, secret, created_at)
       VALUES (@code, @name, @rev_share_pct, @secret, @created_at)`,
    ),
    getPartner: sqlite.prepare<[string]>("SELECT * FROM partners WHERE code = ?"),
    attributeDevice: sqlite.prepare(
      `UPDATE devices SET partner_code = @code, attributed_at = @at
       WHERE device_id = @deviceId AND partner_code IS NULL`,
    ),
    countAttributed: sqlite.prepare<[string]>(
      "SELECT COUNT(*) AS n FROM devices WHERE partner_code = ?",
    ),
    countAttributedSubscribed: sqlite.prepare<[string]>(
      "SELECT COUNT(*) AS n FROM devices WHERE partner_code = ? AND subscribed = 1",
    ),
    insertPartnerRevenue: sqlite.prepare(
      `INSERT OR IGNORE INTO partner_revenue (id, partner_code, device_id, kind, plan, amount_usd, created_at)
       VALUES (@id, @partner_code, @device_id, @kind, @plan, @amount_usd, @created_at)`,
    ),
    sumPartnerRevenue: sqlite.prepare<[string]>(
      "SELECT COALESCE(SUM(amount_usd), 0) AS total FROM partner_revenue WHERE partner_code = ?",
    ),
  };

  return {
    raw: sqlite,
    close: () => sqlite.close(),

    getOrCreateDevice(deviceId: string): DeviceRow {
      stmts.insertDevice.run(deviceId, new Date().toISOString());
      return stmts.getDevice.get(deviceId) as DeviceRow;
    },
    getDevice(deviceId: string): DeviceRow | undefined {
      return stmts.getDevice.get(deviceId) as DeviceRow | undefined;
    },
    setSubscription(args: {
      deviceId: string;
      email: string | null;
      customerId: string | null;
      subscribed: boolean;
      plan: string | null;
      periodEnd: string | null;
    }) {
      stmts.insertDevice.run(args.deviceId, new Date().toISOString());
      stmts.setSubscription.run({
        deviceId: args.deviceId,
        email: args.email,
        customerId: args.customerId,
        subscribed: args.subscribed ? 1 : 0,
        plan: args.plan,
        periodEnd: args.periodEnd,
      });
    },

    insertDraw(row: Omit<DrawRow, "follow_up_used">) {
      stmts.insertDraw.run(row as any);
    },
    countDrawsToday(deviceId: string, localDate: string): number {
      return (stmts.countDrawsToday.get(deviceId, localDate) as { n: number }).n;
    },
    countActiveDays(deviceId: string): number {
      return (stmts.countActiveDays.get(deviceId) as { n: number }).n;
    },
    recentIllustrationIds(deviceId: string, theme: CardTheme, sinceISO: string): string[] {
      const rows = stmts.recentIllustrations.all(deviceId, theme, sinceISO) as {
        illustration_id: string;
      }[];
      return rows.map((r) => r.illustration_id);
    },
    getDraw(id: string): DrawRow | undefined {
      return stmts.getDraw.get(id) as DrawRow | undefined;
    },
    markFollowUpUsed(id: string) {
      stmts.markFollowUpUsed.run(id);
    },
    history(deviceId: string, limit = 200): DrawRow[] {
      return stmts.history.all(deviceId, limit) as DrawRow[];
    },

    saveCard(row: {
      id: string;
      device_id: string;
      theme: string;
      illustration_id: string;
      opener: string;
      title: string;
      message: string;
      reflection?: string | null;
      created_at: string;
    }) {
      stmts.insertSaved.run({
        reflection: null,
        ...row,
        saved_at: new Date().toISOString(),
      });
    },
    listSaved(deviceId: string) {
      return stmts.listSaved.all(deviceId) as any[];
    },
    getSaved(deviceId: string, id: string) {
      return stmts.getSaved.get(deviceId, id) as any | undefined;
    },
    removeSaved(deviceId: string, id: string) {
      stmts.removeSaved.run(deviceId, id);
    },

    getSettings(deviceId: string) {
      return stmts.getSettings.get(deviceId) as
        | { device_id: string; reminder_time: string; notifications_on: number }
        | undefined;
    },
    setSettings(deviceId: string, reminderTime: string, notificationsOn: boolean) {
      stmts.upsertSettings.run({
        deviceId,
        reminderTime,
        notificationsOn: notificationsOn ? 1 : 0,
      });
    },

    putShare(row: {
      token: string;
      theme: string;
      illustration_id: string;
      opener: string;
      title: string;
      message: string;
      note: string | null;
      created_at: string;
    }) {
      stmts.insertShare.run(row);
    },
    getShare(token: string) {
      return stmts.getShare.get(token) as any | undefined;
    },

    // --- Journeys ---
    insertJourney(row: Omit<JourneyRow, "status" | "closed_at" | "closed_local_date" | "closing_note" | "keepsake_token">) {
      stmts.insertJourney.run(row as any);
    },
    activeJourney(deviceId: string): JourneyRow | undefined {
      return stmts.activeJourney.get(deviceId) as JourneyRow | undefined;
    },
    getJourney(id: string): JourneyRow | undefined {
      return stmts.getJourney.get(id) as JourneyRow | undefined;
    },
    listJourneys(deviceId: string): JourneyRow[] {
      return stmts.listJourneys.all(deviceId) as JourneyRow[];
    },
    closeJourney(args: {
      id: string;
      status: "fulfilled" | "released";
      closedAt: string;
      closedLocalDate: string;
      closingNote: string | null;
      keepsakeToken: string;
    }): boolean {
      const res = stmts.closeJourney.run({
        id: args.id,
        status: args.status,
        closed_at: args.closedAt,
        closed_local_date: args.closedLocalDate,
        closing_note: args.closingNote,
        keepsake_token: args.keepsakeToken,
      });
      return res.changes > 0;
    },
    getJourneyByKeepsake(token: string): JourneyRow | undefined {
      return stmts.getJourneyByKeepsake.get(token) as JourneyRow | undefined;
    },
    insertDarkNight(row: DarkNightRow) {
      stmts.insertDarkNight.run(row as any);
    },
    listDarkNights(journeyId: string): DarkNightRow[] {
      return stmts.listDarkNights.all(journeyId) as DarkNightRow[];
    },

    // --- Partners ---
    createPartner(row: PartnerRow) {
      stmts.insertPartner.run(row as any);
    },
    getPartner(code: string): PartnerRow | undefined {
      return stmts.getPartner.get(code) as PartnerRow | undefined;
    },
    /** First-touch attribution: only sets when the device has no partner yet. */
    attributeDevice(deviceId: string, code: string): boolean {
      stmts.insertDevice.run(deviceId, new Date().toISOString());
      const res = stmts.attributeDevice.run({ deviceId, code, at: new Date().toISOString() });
      return res.changes > 0;
    },
    partnerStats(code: string): { installs: number; subscribers: number; revenueUsd: number } {
      return {
        installs: (stmts.countAttributed.get(code) as { n: number }).n,
        subscribers: (stmts.countAttributedSubscribed.get(code) as { n: number }).n,
        revenueUsd: (stmts.sumPartnerRevenue.get(code) as { total: number }).total,
      };
    },
    recordPartnerRevenue(row: {
      id: string;
      partner_code: string;
      device_id: string;
      kind: string;
      plan: string | null;
      amount_usd: number;
      created_at: string;
    }) {
      stmts.insertPartnerRevenue.run(row);
    },
  };
}
