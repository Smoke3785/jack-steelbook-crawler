import { connection } from "next/server";
import { getDb, type EditionRow, type MovieRow } from "@/shared/db";
import { LISTING_STOCK_RANK_SQL, stockStateFromRank, type StockState } from "@/shared/lib/stock-state";

export interface EditionListing {
  store_id: string;
  product_id: number;
  store_name: string;
  url: string | null;
  title: string;
  price_min_cents: number | null;
  price_max_cents: number | null;
  available: boolean;
  stock_state: StockState;
  last_seen_at: string;
  last_changed_at: string;
  removed: boolean;
}

export interface EditionEvent {
  id: number;
  store_id: string;
  type: string;
  detail: string | null;
  seen_at: string;
  /** Null when the event came from an edition-page live recheck. */
  ingest_run_id: number | null;
}

export interface EditionDetail {
  edition: EditionRow;
  movie: MovieRow | null;
  listings: EditionListing[];
  events: EditionEvent[];
}

export async function getEditionDetail(slug: string): Promise<EditionDetail | null> {
  await connection();
  const db = await getDb();

  const edition = db
    .prepare("SELECT * FROM editions WHERE slug = ?")
    .get(slug) as EditionRow | undefined;

  if (!edition) {
    return null;
  }

  const movie = edition.movie_id
    ? (db.prepare("SELECT * FROM movies WHERE id = ?").get(edition.movie_id) as
        | MovieRow
        | undefined) ?? null
    : null;

  const listings = db
    .prepare(
      `SELECT r.store_id, r.product_id, s.name AS store_name, r.url, r.title,
              r.price_min_cents, r.price_max_cents, r.available,
              (${LISTING_STOCK_RANK_SQL}) AS stock_rank,
              r.last_seen_at, r.last_changed_at, r.removed_at
       FROM parsed_listings p
       JOIN raw_listings r ON r.store_id = p.store_id AND r.product_id = p.product_id
       JOIN stores s ON s.id = r.store_id
       WHERE p.edition_id = ?
       ORDER BY r.removed_at IS NOT NULL, r.price_min_cents IS NULL, r.price_min_cents ASC`,
    )
    .all(edition.id) as (Omit<EditionListing, "available" | "removed" | "stock_state"> & {
      available: number;
      stock_rank: number;
      removed_at: string | null;
    })[];

  const events = db
    .prepare(
      `SELECT le.id, le.store_id, le.type, le.detail, le.seen_at, le.ingest_run_id
       FROM listing_events le
       JOIN parsed_listings p ON p.store_id = le.store_id AND p.product_id = le.product_id
       WHERE p.edition_id = ?
       ORDER BY le.seen_at DESC, le.id DESC
       LIMIT 25`,
    )
    .all(edition.id) as EditionEvent[];

  return {
    edition,
    movie,
    listings: listings.map((l) => ({
      ...l,
      available: l.available === 1,
      stock_state: stockStateFromRank(l.stock_rank),
      removed: l.removed_at !== null,
    })),
    events,
  };
}
