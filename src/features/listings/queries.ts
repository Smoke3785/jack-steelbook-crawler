import { connection } from "next/server";
import { getDb } from "@/shared/db";
import { PAGE_SIZE, type ListingFilters } from "./filters";

export interface BrowseItem {
  id: number;
  slug: string;
  display_title: string;
  label: string | null;
  catalog_code: string | null;
  variant: string | null;
  format: string | null;
  image_url: string | null;
  listing_count: number;
  available_count: number;
  stock_state: string | null;
  price_min_cents: number | null;
  price_max_cents: number | null;
  first_seen_at: string;
  last_changed_at: string | null;
  movie_title: string | null;
  movie_year: number | null;
  store_ids: string[];
}

export interface FacetValue {
  value: string;
  count: number;
}

export interface BrowseFacets {
  stores: { id: string; name: string; count: number }[];
  labels: FacetValue[];
  variants: FacetValue[];
  formats: FacetValue[];
}

export interface BrowseResult {
  items: BrowseItem[];
  total: number;
  page: number;
  pageCount: number;
  facets: BrowseFacets;
}

const NEW_WINDOW_DAYS = 14;

function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

interface WhereClause {
  sql: string;
  params: (string | number)[];
}

function buildWhere(filters: ListingFilters): WhereClause {
  const clauses: string[] = ["e.listing_count > 0"];
  const params: (string | number)[] = [];

  if (filters.q) {
    const like = `%${escapeLike(filters.q)}%`;
    clauses.push(
      `(e.display_title LIKE ? ESCAPE '\\' OR e.catalog_code LIKE ? ESCAPE '\\' OR m.title LIKE ? ESCAPE '\\')`,
    );
    params.push(like, like, like);
  }

  if (filters.store) {
    clauses.push(
      `EXISTS (
        SELECT 1 FROM parsed_listings p
        JOIN raw_listings r ON r.store_id = p.store_id AND r.product_id = p.product_id
        WHERE p.edition_id = e.id AND r.store_id = ? AND r.removed_at IS NULL
      )`,
    );
    params.push(filters.store);
  }

  if (filters.label) {
    if (filters.label === "retail") {
      clauses.push(`(e.label IS NULL OR e.label = '')`);
    } else {
      clauses.push(`e.label = ?`);
      params.push(filters.label);
    }
  }

  if (filters.variant) {
    if (filters.variant === "standard") {
      clauses.push(`e.variant IS NULL`);
    } else {
      clauses.push(`e.variant = ?`);
      params.push(filters.variant);
    }
  }

  if (filters.format) {
    clauses.push(`e.format = ?`);
    params.push(filters.format);
  }

  if (filters.availability !== "any") {
    clauses.push(`e.stock_state = ?`);
    params.push(filters.availability);
  }

  if (filters.status === "new") {
    clauses.push(`e.first_seen_at >= datetime('now', '-${NEW_WINDOW_DAYS} days')`);
  }

  return { sql: clauses.join("\n  AND "), params };
}

function orderClause(sort: ListingFilters["sort"]): string {
  switch (sort) {
    case "price-asc":
      return `(e.price_min_cents IS NULL), e.price_min_cents ASC`;
    case "price-desc":
      return `(e.price_max_cents IS NULL), e.price_max_cents DESC`;
    case "title":
      return `e.display_title COLLATE NOCASE ASC`;
    default:
      return `e.first_seen_at DESC, e.id DESC`;
  }
}

function loadFacets(db: Awaited<ReturnType<typeof getDb>>): BrowseFacets {
  const stores = db
    .prepare(
      `SELECT r.store_id AS id, s.name AS name, COUNT(DISTINCT p.edition_id) AS count
       FROM parsed_listings p
       JOIN raw_listings r
         ON r.store_id = p.store_id AND r.product_id = p.product_id AND r.removed_at IS NULL
       JOIN stores s ON s.id = r.store_id
       GROUP BY r.store_id
       ORDER BY count DESC, s.name ASC`,
    )
    .all() as { id: string; name: string; count: number }[];

  const valueFacet = (column: string, fallback: string, limit: number) =>
    db
      .prepare(
        `SELECT COALESCE(${column}, ?) AS value, COUNT(*) AS count
         FROM editions e WHERE e.listing_count > 0
         GROUP BY value ORDER BY count DESC, value ASC LIMIT ?`,
      )
      .all(fallback, limit) as FacetValue[];

  return {
    stores,
    labels: valueFacet("e.label", "retail", 30),
    variants: valueFacet("e.variant", "standard", 40),
    formats: valueFacet("e.format", "", 10).filter((f) => f.value !== ""),
  };
}

/** Runs the browse query for one page of editions plus filter facets. */
export async function queryBrowse(filters: ListingFilters): Promise<BrowseResult> {
  await connection();
  const db = await getDb();

  const where = buildWhere(filters);

  const totalRow = db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM editions e LEFT JOIN movies m ON m.id = e.movie_id
       WHERE ${where.sql}`,
    )
    .get(...where.params) as { total: number };

  const total = totalRow.total;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);

  const items = db
    .prepare(
      `SELECT e.id, e.slug, e.display_title, e.label, e.catalog_code, e.variant, e.format,
              e.image_url, e.listing_count, e.available_count, e.stock_state,
              e.price_min_cents, e.price_max_cents, e.first_seen_at, e.last_changed_at,
              m.title AS movie_title,
              CASE WHEN m.release_date IS NULL THEN NULL
                   ELSE CAST(substr(m.release_date, 1, 4) AS INTEGER) END AS movie_year
       FROM editions e LEFT JOIN movies m ON m.id = e.movie_id
       WHERE ${where.sql}
       ORDER BY ${orderClause(filters.sort)}
       LIMIT ? OFFSET ?`,
    )
    .all(...where.params, PAGE_SIZE, (page - 1) * PAGE_SIZE) as Omit<
    BrowseItem,
    "store_ids"
  >[];

  const storeIdsByEdition = new Map<number, string[]>();

  if (items.length > 0) {
    const placeholders = items.map(() => "?").join(",");
    const rows = db
      .prepare(
        `SELECT p.edition_id AS edition_id, r.store_id AS store_id
         FROM parsed_listings p
         JOIN raw_listings r
           ON r.store_id = p.store_id AND r.product_id = p.product_id AND r.removed_at IS NULL
         WHERE p.edition_id IN (${placeholders})`,
      )
      .all(...items.map((i) => i.id)) as { edition_id: number; store_id: string }[];

    for (const row of rows) {
      const list = storeIdsByEdition.get(row.edition_id) ?? [];

      // An edition can have several listings on one store (duplicate product
      // pages); the badges show distinct stores only.
      if (!list.includes(row.store_id)) {
        list.push(row.store_id);
      }

      storeIdsByEdition.set(row.edition_id, list);
    }
  }

  return {
    items: items.map((item) => ({
      ...item,
      store_ids: storeIdsByEdition.get(item.id) ?? [],
    })),
    total,
    page,
    pageCount,
    facets: loadFacets(db),
  };
}
