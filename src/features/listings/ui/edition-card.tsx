import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/shared/ui/badge";
import { StockBadge } from "@/shared/ui/stock-badge";
import { storeNames } from "@/shared/lib/stores";
import { formatDate, formatPriceRange } from "@/shared/lib/format";
import { labelName } from "@/features/parse/labels";
import { formatDisplay } from "@/features/parse/format";
import type { BrowseItem } from "../queries";

const NEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function isNew(firstSeenAt: string): boolean {
  return (
    Date.now() - new Date(`${firstSeenAt.replace(" ", "T")}Z`).getTime() <
    NEW_WINDOW_MS
  );
}

export function EditionCard({ edition }: { edition: BrowseItem }) {
  return (
    <Link
      href={`/editions/${edition.slug}`}
      className="group flex flex-col border-b border-r border-zinc-200 p-[6px] transition-shadow hover:shadow-md dark:border-zinc-800"
    >
      {/* Background block sits on an inner container so the card's 6px mat
          shows the page background between border and content. */}
      <div className="flex flex-1 flex-col bg-white  dark:bg-zinc-900">
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
          {edition.image_url ? (
            <Image
              src={edition.image_url}
              alt={edition.display_title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              className="object-cover transition-transform group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-3xl font-semibold text-zinc-300 dark:text-zinc-600">
              {edition.display_title.slice(0, 2)}
            </div>
          )}

          <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
            {isNew(edition.first_seen_at) ? (
              <Badge tone="new">New</Badge>
            ) : null}
            {edition.catalog_code ? (
              <Badge tone="label">{edition.catalog_code}</Badge>
            ) : null}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2 pt-2">
          <div>
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
              {edition.display_title}
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {[
                edition.label ? labelName(edition.label) : null,
                edition.movie_year,
              ]
                .filter(Boolean)
                .join(" · ") || formatDisplay(edition.format)}
            </p>
          </div>

          <div className="mt-auto flex flex-col gap-2">
            <div className="flex flex-wrap gap-1">
              {edition.variant ? (
                <Badge>{edition.variant.replaceAll("-", " ")}</Badge>
              ) : null}
              {edition.format ? (
                <Badge>{formatDisplay(edition.format)}</Badge>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {formatPriceRange(
                  edition.price_min_cents,
                  edition.price_max_cents,
                )}
              </span>
              <StockBadge
                state={edition.stock_state}
                inStock={edition.available_count}
                total={edition.listing_count}
              />
            </div>

            <p
              className="truncate text-[11px] text-zinc-400"
              title={storeNames(edition.store_ids)}
            >
              {storeNames(edition.store_ids)}
            </p>

            <p className="text-[11px] text-zinc-400">
              First seen {formatDate(edition.first_seen_at)}
              {edition.last_changed_at
                ? ` · Updated ${formatDate(edition.last_changed_at)}`
                : ""}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
