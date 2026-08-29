import type { DB } from "@/shared/db";
import { slugify } from "@/shared/lib/slug";
import { LISTING_STOCK_RANK_SQL } from "@/shared/lib/stock-state";
import type { ParseResult } from "@/features/parse/parse-listing";

export interface LinkSource {
  storeRole: "label" | "reseller";
  imageUrl: string | null;
}

export interface LinkResult {
  editionId: number;
  isNewEdition: boolean;
}

function baseSlug(parse: ParseResult): string {
  if (parse.catalogCode) {
    return slugify(`${parse.catalogCode} ${parse.variantSlug ?? ""}`);
  }

  const parts = [parse.labelSlug, parse.cleanedTitle, parse.variantSlug]
    .filter((p): p is string => Boolean(p) && p !== "standard");

  // Fall back to the edition note (e.g. "best-buy-exclusive") when there is
  // no label, so retail exclusives still get distinct slugs.
  return slugify(parts.join(" ")) || parse.editionKey;
}

function uniqueSlug(db: DB, desired: string): string {
  let candidate = desired;
  let n = 2;

  while (db.prepare("SELECT 1 FROM editions WHERE slug = ?").get(candidate)) {
    candidate = `${desired}-${n}`;
    n += 1;
  }

  return candidate;
}

/**
 * Upserts the edition a parsed listing belongs to, then links the listing.
 * Manufacturer-direct (label role) listings win the display title and image
 * over reseller ones, so ME#106 renders with Manta's own artwork and casing.
 */
export function linkParsedListing(
  db: DB,
  listing: { storeId: string; productId: number },
  parse: ParseResult,
  source: LinkSource,
): LinkResult {
  const existing = db
    .prepare("SELECT * FROM editions WHERE edition_key = ?")
    .get(parse.editionKey) as
    | { id: number; display_title: string; image_url: string | null; label: string | null; catalog_code: string | null; variant: string | null; format: string | null }
    | undefined;

  let editionId: number;
  let isNewEdition = false;

  if (!existing) {
    const slug = uniqueSlug(db, baseSlug(parse));
    const created = db
      .prepare(
        `INSERT INTO editions (slug, edition_key, label, catalog_code, variant, format, display_title, image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        slug,
        parse.editionKey,
        parse.labelSlug,
        parse.catalogCode,
        parse.variantSlug,
        parse.format,
        parse.cleanedTitle,
        source.imageUrl,
      );

    editionId = Number(created.lastInsertRowid);
    isNewEdition = true;
  } else {
    editionId = existing.id;

    const fromLabelStore = source.storeRole === "label";
    const canonical = fromLabelStore && parse.catalogCode !== null;
    const displayTitle = canonical ? parse.cleanedTitle : existing.display_title;
    const imageUrl = existing.image_url ?? source.imageUrl;

    db.prepare(
      `UPDATE editions
       SET label = COALESCE(label, ?),
           catalog_code = COALESCE(catalog_code, ?),
           variant = COALESCE(variant, ?),
           format = COALESCE(format, ?),
           display_title = ?,
           image_url = ?
       WHERE id = ?`,
    ).run(
      parse.labelSlug,
      parse.catalogCode,
      parse.variantSlug,
      parse.format,
      displayTitle,
      imageUrl,
      editionId,
    );
  }

  db.prepare(
    `INSERT INTO parsed_listings (store_id, product_id, edition_id, label, catalog_code, variant, format, cleaned_title, parse_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(store_id, product_id) DO UPDATE SET
       edition_id = excluded.edition_id,
       label = excluded.label,
       catalog_code = excluded.catalog_code,
       variant = excluded.variant,
       format = excluded.format,
       cleaned_title = excluded.cleaned_title,
       parse_json = excluded.parse_json,
       parsed_at = excluded.parsed_at`,
  ).run(
    listing.storeId,
    listing.productId,
    editionId,
    parse.labelSlug,
    parse.catalogCode,
    parse.variantSlug,
    parse.format,
    parse.cleanedTitle,
    JSON.stringify({ ...parse, note: parse.editionNote }),
  );

  return { editionId, isNewEdition };
}

/** Recomputes listing rollups (counts, price range, seen timestamps). */
export function refreshEditionRollups(db: DB, editionIds?: number[]): void {
  const all = `UPDATE editions SET
    listing_count = (
      SELECT COUNT(*) FROM parsed_listings p
      JOIN raw_listings r ON r.store_id = p.store_id AND r.product_id = p.product_id
      WHERE p.edition_id = editions.id AND r.removed_at IS NULL
    ),
    available_count = (
      SELECT COUNT(*) FROM parsed_listings p
      JOIN raw_listings r ON r.store_id = p.store_id AND r.product_id = p.product_id
      WHERE p.edition_id = editions.id AND r.removed_at IS NULL AND r.available = 1
    ),
    stock_state = (
      SELECT CASE MIN(st.rank)
        WHEN 1 THEN 'pre-order'
        WHEN 2 THEN 'in-stock'
        WHEN 3 THEN 'sold-out'
        WHEN 4 THEN 'tba'
        ELSE 'unknown'
      END
      FROM (
        SELECT ${LISTING_STOCK_RANK_SQL} AS rank
        FROM parsed_listings p
        JOIN raw_listings r ON r.store_id = p.store_id AND r.product_id = p.product_id
        WHERE p.edition_id = editions.id AND r.removed_at IS NULL
      ) st
    ),
    price_min_cents = (
      SELECT MIN(r.price_min_cents) FROM parsed_listings p
      JOIN raw_listings r ON r.store_id = p.store_id AND r.product_id = p.product_id
      WHERE p.edition_id = editions.id AND r.removed_at IS NULL
    ),
    price_max_cents = (
      SELECT MAX(r.price_max_cents) FROM parsed_listings p
      JOIN raw_listings r ON r.store_id = p.store_id AND r.product_id = p.product_id
      WHERE p.edition_id = editions.id AND r.removed_at IS NULL
    ),
    first_seen_at = (
      SELECT MIN(r.first_seen_at) FROM parsed_listings p
      JOIN raw_listings r ON r.store_id = p.store_id AND r.product_id = p.product_id
      WHERE p.edition_id = editions.id
    ),
    last_seen_at = (
      SELECT MAX(r.last_seen_at) FROM parsed_listings p
      JOIN raw_listings r ON r.store_id = p.store_id AND r.product_id = p.product_id
      WHERE p.edition_id = editions.id
    ),
    last_changed_at = (
      SELECT MAX(r.last_changed_at) FROM parsed_listings p
      JOIN raw_listings r ON r.store_id = p.store_id AND r.product_id = p.product_id
      WHERE p.edition_id = editions.id
    )`;

  if (!editionIds) {
    db.exec(all);
    return;
  }

  const byId = `${all} WHERE id = ?`;
  const stmt = db.prepare(byId);

  for (const id of editionIds) {
    stmt.run(id);
  }
}
