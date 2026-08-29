/**
 * Shared stock-state model. A listing's availability in the Shopify feed
 * conflates several real-world situations, so we derive a stricter state:
 *
 *   pre-order  available now, and the listing is a pre-order (title/tags)
 *   in-stock   available now
 *   sold-out   unavailable, priced, and trustworthy: reseller inventory is
 *              live, or we have ourselves observed this listing in stock
 *   tba        unavailable with no price — announced but not yet orderable
 *   unknown    unavailable, priced, but the store never exposes availability
 *              (e.g. Manta Lab's drop model) and we've never seen it flip
 *
 * One SQL expression (rank 1-5, lower wins) shared by the listing query, the
 * edition rollup, and the edition page. `r` is the raw_listings alias.
 */

const PREORDER_SQL = `(
  lower(r.title) LIKE '%preorder%'
  OR lower(r.title) LIKE '%pre-order%'
  OR lower(r.tags) LIKE '%preorder%'
  OR lower(r.tags) LIKE '%pre-order%'
)`;

const EVER_OBSERVED_AVAILABLE_SQL = `EXISTS (
  SELECT 1 FROM listing_events le
  WHERE le.store_id = r.store_id
    AND le.product_id = r.product_id
    AND (
      le.type = 'available'
      OR (le.type = 'new' AND json_extract(le.detail, '$.available') = 1)
    )
)`;

/** Rank per listing; lower rank wins at the edition level. */
export const LISTING_STOCK_RANK_SQL = `CASE
  WHEN r.available = 1 AND ${PREORDER_SQL} THEN 1
  WHEN r.available = 1 THEN 2
  WHEN r.available = 0
       AND COALESCE(r.price_max_cents, 0) > 0
       AND ((SELECT role FROM stores WHERE id = r.store_id) = 'reseller' OR ${EVER_OBSERVED_AVAILABLE_SQL}) THEN 3
  WHEN r.available = 0 AND COALESCE(r.price_max_cents, 0) = 0 THEN 4
  ELSE 5
END`;

export type StockState = "pre-order" | "in-stock" | "sold-out" | "tba" | "unknown";

export function stockStateFromRank(rank: number | null): StockState {
  switch (rank) {
    case 1:
      return "pre-order";
    case 2:
      return "in-stock";
    case 3:
      return "sold-out";
    case 4:
      return "tba";
    default:
      return "unknown";
  }
}

export function stockStateLabel(state: StockState): string {
  switch (state) {
    case "pre-order":
      return "Pre-order";
    case "in-stock":
      return "In stock";
    case "sold-out":
      return "Sold out";
    case "tba":
      return "TBA";
    case "unknown":
      return "Unknown";
  }
}

export function stockStateHint(state: StockState): string {
  switch (state) {
    case "pre-order":
      return "Orderable now as a pre-order";
    case "in-stock":
      return "Orderable now";
    case "sold-out":
      return "No store currently reports stock";
    case "tba":
      return "Announced but not yet orderable (no price listed)";
    case "unknown":
      return "Store never exposes availability and we've never seen it in stock";
  }
}
