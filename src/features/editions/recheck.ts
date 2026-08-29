import { after } from "next/server";
import { getDb } from "@/shared/db";
import { storeDef } from "@/features/ingest/stores";
import { FeedError, fetchAllProducts, type ShopifyProduct } from "@/features/ingest/shopify";
import { applyProduct } from "@/features/ingest/upsert";
import { refreshEditionRollups } from "./editions-repo";

/**
 * Edition-page background recheck. Viewing an edition schedules a refresh of
 * its known listings (price/stock) at most once per hour. The render never
 * waits on it — results land for the next load.
 *
 * The recheck reads the same paginated /products.json feed the ingest uses.
 * The per-product endpoints are not trustworthy here: /products/{handle}.json
 * omits per-variant `available` entirely (every recheck would read "sold
 * out"), and ?handle= filtering is silently ignored by some storefronts.
 * Feeds are pulled once per store per hour and shared across rechecks.
 */

const RECHECK_TTL_HOURS = 1;
const STORE_FEED_CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_LISTINGS_PER_RECHECK = 12;

const feedCache = new Map<string, { fetchedAt: number; products: ShopifyProduct[] }>();

async function getStoreFeed(storeId: string, baseUrl: string): Promise<ShopifyProduct[]> {
  const cached = feedCache.get(storeId);

  if (cached && Date.now() - cached.fetchedAt < STORE_FEED_CACHE_TTL_MS) {
    return cached.products;
  }

  const products = await fetchAllProducts(storeId, baseUrl);
  feedCache.set(storeId, { fetchedAt: Date.now(), products });

  return products;
}

interface RecheckTarget {
  store_id: string;
  product_id: number;
}

/** Refreshes one edition's listings from the live store feeds. Exported for testing. */
export async function recheckEdition(editionId: number): Promise<void> {
  const db = await getDb();

  const claimed = db
    .prepare(
      `UPDATE editions SET last_rechecked_at = datetime('now')
       WHERE id = ? AND (
         last_rechecked_at IS NULL
         OR last_rechecked_at < datetime('now', '-${RECHECK_TTL_HOURS} hours')
       )`,
    )
    .run(editionId).changes;

  if (claimed === 0) {
    return;
  }

  const targets = db
    .prepare(
      `SELECT r.store_id, r.product_id
       FROM parsed_listings p
       JOIN raw_listings r ON r.store_id = p.store_id AND r.product_id = p.product_id
       WHERE p.edition_id = ?
       LIMIT ?`,
    )
    .all(editionId, MAX_LISTINGS_PER_RECHECK) as RecheckTarget[];

  const byStore = new Map<string, number[]>();

  for (const target of targets) {
    const ids = byStore.get(target.store_id) ?? [];
    ids.push(target.product_id);
    byStore.set(target.store_id, ids);
  }

  let touched = false;

  for (const [storeId, productIds] of byStore) {
    const store = storeDef(storeId);

    if (!store || store.kind !== "shopify" || !store.enabled) {
      continue;
    }

    let feed: ShopifyProduct[];

    try {
      feed = await getStoreFeed(store.id, store.baseUrl);
    } catch (err) {
      if (err instanceof FeedError) {
        continue; // one store hiccuping shouldn't abort the rest
      }

      throw err;
    }

    const feedById = new Map(feed.map((p) => [p.id, p]));

    for (const productId of productIds) {
      const product = feedById.get(productId);

      if (product) {
        applyProduct(db, store, product, null);
        touched = true;
      } else if (
        db
          .prepare(
            "SELECT 1 FROM raw_listings WHERE store_id = ? AND product_id = ? AND removed_at IS NULL",
          )
          .get(storeId, productId)
      ) {
        // Present in our snapshot but absent from a feed we just read fully: delisted.
        db.prepare(
          "UPDATE raw_listings SET removed_at = datetime('now') WHERE store_id = ? AND product_id = ?",
        ).run(storeId, productId);
        touched = true;
      }
    }
  }

  if (touched) {
    refreshEditionRollups(db, [editionId]);
  }
}

/**
 * Schedules a cached (~1h) background recheck after the response is sent.
 * Safe to call on every edition page load.
 */
export function scheduleEditionRecheck(editionId: number): void {
  after(async () => {
    try {
      await recheckEdition(editionId);
    } catch (err) {
      console.error(`[recheck] edition ${editionId} failed:`, err);
    }
  });
}
