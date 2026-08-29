# Steelbook Search

Aggregates premium steelbook releases (Manta Lab, Plain Archive, WeET, FilmArena, …) across every store that stocks them, collapses per-store listings into one edition per variant, and matches each edition to its movie via TMDB.

## How it works

```
Shopify feeds ──▶ raw_listings ──▶ parse ──▶ editions ──▶ TMDB match
 (10+ stores)     keyed by        label, catalog no.   one edition     movies +
                   (store,         variant, format,    per variant     confidence
                   product_id)     cleaned title
                        │
                        └─▶ listing_events: new / price_change / available / unavailable
```

1. **Ingest** (`npm run ingest`) — pulls `/products.json` from every enabled Shopify store, upserts into `raw_listings` keyed by `(store_id, product_id)`, and diffs against the previous snapshot: new IDs, price changes, availability flips each get a `listing_events` row.
2. **Parse** — new/changed listings get a structured pass: label (from title tokens or vendor), catalog number (`ME#\d+`, `FAC #\d+`, `BE#\d+`, …), variant (fullslip / lenti / quarter / one-click / Type A–D), format, and a cleaned title. Pure functions in `src/features/parse/`.
3. **Edition grouping** — listings that parse to the same `(label, catalog, variant)` collapse into one edition, so ME#106 on three stores is one edition per variant. Retail releases without catalog numbers group by cleaned title + edition note.
4. **TMDB** — the cleaned title searches TMDB (cached in `tmdb_cache`); the best candidate attaches to the edition with a confidence score. No key configured? Matching silently skips.
5. **Browse** (`/`) and ops view at `/status` — one page, all editions, every filter (search, store, label, variant, format, availability, new-only, sort, pagination) lives in URL params so any view is a shareable link.
6. **Edition page** (`/editions/<slug>`, e.g. `/editions/me-95-full-slip`) — all listings for the edition with prices, stock, store links, and event history. Loading it schedules a background re-check of that edition's listings, cached ~1 hour per edition.

Nothing else is live — the site serves snapshot data; only the edition pages refresh themselves on view.

## Running it

```bash
npm install
npm run ingest     # pull all feeds (first run: ~30s, ~8.5k listings)
npm run dev        # http://localhost:3000
```

Optional environment variables (`.env.local`):

| Variable             | Purpose                                          |
| -------------------- | ------------------------------------------------ |
| `TMDB_API_KEY`       | TMDB v3 API key for movie matching               |
| `TMDB_ACCESS_TOKEN`  | TMDB v4 bearer token (alternative to the v3 key) |
| `DATABASE_PATH`      | SQLite file location (default `data/app.db`)     |

## Cron

`.github/workflows/ingest.yml` runs a daily crawl (06:17 UTC) plus a build check; the SQLite file persists between runs via the Actions cache. Set `TMDB_API_KEY` as a repo secret to enable matching there. The workflow is also runnable manually (`workflow_dispatch`). For a self-hosted deployment, point cron at `npm run ingest:cron` instead.

## Stores

| Store                        | Kind     | Status                                     |
| ---------------------------- | -------- | ------------------------------------------ |
| mantalab.com                 | label    | live                                       |
| plainarchive.com             | label    | live                                       |
| collectong.com               | label    | live (Manta partner)                       |
| everythingblustore.com       | label    | disabled — `products.json` 404s at source  |
| cinemuseum.com               | label    | disabled — domain not resolving            |
| shop.hidefninja.com          | reseller | live                                       |
| bluraylife.com               | reseller | live                                       |
| infinitesteeldealz.com       | reseller | live                                       |
| steelbookclub.com            | reseller | live                                       |
| steelbooklife.com            | reseller | live (mirrors Cinemuseum, Manta, BluFans)  |
| themovieroom.com             | reseller | live                                       |
| steelbooks.com               | reseller | live                                       |
| kimchidvd / weet / filmarena | scraper  | placeholders — HTML scrapers not built yet |

Add or re-enable stores in `src/features/ingest/stores.ts`; new catalog prefixes go in `src/features/parse/catalog.ts`.

## Layout

Feature-sliced: each vertical (`ingest`, `parse`, `tmdb`, `listings`, `editions`) owns its logic and UI under `src/features/`, cross-cutting pieces live in `src/shared/` (db, formatting, URL param codecs, chips), and `src/app/` stays thin route wiring. The database layer is plain SQL migrations in `src/shared/db/migrations/`, applied automatically on first connection.

## Roadmap

- Kimchi / WeET / FilmArena HTML scrapers (store entries already stubbed as `kind: "scraper"`).
- Admin review queue for low-confidence TMDB matches and edition merges (e.g. one-click variants that lack a catalog number on reseller titles).
