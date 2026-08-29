import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getEditionDetail } from "@/features/editions/queries";
import { scheduleEditionRecheck } from "@/features/editions/recheck";
import { Badge } from "@/shared/ui/badge";
import { storeName } from "@/shared/lib/stores";
import { formatDate, formatDateTime, formatPriceRange, timeAgo } from "@/shared/lib/format";
import { labelName } from "@/features/parse/labels";
import { formatDisplay } from "@/features/parse/format";
import type { EditionEvent } from "@/features/editions/queries";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342";

export async function generateMetadata({
  params,
}: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const detail = await getEditionDetail(slug);

  if (!detail) {
    return { title: "Edition not found" };
  }

  const { edition, movie, listings } = detail;
  const storeCount = new Set(listings.filter((l) => !l.removed).map((l) => l.store_id)).size;
  const description =
    movie?.overview?.slice(0, 200) ??
    `${edition.listing_count} listing${edition.listing_count === 1 ? "" : "s"} across ${storeCount} store${storeCount === 1 ? "" : "s"}`;

  const openGraph = edition.image_url
    ? {
        title: edition.display_title,
        description,
        images: [{ url: edition.image_url, alt: edition.display_title }],
      }
    : undefined;

  const twitter = edition.image_url
    ? {
        card: "summary_large_image" as const,
        title: edition.display_title,
        description,
        images: [edition.image_url],
      }
    : undefined;

  return {
    title: edition.display_title,
    description,
    openGraph,
    twitter,
  };
}

function eventLabel(event: EditionEvent): string {
  switch (event.type) {
    case "new":
      return "Listed";
    case "price_change":
      return "Price change";
    case "available":
      return "Back in stock";
    case "unavailable":
      return "Sold out";
    default:
      return event.type;
  }
}

function eventDetail(event: EditionEvent): string | null {
  if (!event.detail) {
    return null;
  }

  try {
    const parsed = JSON.parse(event.detail) as {
      before?: [number | null, number | null];
      after?: [number | null, number | null];
    };

    if (parsed.before && parsed.after) {
      return `${formatPriceRange(...parsed.before)} → ${formatPriceRange(...parsed.after)}`;
    }

    return null;
  } catch {
    return null;
  }
}

export default async function EditionPage({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  const detail = await getEditionDetail(slug);

  if (!detail) {
    notFound();
  }

  const { edition, movie, listings, events } = detail;

  // Background refresh of this edition's listings, cached ~1h. Never blocks
  // the render — refreshed prices show up on the next load.
  scheduleEditionRecheck(edition.id);

  const liveListings = listings.filter((l) => !l.removed);
  const cheapest = liveListings
    .filter((l) => l.available && l.price_min_cents !== null)
    .sort((a, b) => (a.price_min_cents ?? 0) - (b.price_min_cents ?? 0))[0];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        <div className="mx-auto w-full max-w-[280px]">
          <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-100 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-800">
            {edition.image_url ? (
              <Image
                src={edition.image_url}
                alt={edition.display_title}
                fill
                sizes="280px"
                priority
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-4xl font-semibold text-zinc-300 dark:text-zinc-600">
                {edition.display_title.slice(0, 2)}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              {edition.catalog_code ? <Badge tone="label">{edition.catalog_code}</Badge> : null}
              {edition.label ? <Badge>{labelName(edition.label)}</Badge> : null}
              {edition.variant ? (
                <Badge>{edition.variant.replaceAll("-", " ")}</Badge>
              ) : null}
              <Badge>{formatDisplay(edition.format)}</Badge>
            </div>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {edition.display_title}
            </h1>

            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {edition.listing_count} listing{edition.listing_count === 1 ? "" : "s"} across{" "}
              {new Set(liveListings.map((l) => l.store_id)).size} store
              {new Set(liveListings.map((l) => l.store_id)).size === 1 ? "" : "s"} · first
              seen {formatDate(edition.first_seen_at)}
              {edition.last_changed_at ? ` · updated ${formatDate(edition.last_changed_at)}` : ""}
            </p>
          </div>

          {cheapest ? (
            <div className=" bg-zinc-50 p-4 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
              <p className="text-xs uppercase tracking-wide text-zinc-400">Cheapest in stock</p>
              <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {formatPriceRange(cheapest.price_min_cents, cheapest.price_max_cents)}
                <span className="ml-2 align-middle text-sm font-normal text-zinc-500 dark:text-zinc-400">
                  at {storeName(cheapest.store_id)}
                </span>
              </p>
              {cheapest.url ? (
                <a
                  href={cheapest.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  View on store ↗
                </a>
              ) : null}
            </div>
          ) : (
            <div className=" bg-zinc-50 p-4 text-sm text-zinc-500 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800">
              No live listing currently in stock.
            </div>
          )}

          {movie ? (
            <div className="flex gap-4 bg-zinc-50 p-4 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
              {movie.poster_path ? (
                <Image
                  src={`${TMDB_IMAGE_BASE}${movie.poster_path}`}
                  alt={movie.title}
                  width={92}
                  height={138}
                />
              ) : null}
              <div className="min-w-0">
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {movie.title}
                  {movie.release_date ? ` (${movie.release_date.slice(0, 4)})` : ""}
                </p>
                {movie.overview ? (
                  <p className="mt-1 line-clamp-4 text-sm text-zinc-500 dark:text-zinc-400">
                    {movie.overview}
                  </p>
                ) : null}
                {movie.match_confidence !== null ? (
                  <p className="mt-2 text-[11px] text-zinc-400">
                    TMDB match confidence {(movie.match_confidence * 100).toFixed(0)}%
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Listings</h2>

        {listings.length === 0 ? (
          <p className="text-sm text-zinc-500">No listings recorded.</p>
        ) : (
          <div className="overflow-x-auto ring-1 ring-zinc-200 dark:ring-zinc-800">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
                  <th className="px-4 py-2.5 font-medium">Store</th>
                  <th className="px-4 py-2.5 font-medium">Price</th>
                  <th className="px-4 py-2.5 font-medium">Stock</th>
                  <th className="px-4 py-2.5 font-medium">Checked</th>
                  <th className="px-4 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {listings.map((listing) => (
                  <tr
                    key={`${listing.store_id}-${listing.product_id}`}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                  >
                    <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200">
                      {listing.store_name}
                      {listing.removed ? (
                        <span className="ml-2 text-xs font-normal text-zinc-400">(delisted)</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {formatPriceRange(listing.price_min_cents, listing.price_max_cents)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={listing.available ? "available" : "sold-out"}>
                        {listing.available ? "In stock" : "Sold out"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      {timeAgo(listing.last_seen_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {listing.url ? (
                        <a
                          href={listing.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                          View ↗
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {events.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            History
          </h2>
          <ol className="flex flex-col gap-2">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-zinc-50 px-4 py-2.5 text-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"
              >
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {eventLabel(event)}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  {storeName(event.store_id)}
                </span>
                {eventDetail(event) ? (
                  <span className="text-zinc-500 dark:text-zinc-400">{eventDetail(event)}</span>
                ) : null}
                <span className="ml-auto text-xs text-zinc-400">
                  {formatDateTime(event.seen_at)}
                  {event.ingest_run_id === null ? (
                    <span className="ml-1.5 text-zinc-300 dark:text-zinc-600">
                      (live recheck)
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </main>
  );
}
