import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const PKG_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "../..");
const MEMORY_DIR = join(PKG_ROOT, "context", "memory");
export const BRAIN_DB_PATH = join(MEMORY_DIR, "brain.db");

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function openMemoryDb(): Database.Database {
  ensureDir(MEMORY_DIR);
  const db = new Database(BRAIN_DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  return db;
}

export function ensureMemorySchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS facts (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'agent',
      updated_at INTEGER NOT NULL
    );
  `);
}
