// SQLite persistence (better-sqlite3). One module owns the schema + all
// queries so routes stay thin. Pass ":memory:" for tests.

import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
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

export type SketchStatus = "none" | "pending" | "ready" | "failed";

export interface HorizonRow {
  /** A wish has its own id now: a person keeps several at once. */
  id: string;
  device_id: string;
  text: string;
  created_at: string;
  updated_at: string;
  sketch_status: SketchStatus;
  sketch_token: string | null;
  sketch_error: string | null;
  /** The horizon text the current sketch was drawn from (stale if it differs). */
  sketch_for_text: string | null;
  /** How many times this horizon has been drawn — capped, so renames stay cheap. */
  sketch_draws: number;
  /** The road card drawn for this wish. Once set, the wish is sealed forever. */
  card_id: string | null;
  card_at: string | null;
  /** What this card meant for this wish. Written once, at the draw. */
  card_reading: string | null;
}

export interface DeedRow {
  id: string;
  device_id: string;
  /**
   * 'did'    — I did one small thing (always carries text)
   * 'stayed' — I endured and kept going
   * 'stuck'  — I did nothing, and it bothers me
   * All three count exactly the same. Showing up is the thing being counted.
   */
  kind: "did" | "stayed" | "stuck";
  text: string | null;
  local_date: string;
  created_at: string;
}

/** Something she told us when asked — kept with the wish, in her words. */
export interface WishNoteRow {
  id: string;
  horizon_id: string;
  question: string;
  answer: string;
  local_date: string;
  created_at: string;
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
  /** The sealed letter: who it's for, its text, and its public token once unsealed. */
  letter_to: string | null;
  letter_text: string | null;
  letter_token: string | null;
  /** Last local day the vow was looked at (for the quiet return line only). */
  last_seen_local_date: string | null;
  keepsake_views: number;
  letter_views: number;
  /** Short road name for the pager; null falls back to the enduring text. */
  label: string | null;
  fallback: number; // 0/1
  created_at: string;
}

