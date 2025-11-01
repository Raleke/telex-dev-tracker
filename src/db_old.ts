import Database from "better-sqlite3";
import path from "path";
import * as fs from "fs";
import { logger } from "./logger.js";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "dev-tracker.db");
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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      severity TEXT DEFAULT 'medium',
      detected_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT,
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  logger.info("DB migrated / ensured tables exist");
  db.close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate();
}
