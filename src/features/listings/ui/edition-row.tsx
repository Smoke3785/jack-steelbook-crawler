import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/shared/ui/badge";
import { storeNames } from "@/shared/lib/stores";
import { formatDate, formatPriceRange } from "@/shared/lib/format";
import { labelName } from "@/features/parse/labels";
import { formatDisplay } from "@/features/parse/format";
import type { BrowseItem } from "../queries";

const NEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function isNew(firstSeenAt: string): boolean {
  return Date.now() - new Date(`${firstSeenAt.replace(" ", "T")}Z`).getTime() < NEW_WINDOW_MS;
}

/** Compact one-line-per-edition row for the list view. */
export function EditionRow({ edition }: { edition: BrowseItem }) {
  const anyAvailable = edition.available_count > 0;

  return (
    <Link
      href={`/${edition.slug}`}
      className="flex items-center gap-3 rounded-xl bg-white p-2.5 ring-1 ring-zinc-200 transition-shadow hover:shadow-md dark:bg-zinc-900 dark:ring-zinc-800"
    >
      <div className="relative h-[72px] w-12 shrink-0 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800">
        {edition.image_url ? (
          <Image
            src={edition.image_url}
            alt={edition.display_title}
            fill
            sizes="48px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs font-semibold text-zinc-300 dark:text-zinc-600">
            {edition.display_title.slice(0, 2)}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {edition.display_title}
          </span>
          {edition.catalog_code ? (
            <span className="shrink-0 text-xs font-medium text-blue-600 dark:text-blue-400">
              {edition.catalog_code}
            </span>
          ) : null}
          {isNew(edition.first_seen_at) ? <Badge tone="new">New</Badge> : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          {edition.label ? <span>{labelName(edition.label)}</span> : null}
          {edition.variant ? <span>{edition.variant.replaceAll("-", " ")}</span> : null}
          <span>{formatDisplay(edition.format)}</span>
          {edition.movie_year ? <span>({edition.movie_year})</span> : null}
          <span className="hidden sm:inline">· seen {formatDate(edition.first_seen_at)}</span>
        </div>
      </div>

      <div className="hidden shrink-0 flex-wrap justify-end gap-1 md:flex">
        {edition.store_ids.slice(0, 3).map((storeId) => (
          <StoreBadge key={storeId} storeId={storeId} />
        ))}
        {edition.store_ids.length > 3 ? (
          <span className="text-[11px] text-zinc-400">+{edition.store_ids.length - 3}</span>
        ) : null}
      </div>

      <div className="flex w-24 shrink-0 flex-col items-end gap-1">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {formatPriceRange(edition.price_min_cents, edition.price_max_cents)}
        </span>
        <Badge tone={anyAvailable ? "available" : "sold-out"}>
          {anyAvailable ? `${edition.available_count}/${edition.listing_count}` : "Sold out"}
        </Badge>
      </div>
    </Link>
  );
}
