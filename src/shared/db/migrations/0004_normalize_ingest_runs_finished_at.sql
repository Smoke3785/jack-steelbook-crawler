-- finished_at was written as full ISO strings ("2026-08-29T22:12:39.260Z")
-- while started_at uses SQLite datetime format; duration math and the shared
-- formatters expect the latter. Normalize any ISO rows.
UPDATE ingest_runs
SET finished_at = strftime('%Y-%m-%d %H:%M:%S', finished_at)
WHERE finished_at LIKE '%T%Z';
