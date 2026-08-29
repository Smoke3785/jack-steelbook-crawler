import type { DB } from "@/shared/db";
import { searchMovie, type TmdbSearchResult } from "./client";
import type { ParseResult } from "@/features/parse/parse-listing";

/**
 * Attaches the best TMDB candidate to an edition with a confidence score.
 * Score = token-set similarity between the cleaned title and the candidate
 * title (+ a year bonus when the listing carried one). Below the threshold
 * the edition stays unmatched — the admin review queue comes later.
 */

const MATCH_THRESHOLD = 0.55;
const MAX_MATCHES_PER_RUN = 60;

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 0 && t !== "the" && t !== "a"),
  );
}

function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }

  let intersection = 0;

  for (const token of a) {
    if (b.has(token)) {
      intersection += 1;
    }
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function scoreCandidate(
  queryTokens: Set<string>,
  candidate: TmdbSearchResult,
  yearHint: number | null,
): number {
  const titleScore = similarity(queryTokens, tokenize(candidate.title));

  if (titleScore === 1) {
    return 1;
  }

  const originalScore = candidate.original_title
    ? similarity(queryTokens, tokenize(candidate.original_title))
    : 0;

  let score = Math.max(titleScore, originalScore);
  const candidateYear = candidate.release_date ? Number(candidate.release_date.slice(0, 4)) : null;

  if (yearHint && candidateYear && Math.abs(yearHint - candidateYear) <= 1) {
    score += 0.2;
  }

  return Math.min(1, score);
}

interface EditionMatchInput {
  editionId: number;
  displayTitle: string;
  parse: Pick<ParseResult, "searchQuery" | "yearHint"> | null;
}

function upsertMovie(
  db: DB,
  candidate: TmdbSearchResult,
  query: string,
  confidence: number,
): number {
  const existing = db
    .prepare("SELECT id FROM movies WHERE tmdb_id = ?")
    .get(candidate.id) as { id: number } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE movies SET title = ?, original_title = ?, release_date = ?, overview = ?,
         poster_path = ?, backdrop_path = ?, popularity = ?, match_query = ?, match_confidence = ?,
         matched_at = datetime('now')
       WHERE id = ?`,
    ).run(
      candidate.title,
      candidate.original_title,
      candidate.release_date,
      candidate.overview,
      candidate.poster_path,
      candidate.backdrop_path,
      candidate.popularity,
      query,
      confidence,
      existing.id,
    );

    return existing.id;
  }

  const inserted = db
    .prepare(
      `INSERT INTO movies
         (tmdb_id, title, original_title, release_date, overview, poster_path, backdrop_path,
          popularity, match_query, match_confidence)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      candidate.id,
      candidate.title,
      candidate.original_title,
      candidate.release_date,
      candidate.overview,
      candidate.poster_path,
      candidate.backdrop_path,
      candidate.popularity,
      query,
      confidence,
    );

  return Number(inserted.lastInsertRowid);
}

/** Finds and attaches the best TMDB movie for one edition. Returns confidence. */
export async function matchEditionToMovie(
  db: DB,
  edition: EditionMatchInput,
): Promise<number | null> {
  const query = edition.parse?.searchQuery ?? edition.displayTitle;
  const yearHint = edition.parse?.yearHint ?? null;

  const candidates = await searchMovie(db, query, yearHint);

  if (candidates.length === 0) {
    return null;
  }

  const queryTokens = tokenize(query);
  let best: { candidate: TmdbSearchResult; score: number } | null = null;

  for (const candidate of candidates) {
    const score = scoreCandidate(queryTokens, candidate, yearHint);

    if (!best || score > best.score) {
      best = { candidate, score };
    }
  }

  if (!best || best.score < MATCH_THRESHOLD) {
    return null;
  }

  const movieId = upsertMovie(db, best.candidate, query, best.score);

  db.prepare("UPDATE editions SET movie_id = ? WHERE id = ?").run(movieId, edition.editionId);

  return best.score;
}

/**
 * Matches all unmatched editions (bounded per run so one cron job can't
 * hammer TMDB after a large first ingest).
 */
export async function matchOutstandingEditions(db: DB): Promise<{ matched: number; skipped: number}> {
  const editions = db
    .prepare(
      `SELECT e.id, e.display_title,
              (SELECT p.cleaned_title FROM parsed_listings p
                WHERE p.edition_id = e.id AND p.parse_json IS NOT NULL LIMIT 1) AS parse_json
       FROM editions e
       WHERE e.movie_id IS NULL
       ORDER BY e.id
       LIMIT ?`,
    )
    .all(MAX_MATCHES_PER_RUN) as { id: number; display_title: string; parse_json: string | null }[];

  let matched = 0;

  for (const edition of editions) {
    let parse: Pick<ParseResult, "searchQuery" | "yearHint"> | null = null;

    if (edition.parse_json) {
      try {
        const full = JSON.parse(edition.parse_json) as ParseResult;
        parse = { searchQuery: full.searchQuery, yearHint: full.yearHint };
      } catch {
        parse = null;
      }
    }

    const confidence = await matchEditionToMovie(db, {
      editionId: edition.id,
      displayTitle: edition.display_title,
      parse,
    });

    if (confidence !== null) {
      matched += 1;
    }
  }

  return { matched, skipped: editions.length - matched };
}
