import Database from "better-sqlite3";
import path from "path";
import * as fs from "fs";
import { logger } from "./logger.js";

const DB_PATH = path.join(process.cwd(), "data", "dev-tracker.db");
export function getDb(): Database.Database {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("foreign_keys = ON");
  return db;
}
export function migrate() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      labels TEXT,
      channel_id TEXT,
      user_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      severity TEXT DEFAULT 'medium',
      channel_id TEXT,
      resolved INTEGER DEFAULT 0,
      resolved_at TEXT,
      detected_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT,
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Add missing columns if they don't exist
  try {
    db.exec(`ALTER TABLE issues ADD COLUMN channel_id TEXT;`);
  } catch (e) {
    // Column might already exist
  }
  try {
    db.exec(`ALTER TABLE issues ADD COLUMN resolved INTEGER DEFAULT 0;`);
  } catch (e) {
    // Column might already exist
  }
  try {
    db.exec(`ALTER TABLE issues ADD COLUMN resolved_at TEXT;`);
  } catch (e) {
    // Column might already exist
  }
  // Migrate existing status to resolved
  try {
    db.exec(`UPDATE issues SET resolved = CASE WHEN status = 'resolved' THEN 1 ELSE 0 END WHERE resolved = 0;`);
  } catch (e) {
    // Migration might have been done already
  }
  // Drop old status column if exists
  try {
    db.exec(`ALTER TABLE issues DROP COLUMN status;`);
  } catch (e) {
    // Column might not exist or already dropped
  }

  logger.info("DB migrated / ensured tables exist");
  db.close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate();
}
