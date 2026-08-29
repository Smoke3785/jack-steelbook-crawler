import fs from "node:fs";
import path from "node:path";
import { connection } from "next/server";
import { getDb } from "@/shared/db";
import { toSqliteUtc } from "@/shared/lib/format";

/** Daily ingest cron from .github/workflows/ingest.yml: "17 6 * * *" (UTC). */
const CRON_HOUR_UTC = 6;
const CRON_MINUTE_UTC = 17;

interface RunStoreStat {
  storeId: string;
  name: string;
  fetched: number;
  created: number;
  priceChanges: number;
  availabilityFlips: number;
  removed: number;
  error?: string;
}

interface RunStats {
  stores: RunStoreStat[];
  parsed?: number;
  tmdb?: { matched: number; skipped: number };
}

export interface IngestRunSummary {
  id: number;
  trigger: string;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  parsed: number | null;
  tmdb_matched: number | null;
  tmdb_skipped: number | null;
  stores: RunStoreStat[];
}

export interface StatusData {
  db_path: string;
  db_size_bytes: number | null;
  listing_count: number;
  removed_count: number;
  edition_count: number;
  movie_count: number;
  matched_edition_count: number;
  store_count: number;
  enabled_store_count: number;
  events_last_24h: { type: string; n: number }[];
  events_total: number;
  recent_runs: IngestRunSummary[];
  next_cron_at: string;
  tmdb_configured: boolean;
}

function nextCronRun(now = new Date()): Date {
  const next = new Date(now);
  next.setUTCHours(CRON_HOUR_UTC, CRON_MINUTE_UTC, 0, 0);

  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return next;
}

function parseRun(row: {
  id: number;
  trigger: string;
  started_at: string;
  finished_at: string | null;
  stats_json: string | null;
}): IngestRunSummary {
  let stats: RunStats = { stores: [] };

  if (row.stats_json) {
    try {
      stats = JSON.parse(row.stats_json) as RunStats;
    } catch {
      stats = { stores: [] };
    }
  }

  const duration =
    row.finished_at !== null
      ? Math.round(
          (new Date(`${row.finished_at.replace(" ", "T")}Z`).getTime() -
            new Date(`${row.started_at.replace(" ", "T")}Z`).getTime()) / 1000,
        )
      : null;

  return {
    id: row.id,
    trigger: row.trigger,
    started_at: row.started_at,
    finished_at: row.finished_at,
    duration_seconds: duration,
    parsed: stats.parsed ?? null,
    tmdb_matched: stats.tmdb?.matched ?? null,
    tmdb_skipped: stats.tmdb?.skipped ?? null,
    stores: stats.stores ?? [],
  };
}

export async function getStatus(): Promise<StatusData> {
  await connection();
  const db = await getDb();

  const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db");

  let dbSize: number | null = null;

  try {
    dbSize = fs.statSync(dbPath).size;
  } catch {
    dbSize = null;
  }

  const one = (sql: string) => (db.prepare(sql).get() as { n: number }).n;

  const recentRuns = (
    db
      .prepare(
        `SELECT id, trigger, started_at, finished_at, stats_json
         FROM ingest_runs ORDER BY id DESC LIMIT 5`,
      )
      .all() as {
      id: number;
      trigger: string;
      started_at: string;
      finished_at: string | null;
      stats_json: string | null;
    }[]
  ).map(parseRun);

  const events24h = db
    .prepare(
      `SELECT type, COUNT(*) AS n FROM listing_events
       WHERE seen_at >= datetime('now', '-1 day') GROUP BY type ORDER BY n DESC`,
    )
    .all() as { type: string; n: number }[];

  return {
    db_path: dbPath,
    db_size_bytes: dbSize,
    listing_count: one("SELECT COUNT(*) AS n FROM raw_listings WHERE removed_at IS NULL"),
    removed_count: one("SELECT COUNT(*) AS n FROM raw_listings WHERE removed_at IS NOT NULL"),
    edition_count: one("SELECT COUNT(*) AS n FROM editions WHERE listing_count > 0"),
    movie_count: one("SELECT COUNT(*) AS n FROM movies"),
    matched_edition_count: one("SELECT COUNT(*) AS n FROM editions WHERE movie_id IS NOT NULL"),
    store_count: one("SELECT COUNT(*) AS n FROM stores"),
    enabled_store_count: one("SELECT COUNT(*) AS n FROM stores WHERE enabled = 1"),
    events_last_24h: events24h,
    events_total: one("SELECT COUNT(*) AS n FROM listing_events"),
    recent_runs: recentRuns,
    next_cron_at: toSqliteUtc(nextCronRun()),

    tmdb_configured: Boolean(process.env.TMDB_API_KEY || process.env.TMDB_ACCESS_TOKEN),
  };
}
