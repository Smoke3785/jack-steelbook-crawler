import { after } from "next/server";
import { getDb } from "@/shared/db";
import { storeDef } from "@/features/ingest/stores";
import { FeedError, fetchProductByHandle } from "@/features/ingest/shopify";
import { applyProduct } from "@/features/ingest/upsert";
import { refreshEditionRollups } from "./editions-repo";

/**
 * Edition-page background recheck. Viewing an edition schedules a refresh of
 * its known listings (price/stock) at most once per hour. The render never
 * waits on it — results land for the next load.
 */

const RECHECK_TTL_HOURS = 1;
const MAX_LISTINGS_PER_RECHECK = 12;

interface RecheckTarget {
  store_id: string;
  product_id: number;
  handle: string;
}

async function recheckEdition(editionId: number): Promise<void> {
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
      `SELECT r.store_id, r.product_id, r.handle
       FROM parsed_listings p
       JOIN raw_listings r ON r.store_id = p.store_id AND r.product_id = p.product_id
       WHERE p.edition_id = ? AND r.removed_at IS NULL
       LIMIT ?`,
    )
    .all(editionId, MAX_LISTINGS_PER_RECHECK) as RecheckTarget[];

  let touched = false;

  for (const target of targets) {
    const store = storeDef(target.store_id);

    if (!store || store.kind !== "shopify" || !store.enabled) {
      continue;
    }

    try {
      const product = await fetchProductByHandle(store.id, store.baseUrl, target.handle);

      if (product) {
        applyProduct(db, store, product, null);
        touched = true;
      }
    } catch (err) {
      if (err instanceof FeedError) {
        continue; // one store hiccuping shouldn't abort the rest
      }

      throw err;
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
