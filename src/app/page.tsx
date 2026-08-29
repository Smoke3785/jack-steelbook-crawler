// Components
import { EditionCard } from "@/features/listings/ui/edition-card";
import { EditionRow } from "@/features/listings/ui/edition-row";
import { Pagination } from "@/features/listings/ui/pagination";
import { FilterBar } from "@/features/listings/ui/filter-bar";
import {
  JackCrawfordCard,
  JackCrawfordRow,
} from "@/features/listings/ui/jack-crawford";

// Utils
import { matchesJackCrawfordQuery } from "@/features/listings/ui/jack-crawford";
import { parseFilters } from "@/features/listings/filters";
import { queryBrowse } from "@/features/listings/queries";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const filters = parseFilters(params);

  const result = await queryBrowse(filters);
  const showJack = matchesJackCrawfordQuery(filters.q);

  const resultsLength = result.items.length + Number(showJack);

  const editionsString = (() => {
    let base = `${result.total.toLocaleString()} edition`;

    if (result.total > 1) {
      base += "s";
      base += " · ";
      base += `page ${result.page} of ${result.pageCount}`;
    }

    return base;
  })();

  return (
    <>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6">
        <FilterBar filters={filters} facets={result.facets} />

        <div className="py-4 border border-y-0 border-zinc-800 px-[18px] pb-[12px] pt-[6px] flex items-baseline justify-between">
          <p className="text-sm  text-zinc-500 dark:text-zinc-400">
            {editionsString}
          </p>
        </div>

        {resultsLength === 0 && (
          <div className="border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {result.total === 0 && !filters.q
                ? "No editions indexed yet — run `npm run ingest` to pull the store feeds."
                : "No editions match these filters."}
            </p>
          </div>
        )}

        {filters.view === "list" && (
          <div className="flex flex-col border-l border-t border-zinc-200 dark:border-zinc-800">
            {showJack && <JackCrawfordRow />}
            {result.items.map((edition) => (
              <EditionRow key={edition.id} edition={edition} />
            ))}
          </div>
        )}

        {filters.view === "grid" && (
          <div className="grid grid-cols-2 border-l border-t border-zinc-200 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 dark:border-zinc-800">
            {showJack && <JackCrawfordCard />}
            {result.items.map((edition) => (
              <EditionCard key={edition.id} edition={edition} />
            ))}
          </div>
        )}
      </main>

      <Pagination filters={filters} pageCount={result.pageCount} />
    </>
  );
}
