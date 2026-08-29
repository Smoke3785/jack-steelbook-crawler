import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

export type DB = Database.Database;

const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "app.db");

function resolveDbPath(): string {
  return process.env.DATABASE_PATH ?? DEFAULT_DB_PATH;
}

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

function applyMigrations(db: DB): void {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  const applied = new Set(
    (db.prepare("SELECT name FROM _migrations").all() as { name: string }[]).map((r) => r.name),
  );

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const pending = files.filter((f) => !applied.has(f));

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    const migrate = db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO _migrations (name) VALUES (?)").run(file);
    });

    migrate();
  }
}

let dbPromise: Promise<DB> | null = null;

/**
 * Opens (and auto-migrates) the singleton database connection.
 * Safe to call from server components, route handlers, and tsx scripts.
 */
export function getDb(): Promise<DB> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = (async () => {
    const dbPath = resolveDbPath();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });

    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("busy_timeout = 5000");
    db.pragma("foreign_keys = ON");

    applyMigrations(db);

    return db;
  })();

  return dbPromise;
}
