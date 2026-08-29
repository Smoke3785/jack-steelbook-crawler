-- Editions: derived stock state (pre-order / in-stock / sold-out / tba / unknown).
-- Mirrors the rank SQL in src/shared/lib/stock-state.ts (migrations are frozen
-- snapshots, so the expression is duplicated here deliberately).

ALTER TABLE editions ADD COLUMN stock_state TEXT;

UPDATE editions SET stock_state = (
  SELECT CASE MIN(st.rank)
    WHEN 1 THEN 'pre-order'
    WHEN 2 THEN 'in-stock'
    WHEN 3 THEN 'sold-out'
    WHEN 4 THEN 'tba'
    ELSE 'unknown'
  END
  FROM (
    SELECT CASE
      WHEN r.available = 1 AND (
        lower(r.title) LIKE '%preorder%'
        OR lower(r.title) LIKE '%pre-order%'
        OR lower(r.tags) LIKE '%preorder%'
        OR lower(r.tags) LIKE '%pre-order%'
      ) THEN 1
      WHEN r.available = 1 THEN 2
      WHEN r.available = 0
           AND COALESCE(r.price_max_cents, 0) > 0
           AND (
             (SELECT role FROM stores WHERE id = r.store_id) = 'reseller'
             OR EXISTS (
               SELECT 1 FROM listing_events le
               WHERE le.store_id = r.store_id
                 AND le.product_id = r.product_id
                 AND (
                   le.type = 'available'
                   OR (le.type = 'new' AND json_extract(le.detail, '$.available') = 1)
                 )
             )
           ) THEN 3
      WHEN r.available = 0 AND COALESCE(r.price_max_cents, 0) = 0 THEN 4
      ELSE 5
    END AS rank
    FROM parsed_listings p
    JOIN raw_listings r ON r.store_id = p.store_id AND r.product_id = p.product_id
    WHERE p.edition_id = editions.id AND r.removed_at IS NULL
  ) st
);
