import type { DB } from "@/shared/db";

/**
 * TMDB search client with a local response cache so repeated editions never
 * re-query the API. Uses the v3 api_key or a v4 bearer token; without either,
 * matching is disabled and returns null.
 */

export interface TmdbSearchResult {
  id: number;
  title: string;
  original_title: string | null;
  release_date: string | null;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  popularity: number;
}

interface CachedPayload {
  results: TmdbSearchResult[];
}

const API_BASE = "https://api.themoviedb.org/3";
const CACHE_TTL_DAYS = 30;

export function tmdbConfigured(): boolean {
  return Boolean(process.env.TMDB_API_KEY || process.env.TMDB_ACCESS_TOKEN);
}

async function tmdbFetch(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`${API_BASE}${path}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const headers: Record<string, string> = { accept: "application/json" };

  if (process.env.TMDB_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.TMDB_ACCESS_TOKEN}`;
  } else {
    url.searchParams.set("api_key", process.env.TMDB_API_KEY ?? "");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url, { headers, signal: controller.signal, cache: "no-store" });

    if (!res.ok) {
      throw new Error(`TMDB ${path} -> HTTP ${res.status}`);
    }

    return (await res.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

function readCache(db: DB, cacheKey: string): CachedPayload | null {
  const row = db
    .prepare(
      `SELECT response_json, created_at FROM tmdb_cache
       WHERE cache_key = ? AND created_at > datetime('now', '-${CACHE_TTL_DAYS} days')`,
    )
    .get(cacheKey) as { response_json: string } | undefined;

  return row ? (JSON.parse(row.response_json) as CachedPayload) : null;
}

function writeCache(db: DB, cacheKey: string, payload: CachedPayload): void {
  db.prepare(
    `INSERT INTO tmdb_cache (cache_key, response_json) VALUES (?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET
       response_json = excluded.response_json,
       created_at = datetime('now')`,
  ).run(cacheKey, JSON.stringify(payload));
}

/**
 * Searches TMDB for a movie. Cached locally; a search with a year that
 * returns nothing retries once without the year.
 */
export async function searchMovie(
  db: DB,
  query: string,
  year?: number | null,
): Promise<TmdbSearchResult[]> {
  if (!tmdbConfigured()) {
    return [];
  }

  const attempt = async (y?: number | null): Promise<TmdbSearchResult[]> => {
    const cacheKey = JSON.stringify([query.toLowerCase().trim(), y ?? null]);

    const cached = readCache(db, cacheKey);
    if (cached) {
      return cached.results;
    }

    const params: Record<string, string> = {
      query,
      include_adult: "false",
      page: "1",
    };

    if (y) {
      params.year = String(y);
    }

    const payload = (await tmdbFetch("/search/movie", params)) as {
      results?: TmdbSearchResult[];
    };
    const results = payload.results ?? [];
    writeCache(db, cacheKey, { results });

    return results;
  };

  const withYear = year ? await attempt(year) : [];

  if (withYear.length > 0 || !year) {
    return withYear;
  }

  return attempt(null);
}