export interface VowStepRow {
  id: string;
  journey_id: string;
  device_id: string;
  text: string;
  local_date: string;
  /** 'committed' | 'done' | 'not_moved' | 'declined' — only 'done' is ever counted. */
  status: string;
  created_at: string;
  resolved_at: string | null;
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
  letter_to TEXT,
  letter_text TEXT,
  letter_token TEXT,
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

-- One Small Step. Status invariant (load-bearing): only 'done' rows are ever
-- aggregated or shown back. 'not_moved' and 'declined' exist solely so the app
-- can pace its own asking — they are never counted, never displayed.
CREATE TABLE IF NOT EXISTS vow_steps (
  id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  text TEXT NOT NULL,
  local_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'committed',
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_vow_steps_journey ON vow_steps(journey_id, local_date);

-- The Horizon: the life a person is walking toward, in their own words.
-- Never measured, never a goal — only kept and quoted back. One per device.
-- The wishes. A person keeps several at once: some have had their card
-- drawn and are being lived, others were written in the same breath and are
-- still waiting. They are the same kind of thing, so they are the same row —
-- a waiting wish is simply one with no card yet.
CREATE TABLE IF NOT EXISTS horizons (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_horizons_device ON horizons(device_id, created_at);

-- The horizon sketch: the person's own words drawn once as a thin ink line
-- (kind='line') and once more as a soft watercolor (kind='color'). The app
-- reveals the color slowly, by the staying. Bytes live here so Litestream
-- replicates them with everything else; a public token serves them to <img>.
CREATE TABLE IF NOT EXISTS horizon_sketches (
  horizon_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes BLOB NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (horizon_id, kind)
);

-- The deeds: what a person did today for their wish. Two kinds, and BOTH count
-- exactly the same — 'did' (a small act) and 'stayed' (endured and kept going).
-- Every deed lets a little more color through the wish picture.
CREATE TABLE IF NOT EXISTS deeds (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  kind TEXT NOT NULL,          -- 'did' | 'stayed' | 'stuck'
  text TEXT,                   -- what it was, in their words (optional for 'stayed')
  horizon_id TEXT,             -- which wish it was for
  local_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_deeds_device ON deeds(device_id, local_date);

-- What a person told us when the app asked, instead of guessing. "Working on
-- dawnhalo" — the app does not know what dawnhalo is, so it asks once, and
-- what she answers is kept with the wish so it is never asked again.
CREATE TABLE IF NOT EXISTS wish_notes (
  id TEXT PRIMARY KEY,
  horizon_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  local_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wish_notes ON wish_notes(horizon_id, created_at);

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

  // One wish became several. Databases written before that keyed a wish by
  // its device; now a wish has its own id, and its picture and its deeds hang
  // off THAT. Rebuild both tables together, in one transaction, so the link
  // between a wish and its picture can never be lost halfway.
  function columnsOf(table: string): string[] {
    return (sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
  }
  if (!columnsOf("horizons").includes("id")) {
    sqlite.transaction(() => {
      sqlite.exec("ALTER TABLE horizons RENAME TO horizons_v1");
      sqlite.exec(`CREATE TABLE horizons (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sketch_status TEXT NOT NULL DEFAULT 'none',
        sketch_token TEXT,
        sketch_error TEXT,
        sketch_for_text TEXT,
        sketch_draws INTEGER NOT NULL DEFAULT 0,
        card_id TEXT,
        card_at TEXT,
        card_reading TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_horizons_device ON horizons(device_id, created_at);`);

      const had = columnsOf("horizons_v1");
      const col = (r: Record<string, unknown>, name: string, fallback: unknown = null) =>
        had.includes(name) ? (r[name] ?? fallback) : fallback;
      const insert = sqlite.prepare(
        `INSERT INTO horizons (id, device_id, text, created_at, updated_at, sketch_status,
           sketch_token, sketch_error, sketch_for_text, sketch_draws, card_id, card_at, card_reading)
         VALUES (@id, @device_id, @text, @created_at, @updated_at, @sketch_status,
           @sketch_token, @sketch_error, @sketch_for_text, @sketch_draws, @card_id, @card_at, @card_reading)`,
      );
      const idFor = new Map<string, string>();
      for (const r of sqlite.prepare("SELECT * FROM horizons_v1").all() as Record<string, any>[]) {
        const id = randomUUID();
        idFor.set(r.device_id, id);
        insert.run({
          id,
          device_id: r.device_id,
          text: r.text,
          created_at: r.created_at,
          updated_at: r.updated_at,
          sketch_status: col(r, "sketch_status", "none"),
          sketch_token: col(r, "sketch_token"),
          sketch_error: col(r, "sketch_error"),
          sketch_for_text: col(r, "sketch_for_text"),
          sketch_draws: col(r, "sketch_draws", 0),
          card_id: col(r, "card_id"),
          card_at: col(r, "card_at"),
          card_reading: col(r, "card_reading"),
        });
      }
      sqlite.exec("DROP TABLE horizons_v1");

      // The pictures follow their wish.
      if (!columnsOf("horizon_sketches").includes("horizon_id")) {
        sqlite.exec("ALTER TABLE horizon_sketches RENAME TO horizon_sketches_v1");
        sqlite.exec(`CREATE TABLE horizon_sketches (
          horizon_id TEXT NOT NULL, kind TEXT NOT NULL, mime TEXT NOT NULL,
          bytes BLOB NOT NULL, created_at TEXT NOT NULL,
          PRIMARY KEY (horizon_id, kind)
        );`);
        const putS = sqlite.prepare(
          `INSERT OR REPLACE INTO horizon_sketches (horizon_id, kind, mime, bytes, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        );
        for (const r of sqlite.prepare("SELECT * FROM horizon_sketches_v1").all() as Record<string, any>[]) {
          const id = idFor.get(r.device_id);
          if (id) putS.run(id, r.kind, r.mime, r.bytes, r.created_at);
        }
        sqlite.exec("DROP TABLE horizon_sketches_v1");
      }
    })();
  }

  // Idempotent migrations for databases created before a column existed.
  for (const sql of [
    "ALTER TABLE draws ADD COLUMN reflection TEXT",
    "ALTER TABLE saved ADD COLUMN reflection TEXT",
    "ALTER TABLE devices ADD COLUMN partner_code TEXT",
    "ALTER TABLE devices ADD COLUMN attributed_at TEXT",
    // The sealed letter: written at vow time, unsealed only on fulfillment,
    // burned (hard-deleted) on release.
    "ALTER TABLE horizons ADD COLUMN sketch_status TEXT NOT NULL DEFAULT 'none'",
    "ALTER TABLE horizons ADD COLUMN sketch_token TEXT",
    "ALTER TABLE horizons ADD COLUMN sketch_error TEXT",
    "ALTER TABLE horizons ADD COLUMN sketch_for_text TEXT",
    "ALTER TABLE horizons ADD COLUMN sketch_draws INTEGER NOT NULL DEFAULT 0",
    // Several wishes at once: each deed belongs to one of them, and the device
    // remembers which one is open.
    "ALTER TABLE deeds ADD COLUMN horizon_id TEXT",
    "ALTER TABLE devices ADD COLUMN current_horizon_id TEXT",
    // The reading is written once, when the card is drawn, and then it is hers.
    "ALTER TABLE horizons ADD COLUMN card_reading TEXT",
    // The road card, drawn once. Drawing it SEALS the wish: the words can never
    // be edited again, and the picture is drawn from them forever.
    "ALTER TABLE horizons ADD COLUMN card_id TEXT",
    "ALTER TABLE horizons ADD COLUMN card_at TEXT",
    "ALTER TABLE journeys ADD COLUMN letter_to TEXT",
    "ALTER TABLE journeys ADD COLUMN letter_text TEXT",
    "ALTER TABLE journeys ADD COLUMN letter_token TEXT",
    // For the return-after-silence line; never displayed as an absence stat.
    "ALTER TABLE journeys ADD COLUMN last_seen_local_date TEXT",
    // Public-page view counters — the cheapest honest signal that a keepsake
    // or letter was actually opened by someone (the share metric).
    "ALTER TABLE journeys ADD COLUMN keepsake_views INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE journeys ADD COLUMN letter_views INTEGER NOT NULL DEFAULT 0",
    // A short name for the road ("Pink Wallet", "the body") shown in the pager.
    "ALTER TABLE journeys ADD COLUMN label TEXT",
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
         illustration_id, opener, message, reflection, started_local_date, status, letter_to, letter_text, label, fallback, created_at)
       VALUES (@id, @device_id, @enduring, @hope, @card_title, @card_essence, @theme,
         @illustration_id, @opener, @message, @reflection, @started_local_date, 'active', @letter_to, @letter_text, @label, @fallback, @created_at)`,
    ),
    activeJourney: sqlite.prepare<[string]>(
      "SELECT * FROM journeys WHERE device_id = ? AND status = 'active' ORDER BY created_at ASC LIMIT 1",
    ),
    activeJourneys: sqlite.prepare<[string]>(
      "SELECT * FROM journeys WHERE device_id = ? AND status = 'active' ORDER BY created_at ASC",
    ),
    getHorizonById: sqlite.prepare<[string]>("SELECT * FROM horizons WHERE id = ?"),
    listHorizons: sqlite.prepare<[string]>(
      "SELECT * FROM horizons WHERE device_id = ? ORDER BY created_at ASC",
    ),
    recentCards: sqlite.prepare<[string, number]>(
      `SELECT card_id FROM horizons WHERE device_id = ? AND card_id IS NOT NULL
       ORDER BY card_at DESC LIMIT ?`,
    ),
    newestHorizon: sqlite.prepare<[string]>(
      "SELECT * FROM horizons WHERE device_id = ? ORDER BY updated_at DESC LIMIT 1",
    ),
    insertHorizon: sqlite.prepare(
      `INSERT INTO horizons (id, device_id, text, created_at, updated_at)
       VALUES (@id, @device_id, @text, @now, @now)`,
    ),
    renameHorizon: sqlite.prepare(
      "UPDATE horizons SET text = @text, updated_at = @now WHERE id = @id",
    ),
    touchHorizon: sqlite.prepare<[string, string]>(
      "UPDATE horizons SET updated_at = ? WHERE id = ?",
    ),
    setCurrentHorizon: sqlite.prepare<[string | null, string]>(
      "UPDATE devices SET current_horizon_id = ? WHERE device_id = ?",
    ),
    getHorizonByToken: sqlite.prepare<[string]>("SELECT * FROM horizons WHERE sketch_token = ?"),
    setSketchStatus: sqlite.prepare(
      `UPDATE horizons SET sketch_status = @status, sketch_error = @error, sketch_token = COALESCE(@token, sketch_token),
         sketch_for_text = COALESCE(@for_text, sketch_for_text) WHERE id = @horizon_id`,
    ),
    putSketch: sqlite.prepare(
      `INSERT INTO horizon_sketches (horizon_id, kind, mime, bytes, created_at)
       VALUES (@horizon_id, @kind, @mime, @bytes, @now)
       ON CONFLICT(horizon_id, kind) DO UPDATE SET mime = @mime, bytes = @bytes, created_at = @now`,
    ),
    getSketch: sqlite.prepare<[string, string]>("SELECT * FROM horizon_sketches WHERE horizon_id = ? AND kind = ?"),
    // Everything that counts as staying. A deed counts the same whether the
    // person did something small or only endured — that is the whole point.
    countStaying: sqlite.prepare<[string, string, string]>(
      `SELECT (SELECT COUNT(*) FROM vow_steps WHERE device_id = ? AND status = 'done')
            + (SELECT COUNT(*) FROM dark_nights WHERE device_id = ?)
            + (SELECT COUNT(*) FROM deeds WHERE device_id = ?) AS n`,
    ),
    /** The staying earned for ONE wish. Colour belongs to the wish it was for. */
    countStayingFor: sqlite.prepare<[string]>(
      "SELECT COUNT(*) AS n FROM deeds WHERE horizon_id = ?",
    ),

    // --- Deeds (what I did today for my wish) ---
    insertDeed: sqlite.prepare(
      `INSERT INTO deeds (id, device_id, kind, text, horizon_id, local_date, created_at)
       VALUES (@id, @device_id, @kind, @text, @horizon_id, @local_date, @created_at)`,
    ),
    listDeeds: sqlite.prepare<[string, number]>(
      "SELECT * FROM deeds WHERE device_id = ? ORDER BY created_at DESC LIMIT ?",
    ),
    deedsOn: sqlite.prepare<[string, string]>(
      "SELECT * FROM deeds WHERE device_id = ? AND local_date = ? ORDER BY created_at DESC",
    ),
    deedsOnFor: sqlite.prepare<[string, string]>(
      "SELECT * FROM deeds WHERE horizon_id = ? AND local_date = ? ORDER BY created_at DESC",
    ),
    listDeedsFor: sqlite.prepare<[string, number]>(
      "SELECT * FROM deeds WHERE horizon_id = ? ORDER BY created_at DESC LIMIT ?",
    ),
    lastDeedAt: sqlite.prepare<[string]>(
      "SELECT MAX(created_at) AS at FROM deeds WHERE horizon_id = ?",
    ),
    getDeed: sqlite.prepare<[string, string]>(
      "SELECT * FROM deeds WHERE device_id = ? AND id = ?",
    ),
    insertNote: sqlite.prepare(
      `INSERT INTO wish_notes (id, horizon_id, question, answer, local_date, created_at)
       VALUES (@id, @horizon_id, @question, @answer, @local_date, @created_at)`,
    ),
    listNotes: sqlite.prepare<[string]>(
      "SELECT * FROM wish_notes WHERE horizon_id = ? ORDER BY created_at ASC",
    ),
    setCard: sqlite.prepare(
      `UPDATE horizons SET card_id = @card_id, card_at = @card_at,
         card_reading = COALESCE(@card_reading, card_reading) WHERE id = @horizon_id`,
    ),
    bumpSketchDraws: sqlite.prepare<[string]>("UPDATE horizons SET sketch_draws = sketch_draws + 1 WHERE id = ?"),
    deleteSketches: sqlite.prepare<[string]>("DELETE FROM horizon_sketches WHERE horizon_id = ?"),
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
    unsealLetter: sqlite.prepare(
      "UPDATE journeys SET letter_token = @token WHERE id = @id AND letter_text IS NOT NULL",
    ),
    burnLetter: sqlite.prepare(
      "UPDATE journeys SET letter_to = NULL, letter_text = NULL, letter_token = NULL WHERE id = ?",
    ),
    getJourneyByLetter: sqlite.prepare<[string]>(
      "SELECT * FROM journeys WHERE letter_token = ?",
    ),
    bumpKeepsakeViews: sqlite.prepare<[string]>(
      "UPDATE journeys SET keepsake_views = keepsake_views + 1 WHERE keepsake_token = ?",
    ),
    bumpLetterViews: sqlite.prepare<[string]>(
      "UPDATE journeys SET letter_views = letter_views + 1 WHERE letter_token = ?",
    ),
    insertDarkNight: sqlite.prepare(
      `INSERT INTO dark_nights (id, journey_id, device_id, text, local_date, created_at)
       VALUES (@id, @journey_id, @device_id, @text, @local_date, @created_at)`,
    ),
    listDarkNights: sqlite.prepare<[string]>(
      "SELECT * FROM dark_nights WHERE journey_id = ? ORDER BY created_at ASC",
    ),
    touchJourneySeen: sqlite.prepare(
      "UPDATE journeys SET last_seen_local_date = @date WHERE id = @id",
    ),
    insertVowStep: sqlite.prepare(
      `INSERT INTO vow_steps (id, journey_id, device_id, text, local_date, status, created_at)
       VALUES (@id, @journey_id, @device_id, @text, @local_date, @status, @created_at)`,
    ),
    resolveVowStep: sqlite.prepare(
      "UPDATE vow_steps SET status = @status, resolved_at = @resolved_at WHERE id = @id AND status = 'committed'",
    ),
    stepForDay: sqlite.prepare<[string, string]>(
      "SELECT * FROM vow_steps WHERE journey_id = ? AND local_date = ? AND status != 'declined' ORDER BY created_at DESC LIMIT 1",
    ),
    countMoves: sqlite.prepare<[string]>(
      "SELECT COUNT(*) AS n FROM vow_steps WHERE journey_id = ? AND status = 'done'",
    ),
    listMoves: sqlite.prepare<[string]>(
      "SELECT * FROM vow_steps WHERE journey_id = ? AND status = 'done' ORDER BY created_at ASC",
    ),
    recentAskOutcomes: sqlite.prepare<[string]>(
      `SELECT status, local_date FROM vow_steps WHERE journey_id = ?
       ORDER BY created_at DESC LIMIT 2`,
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

  sqlite.exec("CREATE INDEX IF NOT EXISTS idx_deeds_horizon ON deeds(horizon_id, local_date)");
  // Deeds written before wishes were plural belong to that person's one wish.
  sqlite.exec(`UPDATE deeds SET horizon_id = (
      SELECT h.id FROM horizons h WHERE h.device_id = deeds.device_id
      ORDER BY h.created_at ASC LIMIT 1
    ) WHERE horizon_id IS NULL`);

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
    /** All active roads, oldest first (the pager order). */
    activeJourneys(deviceId: string): JourneyRow[] {
      return stmts.activeJourneys.all(deviceId) as JourneyRow[];
    },
    // ----- The wishes ------------------------------------------------------
    //
    // A person keeps several. One of them is OPEN — the one they last looked
    // at — and that is what the plain, wish-less calls below mean by "the
    // horizon". Everything that belongs to one wish (its picture, its card,
    // its deeds) is keyed by that wish's id, never by the device.

    /** The wish currently open, or the most recently touched one. */
    getHorizon(deviceId: string): HorizonRow | undefined {
      const cur = stmts.getDevice.get(deviceId) as DeviceRow | undefined;
      const id = (cur as { current_horizon_id?: string | null } | undefined)?.current_horizon_id;
      if (id) {
        const row = stmts.getHorizonById.get(id) as HorizonRow | undefined;
        if (row && row.device_id === deviceId) return row;
      }
      return stmts.newestHorizon.get(deviceId) as HorizonRow | undefined;
    },
    /** Every wish this person has, oldest first — the order they wrote them. */
    listHorizons(deviceId: string): HorizonRow[] {
      return stmts.listHorizons.all(deviceId) as HorizonRow[];
    },
    /** By id alone — for the drawing job, which already knows whose it is. */
    horizonRow(id: string): HorizonRow | undefined {
      return stmts.getHorizonById.get(id) as HorizonRow | undefined;
    },
    getHorizonById(deviceId: string, id: string): HorizonRow | undefined {
      const row = stmts.getHorizonById.get(id) as HorizonRow | undefined;
      return row && row.device_id === deviceId ? row : undefined;
    },
    /** The cards this person has drawn, newest first — so one does not repeat. */
    recentCardIds(deviceId: string, limit = 4): string[] {
      return (stmts.recentCards.all(deviceId, limit) as { card_id: string }[]).map((r) => r.card_id);
    },
    getHorizonByToken(token: string): HorizonRow | undefined {
      return stmts.getHorizonByToken.get(token) as HorizonRow | undefined;
    },
    /** Write a new wish down. It is not opened until someone opens it. */
    createHorizon(deviceId: string, text: string): HorizonRow {
      const id = randomUUID();
      stmts.insertHorizon.run({ id, device_id: deviceId, text, now: new Date().toISOString() });
      return stmts.getHorizonById.get(id) as HorizonRow;
    },
    /**
     * Write down wishes she is not starting yet. A wish she already has is
     * skipped, so writing the same list twice never doubles it — which is what
     * makes "nothing is lost" a fact rather than a kindness.
     */
    addWishes(deviceId: string, texts: string[]): number {
      const have = new Set(this.listHorizons(deviceId).map((h) => h.text.trim().toLowerCase()));
      let n = 0;
      for (const raw of texts) {
        const text = raw.trim().slice(0, 500);
        if (!text || have.has(text.toLowerCase())) continue;
        have.add(text.toLowerCase());
        this.createHorizon(deviceId, text);
        n++;
      }
      return n;
    },
    /** Open a wish: this is the one the plain calls will mean from now on. */
    openHorizon(deviceId: string, id: string): HorizonRow | undefined {
      const row = stmts.getHorizonById.get(id) as HorizonRow | undefined;
      if (!row || row.device_id !== deviceId) return undefined;
      stmts.setCurrentHorizon.run(id, deviceId);
      stmts.touchHorizon.run(new Date().toISOString(), id);
      return row;
    },
    /**
     * Name the open wish.
     *
     * Before its card is drawn the words are still hers to change, so this
     * renames it. Once it is sealed — or when there is nothing open — this
     * starts a NEW wish and opens it, which is what makes "you can always
     * begin another wish later" true.
     */
    setHorizon(deviceId: string, text: string): HorizonRow {
      const cur = this.getHorizon(deviceId);
      if (cur && !cur.card_id) {
        stmts.renameHorizon.run({ id: cur.id, text, now: new Date().toISOString() });
        stmts.setCurrentHorizon.run(cur.id, deviceId);
        return stmts.getHorizonById.get(cur.id) as HorizonRow;
      }
      const row = this.createHorizon(deviceId, text);
      stmts.setCurrentHorizon.run(row.id, deviceId);
      return row;
    },
    setSketchStatus(args: { horizonId: string; status: SketchStatus; error?: string | null; token?: string | null; forText?: string | null }) {
      stmts.setSketchStatus.run({
        horizon_id: args.horizonId, status: args.status, error: args.error ?? null,
        token: args.token ?? null, for_text: args.forText ?? null,
      });
    },
    putSketch(horizonId: string, kind: "line" | "color", mime: string, bytes: Buffer) {
      stmts.putSketch.run({ horizon_id: horizonId, kind, mime, bytes, now: new Date().toISOString() });
    },
    getSketch(horizonId: string, kind: "line" | "color"): { mime: string; bytes: Buffer; created_at: string } | undefined {
      return stmts.getSketch.get(horizonId, kind) as any;
    },
    deleteSketches(horizonId: string) {
      stmts.deleteSketches.run(horizonId);
    },
    /** Done steps, hard nights stayed through, and deeds. Never the failing. */
    countStaying(deviceId: string): number {
      return (stmts.countStaying.get(deviceId, deviceId, deviceId) as { n: number }).n;
    },
    /** The staying earned for ONE wish — what lets colour into ITS picture. */
    countStayingFor(horizonId: string): number {
      return (stmts.countStayingFor.get(horizonId) as { n: number }).n;
    },
    lastDeedAt(horizonId: string): string | null {
      return (stmts.lastDeedAt.get(horizonId) as { at: string | null }).at;
    },
    /** Seal a wish with its road card. Called once per wish, ever. */
    setCard(horizonId: string, cardId: string, at: string, reading: string | null = null) {
      stmts.setCard.run({ horizon_id: horizonId, card_id: cardId, card_at: at, card_reading: reading });
    },
    insertDeed(row: DeedRow) {
      stmts.insertDeed.run(row as any);
    },
    listDeeds(deviceId: string, limit = 60): DeedRow[] {
      return stmts.listDeeds.all(deviceId, limit) as DeedRow[];
    },
    deedsOn(deviceId: string, localDate: string): DeedRow[] {
      return stmts.deedsOn.all(deviceId, localDate) as DeedRow[];
    },
    /** Today's answer for ONE wish. Answering one is not answering another. */
    deedsOnFor(horizonId: string, localDate: string): DeedRow[] {
      return stmts.deedsOnFor.all(horizonId, localDate) as DeedRow[];
    },
    listDeedsFor(horizonId: string, limit = 60): DeedRow[] {
      return stmts.listDeedsFor.all(horizonId, limit) as DeedRow[];
    },
    getDeed(deviceId: string, id: string): DeedRow | undefined {
      return stmts.getDeed.get(deviceId, id) as DeedRow | undefined;
    },
    insertNote(row: WishNoteRow) {
      stmts.insertNote.run(row as any);
    },
    /** Everything she has explained about this wish, oldest first. */
    listNotes(horizonId: string): WishNoteRow[] {
      return stmts.listNotes.all(horizonId) as WishNoteRow[];
    },
    bumpSketchDraws(deviceId: string) {
      stmts.bumpSketchDraws.run(deviceId);
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
    /** Mint the letter's public token — only possible when a letter exists. */
    unsealLetter(id: string, token: string): boolean {
      return stmts.unsealLetter.run({ id, token }).changes > 0;
    },
    /** Hard-delete the letter. Nothing recoverable, by design. */
    burnLetter(id: string) {
      stmts.burnLetter.run(id);
    },
    getJourneyByLetter(token: string): JourneyRow | undefined {
      return stmts.getJourneyByLetter.get(token) as JourneyRow | undefined;
    },
    bumpKeepsakeViews(token: string) {
      stmts.bumpKeepsakeViews.run(token);
    },
    bumpLetterViews(token: string) {
      stmts.bumpLetterViews.run(token);
    },

    /**
     * The three numbers that decide everything (plus supporting counts).
     * Computed with SQLite date math over local-date strings.
     */
    adminMetrics(todayLocalDate: string) {
      const one = (sql: string, ...params: unknown[]) =>
        (sqlite.prepare(sql).get(...(params as [])) as { n: number }).n;

      const installs = one("SELECT COUNT(*) AS n FROM devices");
      const vowsTotal = one("SELECT COUNT(*) AS n FROM journeys");
      const vowsActive = one("SELECT COUNT(*) AS n FROM journeys WHERE status = 'active'");
      const vowsFulfilled = one("SELECT COUNT(*) AS n FROM journeys WHERE status = 'fulfilled'");
      const vowsReleased = one("SELECT COUNT(*) AS n FROM journeys WHERE status = 'released'");
      const vowsLast7d = one(
        "SELECT COUNT(*) AS n FROM journeys WHERE date(started_local_date) >= date(?, '-7 days')",
        todayLocalDate,
      );

      // D30 return: of vows old enough to be judged (started ≥30 days ago),
      // how many were still being visited on/after day 30?
      const d30Eligible = one(
        "SELECT COUNT(*) AS n FROM journeys WHERE date(started_local_date) <= date(?, '-30 days')",
        todayLocalDate,
      );
      const d30Returned = one(
        `SELECT COUNT(*) AS n FROM journeys
         WHERE date(started_local_date) <= date(?, '-30 days')
           AND date(coalesce(last_seen_local_date, closed_local_date, started_local_date))
               >= date(started_local_date, '+30 days')`,
        todayLocalDate,
      );

      // Share: closed vows whose public keepsake/letter was actually opened.
      const closed = vowsFulfilled + vowsReleased;
      const keepsakesViewed = one(
        "SELECT COUNT(*) AS n FROM journeys WHERE status != 'active' AND keepsake_views > 0",
      );
      const lettersViewed = one("SELECT COUNT(*) AS n FROM journeys WHERE letter_views > 0");

      const darkNights = one("SELECT COUNT(*) AS n FROM dark_nights");
      const movesDone = one("SELECT COUNT(*) AS n FROM vow_steps WHERE status = 'done'");
      const subscribed = one("SELECT COUNT(*) AS n FROM devices WHERE subscribed = 1");

      return {
        installs,
        vows: {
          total: vowsTotal,
          active: vowsActive,
          fulfilled: vowsFulfilled,
          released: vowsReleased,
          last7d: vowsLast7d,
          creationRate: installs ? vowsTotal / installs : 0,
        },
        d30: {
          eligible: d30Eligible,
          returned: d30Returned,
          rate: d30Eligible ? d30Returned / d30Eligible : 0,
        },
        share: {
          closedVows: closed,
          keepsakesViewed,
          lettersViewed,
          rate: closed ? keepsakesViewed / closed : 0,
        },
        support: { darkNights, movesDone, subscribed },
      };
    },
    insertDarkNight(row: DarkNightRow) {
      stmts.insertDarkNight.run(row as any);
    },
    listDarkNights(journeyId: string): DarkNightRow[] {
      return stmts.listDarkNights.all(journeyId) as DarkNightRow[];
    },

    // --- One Small Step ---
    touchJourneySeen(id: string, date: string) {
      stmts.touchJourneySeen.run({ id, date });
    },
    insertVowStep(row: Omit<VowStepRow, "resolved_at">) {
      stmts.insertVowStep.run(row as any);
    },
    resolveVowStep(id: string, status: "done" | "not_moved"): boolean {
      return stmts.resolveVowStep.run({ id, status, resolved_at: new Date().toISOString() }).changes > 0;
    },
    stepForDay(journeyId: string, localDate: string): VowStepRow | undefined {
      return stmts.stepForDay.get(journeyId, localDate) as VowStepRow | undefined;
    },
    /** The only aggregate that exists: times the person chose to move. */
    countMoves(journeyId: string): number {
      return (stmts.countMoves.get(journeyId) as { n: number }).n;
    },
    listMoves(journeyId: string): VowStepRow[] {
      return stmts.listMoves.all(journeyId) as VowStepRow[];
    },
    /** Last two ask outcomes, newest first — for pacing the prompt only. */
    recentAskOutcomes(journeyId: string): { status: string; local_date: string }[] {
      return stmts.recentAskOutcomes.all(journeyId) as { status: string; local_date: string }[];
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
