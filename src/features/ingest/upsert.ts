import type { DB, ListingEventType } from "@/shared/db";
import type { StoreDef } from "./stores";
import type { ShopifyProduct } from "./shopify";

export interface ListingKey {
  storeId: string;
  productId: number;
}

export interface ProductWriteResult {
  isNew: boolean;
  priceChanged: boolean;
  availabilityFlipped: boolean;
  resurrected: boolean;
  /** Listing needs a (re)parse pass: new, resurrected, or retitled. */
  toParse: boolean;
}

export interface StoreIngestResult {
  storeId: string;
  fetched: number;
  created: number;
  priceChanges: number;
  availabilityFlips: number;
  resurrected: number;
  removed: number;
  /** Listings that need a (re)parse pass: new, resurrected, or retitled. */
  toParse: ListingKey[];
}

interface ExistingRow {
  product_id: number;
  handle: string;
  title: string;
  vendor: string | null;
  tags: string;
  price_min_cents: number | null;
  price_max_cents: number | null;
  available: number;
  removed_at: string | null;
}

function prices(product: ShopifyProduct): { min: number | null; max: number | null } {
  const cents = product.variants
    .map((v) => Number.parseFloat(v.price))
    .filter((p) => Number.isFinite(p))
    .map((p) => Math.round(p * 100));

  if (cents.length === 0) {
    return { min: null, max: null };
  }

  return { min: Math.min(...cents), max: Math.max(...cents) };
}

function coverImage(product: ShopifyProduct): string | null {
  const sorted = [...(product.images ?? [])].sort((a, b) => a.position - b.position);
  return sorted[0]?.src ?? null;
}

function normalizedTags(product: ShopifyProduct): string {
  const tags = Array.isArray(product.tags) ? product.tags : [product.tags];
  return JSON.stringify(tags.filter(Boolean));
}

function recordEvent(
  db: DB,
  runId: number | null,
  storeId: string,
  productId: number,
  type: ListingEventType,
  detail: Record<string, unknown> | null,
): void {
  db.prepare(
    `INSERT INTO listing_events (ingest_run_id, store_id, product_id, type, detail)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(runId, storeId, productId, type, detail ? JSON.stringify(detail) : null);
}

/**
 * Writes one product snapshot to raw_listings (keyed store_id + product_id)
 * and records diff events: new ID, price change, availability flip. Shared by
 * the batch ingest and the per-edition background recheck.
 */
export function applyProduct(
  db: DB,
  store: StoreDef,
  product: ShopifyProduct,
  runId: number | null,
): ProductWriteResult {
  const existing = db
    .prepare(
      `SELECT product_id, handle, title, vendor, tags, price_min_cents, price_max_cents, available, removed_at
       FROM raw_listings WHERE store_id = ? AND product_id = ?`,
    )
    .get(store.id, product.id) as ExistingRow | undefined;

  const { min, max } = prices(product);
  const available = product.variants.some((v) => v.available) ? 1 : 0;
  const imageUrl = coverImage(product);
  const tags = normalizedTags(product);
  const url = `${store.baseUrl}/products/${product.handle}`;

  if (!existing) {
    db.prepare(
      `INSERT INTO raw_listings
         (store_id, product_id, handle, title, vendor, product_type, tags, image_url, url, raw_json,
          price_min_cents, price_max_cents, available, first_seen_at, last_seen_at, last_changed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))`,
    ).run(
      store.id,
      product.id,
      product.handle,
      product.title,
      product.vendor,
      product.product_type,
      tags,
      imageUrl,
      url,
      JSON.stringify(product),
      min,
      max,
      available,
    );
    recordEvent(db, runId, store.id, product.id, "new", {
      price: [min, max],
      available: available === 1,
    });

    return {
      isNew: true,
      priceChanged: false,
      availabilityFlipped: false,
      resurrected: false,
      toParse: true,
    };
  }

  const priceChanged =
    existing.price_min_cents !== min || existing.price_max_cents !== max;
  const availabilityFlipped = existing.available !== available;
  const retitled = existing.title !== product.title || existing.vendor !== product.vendor;
  const resurrected = existing.removed_at !== null;

  if (priceChanged) {
    recordEvent(db, runId, store.id, product.id, "price_change", {
      before: [existing.price_min_cents, existing.price_max_cents],
      after: [min, max],
    });
  }

  if (availabilityFlipped) {
    recordEvent(
      db,
      runId,
      store.id,
      product.id,
      available === 1 ? "available" : "unavailable",
      { before: existing.available === 1, after: available === 1 },
    );
  }

  const anyChange = priceChanged || availabilityFlipped || retitled || resurrected;

  db.prepare(
    `UPDATE raw_listings SET
       handle = ?, title = ?, vendor = ?, product_type = ?, tags = ?, image_url = ?, url = ?,
       raw_json = ?, price_min_cents = ?, price_max_cents = ?, available = ?,
       last_seen_at = datetime('now'),
       last_changed_at = CASE WHEN ? THEN datetime('now') ELSE last_changed_at END,
       removed_at = NULL
     WHERE store_id = ? AND product_id = ?`,
  ).run(
    product.handle,
    product.title,
    product.vendor,
    product.product_type,
    tags,
    imageUrl,
    url,
    JSON.stringify(product),
    min,
    max,
    available,
    anyChange ? 1 : 0,
    store.id,
    product.id,
  );

  return {
    isNew: false,
    priceChanged,
    availabilityFlipped,
    resurrected,
    toParse: retitled || resurrected,
  };
}

/**
 * Upserts one store's full feed in a single transaction and diffs it against
 * what we already knew. Listings missing from the feed are marked removed by
 * the caller (only when the fetch succeeded).
 */
export function upsertStoreProducts(
  db: DB,
  store: StoreDef,
  products: ShopifyProduct[],
  runId: number,
): StoreIngestResult {
  const result: StoreIngestResult = {
    storeId: store.id,
    fetched: products.length,
    created: 0,
    priceChanges: 0,
    availabilityFlips: 0,
    resurrected: 0,
    removed: 0,
    toParse: [],
  };

  const tx = db.transaction(() => {
    for (const product of products) {
      const write = applyProduct(db, store, product, runId);

      if (write.isNew) {
        result.created += 1;
      }

      if (write.priceChanged) {
        result.priceChanges += 1;
      }

      if (write.availabilityFlipped) {
        result.availabilityFlips += 1;
      }

      if (write.resurrected) {
        result.resurrected += 1;
      }

      if (write.toParse) {
        result.toParse.push({ storeId: store.id, productId: product.id });
      }
    }
  });

  tx();

  return result;
}

/** Marks listings absent from a successful feed fetch as removed (tombstone). */
export function detachMissingListings(
  db: DB,
  storeId: string,
  liveProductIds: Set<number>,
): number {
  const rows = db
    .prepare(
      "SELECT product_id FROM raw_listings WHERE store_id = ? AND removed_at IS NULL",
    )
    .all(storeId) as { product_id: number }[];

  let detached = 0;

  for (const row of rows) {
    if (liveProductIds.has(row.product_id)) {
      continue;
    }

    db.prepare(
      "UPDATE raw_listings SET removed_at = datetime('now') WHERE store_id = ? AND product_id = ?",
    ).run(storeId, row.product_id);
    detached += 1;
  }

  return detached;
}
