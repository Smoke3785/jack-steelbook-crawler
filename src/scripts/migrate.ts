import { openAndMigrate, type DB } from "@/shared/db";
import { syncStores } from "@/features/ingest/run-ingest";
import { refreshEditionRollups } from "@/features/editions/editions-repo";

/**
 * Migration + validation entry point. Runs automatically before every build
 * (npm `prebuild`) so a remote deploy against its own database volume picks
 * up schema changes without manual steps. Exits non-zero on validation
 * failure, which fails the build.
 */

interface Validation {
  ok: boolean;
  message: string;
}

function validate(db: DB): Validation[] {
  const checks: Validation[] = [];

  const integrity = db.pragma("integrity_check", { simple: true }) as string;
  checks.push({ ok: integrity === "ok", message: `integrity_check: ${integrity}` });

  const fkViolations = db.prepare("PRAGMA foreign_key_check").all() as unknown[];
  checks.push({
    ok: fkViolations.length === 0,
    message:
      fkViolations.length === 0
        ? "foreign_key_check: clean"
        : `foreign_key_check: ${fkViolations.length} violation(s)`,
  });

  const orphans = db
    .prepare(
      `SELECT COUNT(*) AS n FROM parsed_listings p
       LEFT JOIN raw_listings r ON r.store_id = p.store_id AND r.product_id = p.product_id
       WHERE r.store_id IS NULL`,
    )
    .get() as { n: number };
  checks.push({
    ok: orphans.n === 0,
    message: orphans.n === 0 ? "parsed_listings orphans: none" : `parsed_listings orphans: ${orphans.n}`,
  });

  const stores = db.prepare("SELECT COUNT(*) AS n FROM stores").get() as { n: number };
  checks.push({ ok: stores.n > 0, message: `stores registered: ${stores.n}` });

  const editions = db
    .prepare("SELECT COUNT(*) AS n FROM editions WHERE listing_count > 0")
    .get() as { n: number };
  checks.push({ ok: true, message: `live editions: ${editions.n}` });

  const listings = db.prepare("SELECT COUNT(*) AS n FROM raw_listings").get() as { n: number };
  checks.push({ ok: true, message: `raw listings: ${listings.n}` });

  return checks;
}

async function main(): Promise<void> {
  const dbPath = process.env.DATABASE_PATH ?? "data/app.db";
  const { db, appliedMigrations } = await openAndMigrate();

  console.log(`[migrate] database: ${dbPath}`);

  if (appliedMigrations.length > 0) {
    console.log(`[migrate] applied ${appliedMigrations.length} migration(s):`);

    for (const name of appliedMigrations) {
      console.log(`  - ${name}`);
    }
  } else {
    console.log("[migrate] schema up to date");
  }

  syncStores(db);

  // Derived columns are rebuilt from listings whenever the schema changed,
  // so backfills ship with their migration instead of a manual step.
  if (appliedMigrations.length > 0) {
    console.log("[migrate] refreshing edition rollups");
    refreshEditionRollups(db);
  }

  const checks = validate(db);
  let failed = false;

  for (const check of checks) {
    console.log(`[migrate] ${check.ok ? "✓" : "✗"} ${check.message}`);

    if (!check.ok) {
      failed = true;
    }
  }

  if (failed) {
    console.error("[migrate] validation FAILED");
    process.exit(1);
  }

  console.log("[migrate] validation passed");
}

main().catch((err) => {
  console.error("[migrate] fatal:", err);
  process.exit(1);
});
