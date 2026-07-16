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
  reflection: string | null; // one gentle reflection question
  prompt: string | null;
  parent_id: string | null;
  follow_up_used: number; // 0/1
  fallback: number; // 0/1
  created_at: string;
}

export interface GoalRow {
  id: string;
  device_id: string;
  title: string;
  reward: string;
  start_date: string; // local YYYY-MM-DD of commitment — Day 1
  target_date: string; // local YYYY-MM-DD, LOCKED after creation
  photo_url: string | null;
  ritual: string; // "card" | "writing"
  status: string; // "active" | "completed" | "abandoned"
  created_at: string;
  closed_at: string | null;
}

export interface CheckinRow {
  id: string;
  goal_id: string;
  device_id: string;
  local_date: string;
  state: string; // "strong" | "barely" | "cant" | "exhausted"
  note: string | null;
  created_at: string;
}

export interface RitualEntryRow {
  id: string;
  checkin_id: string;
  goal_id: string;
  device_id: string;
  local_date: string;
  type: string; // "card" | "writing"
  card_id: string | null;
  user_text: string | null;
  ai_reflection: string | null;
  created_at: string;
}

export interface HonestyRow {
  id: string;
  goal_id: string;
  device_id: string;
  local_date: string;
  day_number: number;
  answer: string; // "continue" | "thinking" | "done"
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

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  title TEXT NOT NULL,
  reward TEXT NOT NULL,
  start_date TEXT NOT NULL,
  target_date TEXT NOT NULL,
  photo_url TEXT,
  ritual TEXT NOT NULL DEFAULT 'card',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  closed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_goals_device_status ON goals(device_id, status);

CREATE TABLE IF NOT EXISTS goal_checkins (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  local_date TEXT NOT NULL,
  state TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_checkins_goal_date ON goal_checkins(goal_id, local_date);

CREATE TABLE IF NOT EXISTS ritual_entries (
  id TEXT PRIMARY KEY,
  checkin_id TEXT NOT NULL,
  goal_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  local_date TEXT NOT NULL,
  type TEXT NOT NULL,
  card_id TEXT,
  user_text TEXT,
  ai_reflection TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rituals_goal_date ON ritual_entries(goal_id, local_date);

CREATE TABLE IF NOT EXISTS honesty_checks (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  local_date TEXT NOT NULL,
  day_number INTEGER NOT NULL,
  answer TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_honesty_goal_created ON honesty_checks(goal_id, created_at);
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

    insertGoal: sqlite.prepare(
      `INSERT INTO goals (id, device_id, title, reward, start_date, target_date, photo_url, ritual, status, created_at, closed_at)
       VALUES (@id, @device_id, @title, @reward, @start_date, @target_date, @photo_url, @ritual, 'active', @created_at, NULL)`,
    ),
    getActiveGoal: sqlite.prepare<[string]>(
      "SELECT * FROM goals WHERE device_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
    ),
    getGoal: sqlite.prepare<[string]>("SELECT * FROM goals WHERE id = ?"),
    updateGoalMeta: sqlite.prepare(
      "UPDATE goals SET title = @title, photo_url = @photoUrl, ritual = @ritual WHERE id = @id",
    ),
    setGoalStatus: sqlite.prepare(
      "UPDATE goals SET status = @status, closed_at = @closedAt WHERE id = @id",
    ),
    insertCheckin: sqlite.prepare(
      `INSERT INTO goal_checkins (id, goal_id, device_id, local_date, state, note, created_at)
       VALUES (@id, @goal_id, @device_id, @local_date, @state, @note, @created_at)`,
    ),
    getCheckin: sqlite.prepare<[string, string]>(
      "SELECT * FROM goal_checkins WHERE goal_id = ? AND local_date = ?",
    ),
    listCheckins: sqlite.prepare<[string]>(
      "SELECT * FROM goal_checkins WHERE goal_id = ? ORDER BY local_date ASC",
    ),
    countCheckinDays: sqlite.prepare<[string]>(
      "SELECT COUNT(DISTINCT local_date) AS n FROM goal_checkins WHERE device_id = ?",
    ),
    countCheckinsOn: sqlite.prepare<[string, string]>(
      "SELECT COUNT(*) AS n FROM goal_checkins WHERE device_id = ? AND local_date = ?",
    ),
    insertRitualEntry: sqlite.prepare(
      `INSERT INTO ritual_entries (id, checkin_id, goal_id, device_id, local_date, type, card_id, user_text, ai_reflection, created_at)
       VALUES (@id, @checkin_id, @goal_id, @device_id, @local_date, @type, @card_id, @user_text, @ai_reflection, @created_at)`,
    ),
    getRitualForCheckin: sqlite.prepare<[string]>(
      "SELECT * FROM ritual_entries WHERE checkin_id = ? LIMIT 1",
    ),
    listRitualEntries: sqlite.prepare<[string]>(
      "SELECT * FROM ritual_entries WHERE goal_id = ? ORDER BY local_date ASC",
    ),
    insertHonesty: sqlite.prepare(
      `INSERT INTO honesty_checks (id, goal_id, device_id, local_date, day_number, answer, created_at)
       VALUES (@id, @goal_id, @device_id, @local_date, @day_number, @answer, @created_at)`,
    ),
    lastHonesty: sqlite.prepare<[string]>(
      "SELECT * FROM honesty_checks WHERE goal_id = ? ORDER BY day_number DESC LIMIT 1",
    ),
    listHonesty: sqlite.prepare<[string]>(
      "SELECT * FROM honesty_checks WHERE goal_id = ? ORDER BY day_number ASC",
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

    insertGoal(row: Omit<GoalRow, "status" | "closed_at">) {
      stmts.insertGoal.run(row as any);
    },
    getActiveGoal(deviceId: string): GoalRow | undefined {
      return stmts.getActiveGoal.get(deviceId) as GoalRow | undefined;
    },
    getGoal(id: string): GoalRow | undefined {
      return stmts.getGoal.get(id) as GoalRow | undefined;
    },
    updateGoalMeta(id: string, title: string, photoUrl: string | null, ritual: string) {
      stmts.updateGoalMeta.run({ id, title, photoUrl, ritual });
    },
    setGoalStatus(id: string, status: "completed" | "abandoned", closedAt: string) {
      stmts.setGoalStatus.run({ id, status, closedAt });
    },

    /** Throws on duplicate (goal_id, local_date) — the day is already checked in. */
    insertCheckin(row: CheckinRow) {
      stmts.insertCheckin.run(row as any);
    },
    getCheckin(goalId: string, localDate: string): CheckinRow | undefined {
      return stmts.getCheckin.get(goalId, localDate) as CheckinRow | undefined;
    },
    listCheckins(goalId: string): CheckinRow[] {
      return stmts.listCheckins.all(goalId) as CheckinRow[];
    },
    countCheckinDays(deviceId: string): number {
      return (stmts.countCheckinDays.get(deviceId) as { n: number }).n;
    },
    hasCheckinOn(deviceId: string, localDate: string): boolean {
      return (stmts.countCheckinsOn.get(deviceId, localDate) as { n: number }).n > 0;
    },

    insertRitualEntry(row: RitualEntryRow) {
      stmts.insertRitualEntry.run(row as any);
    },
    getRitualForCheckin(checkinId: string): RitualEntryRow | undefined {
      return stmts.getRitualForCheckin.get(checkinId) as RitualEntryRow | undefined;
    },
    listRitualEntries(goalId: string): RitualEntryRow[] {
      return stmts.listRitualEntries.all(goalId) as RitualEntryRow[];
    },

    insertHonesty(row: HonestyRow) {
      stmts.insertHonesty.run(row as any);
    },
    lastHonesty(goalId: string): HonestyRow | undefined {
      return stmts.lastHonesty.get(goalId) as HonestyRow | undefined;
    },
    listHonesty(goalId: string): HonestyRow[] {
      return stmts.listHonesty.all(goalId) as HonestyRow[];
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
