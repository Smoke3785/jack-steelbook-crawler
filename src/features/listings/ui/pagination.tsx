import Link from "next/link";
import { browseHref, type ListingFilters } from "../filters";

function pageWindow(current: number, pageCount: number): (number | "gap")[] {
  const pages = new Set<number>([
    1,
    pageCount,
    current,
    current - 1,
    current + 1,
  ]);

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
  pageCount,
  filters,
}: {
  filters: ListingFilters;
  pageCount: number;
}) {
  if (pageCount <= 1) {
    return null;
  }

  return (
    <section className="mt-0 border-t-0 border-zinc-800 mx-auto w-full max-w-7xl px-[16px] sm:px-[24px]">
      <nav
        className="flex flex-wrap items-center justify-center gap-2 py-[12px] border-x border-zinc-800 sm:px-[12px] border-t"
        aria-label="Pagination"
      >
        {filters.page > 1 ? (
          <Link
            className="h-9 border border-zinc-700 px-3 text-sm leading-8 text-zinc-300 hover:bg-zinc-800"
            href={browseHref({ page: filters.page - 1 }, filters)}
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
              className={`h-9 min-w-9 border px-2.5 text-center text-sm leading-8 ${isCurrent ? "border-transparent bg-zinc-100 text-zinc-900" : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"}`}
            >
              {entry}
            </Link>
          );
        })}

        {filters.page < pageCount ? (
          <Link
            href={browseHref({ page: filters.page + 1 }, filters)}
            className="h-9 border border-zinc-700 px-3 text-sm leading-8 text-zinc-300 hover:bg-zinc-800"
          >
            Next →
          </Link>
        ) : null}
      </nav>
    </section>
  );
}
