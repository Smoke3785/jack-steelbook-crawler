import Link from "next/link";
import { browseHref, type ListingFilters } from "../filters";

function pageWindow(current: number, pageCount: number): (number | "gap")[] {
  const pages = new Set<number>([1, pageCount, current, current - 1, current + 1]);

  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= pageCount)
    .sort((a, b) => a - b);

  const out: (number | "gap")[] = [];

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      out.push("gap");
    }

    out.push(sorted[i]);
  }

  return out;
}

export function Pagination({
  filters,
  pageCount,
}: {
  filters: ListingFilters;
  pageCount: number;
}) {
  if (pageCount <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-center gap-1.5"
    >
      {filters.page > 1 ? (
        <Link
          href={browseHref({ page: filters.page - 1 }, filters)}
          className="h-9 px-3 text-sm leading-9 text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-100 dark:text-zinc-300 dark:ring-zinc-700 dark:hover:bg-zinc-800"
        >
          ← Prev
        </Link>
      ) : null}

      {pageWindow(filters.page, pageCount).map((entry, idx) => {
        if (entry === "gap") {
          return (
            <span key={`gap-${idx}`} className="px-1 text-zinc-400">
              …
            </span>
          );
        }

        const isCurrent = entry === filters.page;

        return (
          <Link
            key={entry}
            href={browseHref({ page: entry }, filters)}
            aria-current={isCurrent ? "page" : undefined}
            className={`h-9 min-w-9 px-2.5 text-center text-sm leading-9 ring-1 ring-inset ${
              isCurrent
                ? "bg-zinc-900 text-white ring-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:ring-zinc-100"
                : "text-zinc-600 ring-zinc-200 hover:bg-zinc-100 dark:text-zinc-300 dark:ring-zinc-700 dark:hover:bg-zinc-800"
            }`}
          >
            {entry}
          </Link>
        );
      })}

      {filters.page < pageCount ? (
        <Link
          href={browseHref({ page: filters.page + 1 }, filters)}
          className="h-9 px-3 text-sm leading-9 text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-100 dark:text-zinc-300 dark:ring-zinc-700 dark:hover:bg-zinc-800"
        >
          Next →
        </Link>
      ) : null}
    </nav>
  );
}
