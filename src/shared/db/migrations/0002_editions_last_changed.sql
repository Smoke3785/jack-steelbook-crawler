-- Editions: track when any listing last actually changed (price/stock/availability).

ALTER TABLE editions ADD COLUMN last_changed_at TEXT;

UPDATE editions SET last_changed_at = (
  SELECT MAX(r.last_changed_at)
  FROM parsed_listings p
  JOIN raw_listings r ON r.store_id = p.store_id AND r.product_id = p.product_id
  WHERE p.edition_id = editions.id
);
