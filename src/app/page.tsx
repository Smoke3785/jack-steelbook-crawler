import { parseFilters } from "@/features/listings/filters";
import { queryBrowse } from "@/features/listings/queries";
import { EditionCard } from "@/features/listings/ui/edition-card";
import { EditionRow } from "@/features/listings/ui/edition-row";
import { FilterBar } from "@/features/listings/ui/filter-bar";
import { Pagination } from "@/features/listings/ui/pagination";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const result = await queryBrowse(filters);

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <FilterBar filters={filters} facets={result.facets} />

      <div className="mt-4 mb-3 flex items-baseline justify-between">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {result.total.toLocaleString()} edition{result.total === 1 ? "" : "s"}
          {result.total > 0 ? (
            <>
              {" · "}
              page {result.page} of {result.pageCount}
            </>
          ) : null}
        </p>
      </div>

      {result.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {result.total === 0 && !filters.q
              ? "No editions indexed yet — run `npm run ingest` to pull the store feeds."
              : "No editions match these filters."}
          </p>
        </div>
      ) : filters.view === "list" ? (
        <div className="flex flex-col gap-2">
          {result.items.map((edition) => (
            <EditionRow key={edition.id} edition={edition} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {result.items.map((edition) => (
            <EditionCard key={edition.id} edition={edition} />
          ))}
        </div>
      )}

      <div className="mt-6">
        <Pagination filters={filters} pageCount={result.pageCount} />
      </div>
    </main>
  );
}
