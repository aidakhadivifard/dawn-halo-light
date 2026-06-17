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
`;

export type DB = ReturnType<typeof createDb>;

export function createDb(path = ":memory:") {
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(SCHEMA);

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
         opener, title, message, prompt, parent_id, follow_up_used, fallback, created_at)
       VALUES (@id, @device_id, @local_date, @type, @theme, @illustration_id,
         @opener, @title, @message, @prompt, @parent_id, 0, @fallback, @created_at)`,
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
      `INSERT OR REPLACE INTO saved (id, device_id, theme, illustration_id, opener, title, message, created_at, saved_at)
       VALUES (@id, @device_id, @theme, @illustration_id, @opener, @title, @message, @created_at, @saved_at)`,
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
      created_at: string;
    }) {
      stmts.insertSaved.run({ ...row, saved_at: new Date().toISOString() });
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
  };
}
