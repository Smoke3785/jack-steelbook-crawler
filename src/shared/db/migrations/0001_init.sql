-- Initial schema: stores, raw listings + diff events, parsed listings, editions, movies.

CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'shopify',
  role TEXT NOT NULL DEFAULT 'label',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ingest_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  stats_json TEXT
);

CREATE TABLE IF NOT EXISTS movies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tmdb_id INTEGER UNIQUE,
  title TEXT NOT NULL,
  original_title TEXT,
  release_date TEXT,
  overview TEXT,
  poster_path TEXT,
  backdrop_path TEXT,
  popularity REAL,
  match_query TEXT,
  match_confidence REAL,
  matched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS editions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  edition_key TEXT NOT NULL UNIQUE,
  label TEXT,
  catalog_code TEXT,
  variant TEXT,
  format TEXT,
  display_title TEXT NOT NULL,
  movie_id INTEGER REFERENCES movies(id),
  image_url TEXT,
  listing_count INTEGER NOT NULL DEFAULT 0,
  available_count INTEGER NOT NULL DEFAULT 0,
  price_min_cents INTEGER,
  price_max_cents INTEGER,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_rechecked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_editions_label ON editions(label);
CREATE INDEX IF NOT EXISTS idx_editions_movie ON editions(movie_id);

CREATE TABLE IF NOT EXISTS raw_listings (
  store_id TEXT NOT NULL REFERENCES stores(id),
  product_id INTEGER NOT NULL,
  handle TEXT NOT NULL,
  title TEXT NOT NULL,
  vendor TEXT,
  product_type TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  image_url TEXT,
  url TEXT,
  raw_json TEXT NOT NULL,
  price_min_cents INTEGER,
  price_max_cents INTEGER,
  available INTEGER NOT NULL DEFAULT 0,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  removed_at TEXT,
  PRIMARY KEY (store_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_raw_listings_store ON raw_listings(store_id, last_seen_at);

CREATE TABLE IF NOT EXISTS listing_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ingest_run_id INTEGER REFERENCES ingest_runs(id),
  store_id TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  detail TEXT,
  seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_listing_events_listing
  ON listing_events(store_id, product_id, seen_at);
CREATE INDEX IF NOT EXISTS idx_listing_events_run ON listing_events(ingest_run_id);

CREATE TABLE IF NOT EXISTS parsed_listings (
  store_id TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  edition_id INTEGER NOT NULL REFERENCES editions(id),
  label TEXT,
  catalog_code TEXT,
  variant TEXT,
  format TEXT,
  cleaned_title TEXT NOT NULL,
  parse_json TEXT,
  parsed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (store_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_parsed_listings_edition ON parsed_listings(edition_id);

CREATE TABLE IF NOT EXISTS tmdb_cache (
  cache_key TEXT PRIMARY KEY,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
