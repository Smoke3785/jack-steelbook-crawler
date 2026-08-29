import { getDb, type DB } from "@/shared/db";
import { parseListing } from "@/features/parse/parse-listing";
import { linkParsedListing, refreshEditionRollups } from "@/features/editions/editions-repo";
import { matchOutstandingEditions } from "@/features/tmdb/match";
import { STORES, type StoreDef } from "./stores";
import { FeedError, fetchAllProducts, type ShopifyProduct } from "./shopify";
import { upsertStoreProducts, detachMissingListings, type StoreIngestResult } from "./upsert";

export interface IngestStats {
  trigger: string;
  startedAt: string;
  finishedAt: string;
  stores: (StoreIngestResult & { name: string; error?: string })[];
  parsed: number;
  editionsTouched: number;
  tmdb: { matched: number; skipped: number };
}

/** Keeps the stores table in sync with the code-level registry. */
function syncStores(db: DB): void {
  const upsert = db.prepare(
    `INSERT INTO stores (id, name, base_url, kind, role, enabled)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       base_url = excluded.base_url,
       kind = excluded.kind,
       role = excluded.role,
       enabled = excluded.enabled`,
  );

  for (const store of STORES) {
    upsert.run(store.id, store.name, store.baseUrl, store.kind, store.role, store.enabled ? 1 : 0);
  }
}

interface RawForParse {
  store_id: string;
  product_id: number;
  title: string;
  vendor: string | null;
  image_url: string | null;
}

function parseAndLink(
  db: DB,
  keys: { storeId: string; productId: number }[],
): { parsed: number; editionsTouched: number } {
  const select = db.prepare(
    `SELECT store_id, product_id, title, vendor, image_url
     FROM raw_listings WHERE store_id = ? AND product_id = ?`,
  );

  const touchedEditions = new Set<number>();
  let parsed = 0;

  for (const key of keys) {
    const raw = select.get(key.storeId, key.productId) as RawForParse | undefined;

    if (!raw) {
      continue;
    }

    const store = STORES.find((s) => s.id === key.storeId);

    if (!store) {
      continue;
    }

    const parse = parseListing({ title: raw.title, vendor: raw.vendor });
    const link = linkParsedListing(
      db,
      { storeId: raw.store_id, productId: raw.product_id },
      parse,
      { storeRole: store.role, imageUrl: raw.image_url },
    );
    touchedEditions.add(link.editionId);
    parsed += 1;
  }

  if (touchedEditions.size > 0) {
    refreshEditionRollups(db, [...touchedEditions]);
  }

  return { parsed, editionsTouched: touchedEditions.size };
}

async function ingestStore(
  db: DB,
  store: StoreDef,
  runId: number,
): Promise<StoreIngestResult & { name: string; error?: string }> {
  const base: StoreIngestResult & { name: string } = {
    name: store.name,
    storeId: store.id,
    fetched: 0,
    created: 0,
    priceChanges: 0,
    availabilityFlips: 0,
    resurrected: 0,
    removed: 0,
    toParse: [],
  };

  if (!store.enabled) {
    return { ...base, error: "disabled" };
  }

  if (store.kind !== "shopify") {
    return { ...base, error: `kind '${store.kind}' not implemented yet` };
  }

  try {
    const products: ShopifyProduct[] = await fetchAllProducts(store.id, store.baseUrl);

    const result = upsertStoreProducts(db, store, products, runId);
    result.removed = detachMissingListings(
      db,
      store.id,
      new Set(products.map((p) => p.id)),
    );

    return { ...base, ...result, name: store.name };
  } catch (err) {
    const message = err instanceof FeedError ? err.message : (err as Error).message;

    return { ...base, name: store.name, error: message };
  }
}

/**
 * Full ingest run: sync store registry, pull every enabled feed, diff,
 * parse new/changed listings into editions, match TMDB, refresh rollups.
 */
export async function runIngest(trigger: "cron" | "manual" | "recheck" = "manual"): Promise<IngestStats> {
  const db = await getDb();
  const startedAt = new Date().toISOString();

  syncStores(db);

  const runRow = db
    .prepare("INSERT INTO ingest_runs (trigger) VALUES (?)")
    .run(trigger);
  const runId = Number(runRow.lastInsertRowid);

  const storeResults: (StoreIngestResult & { name: string; error?: string })[] = [];

  for (const store of STORES) {
    const result = await ingestStore(db, store, runId);
    storeResults.push(result);

    if (result.error && result.error !== "disabled") {
      console.error(`[ingest] ${store.id}: ${result.error}`);
    }
  }

  const toParse = storeResults.flatMap((s) => s.toParse);
  const { parsed, editionsTouched } = parseAndLink(db, toParse);
  const tmdb = await matchOutstandingEditions(db);

  db.prepare("UPDATE ingest_runs SET finished_at = ?, stats_json = ? WHERE id = ?").run(
    new Date().toISOString(),
    JSON.stringify({ stores: storeResults, parsed, tmdb }),
    runId,
  );

  return {
    trigger,
    startedAt,
    finishedAt: new Date().toISOString(),
    stores: storeResults,
    parsed,
    editionsTouched,
    tmdb,
  };
}
