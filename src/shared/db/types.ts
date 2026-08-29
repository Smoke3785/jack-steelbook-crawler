export interface StoreRow {
  id: string;
  name: string;
  base_url: string;
  kind: "shopify" | "scraper";
  role: "label" | "reseller";
  enabled: number;
  created_at: string;
}

export interface IngestRunRow {
  id: number;
  trigger: string;
  started_at: string;
  finished_at: string | null;
  stats_json: string | null;
}

export interface MovieRow {
  id: number;
  tmdb_id: number | null;
  title: string;
  original_title: string | null;
  release_date: string | null;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  popularity: number | null;
  match_query: string | null;
  match_confidence: number | null;
  matched_at: string;
}

export interface EditionRow {
  id: number;
  slug: string;
  edition_key: string;
  label: string | null;
  catalog_code: string | null;
  variant: string | null;
  format: string | null;
  display_title: string;
  movie_id: number | null;
  image_url: string | null;
  listing_count: number;
  available_count: number;
  stock_state: string | null;
  price_min_cents: number | null;
  price_max_cents: number | null;
  first_seen_at: string;
  last_seen_at: string;
  last_changed_at: string | null;
  last_rechecked_at: string | null;
}

export interface RawListingRow {
  store_id: string;
  product_id: number;
  handle: string;
  title: string;
  vendor: string | null;
  product_type: string | null;
  tags: string;
  image_url: string | null;
  url: string | null;
  raw_json: string;
  price_min_cents: number | null;
  price_max_cents: number | null;
  available: number;
  first_seen_at: string;
  last_seen_at: string;
  last_changed_at: string;
  removed_at: string | null;
}

export type ListingEventType = "new" | "price_change" | "available" | "unavailable";

export interface ListingEventRow {
  id: number;
  ingest_run_id: number | null;
  store_id: string;
  product_id: number;
  type: ListingEventType;
  detail: string | null;
  seen_at: string;
}

export interface ParsedListingRow {
  store_id: string;
  product_id: number;
  edition_id: number;
  label: string | null;
  catalog_code: string | null;
  variant: string | null;
  format: string | null;
  cleaned_title: string;
  parse_json: string | null;
  parsed_at: string;
}
