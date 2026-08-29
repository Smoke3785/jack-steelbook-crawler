"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AVAILABILITY_VALUES,
  STATUS_VALUES,
  SORT_KEYS,
  VIEW_VALUES,
  browseHref,
  type ListingFilters,
  type SortKey,
  type AvailabilityFilter,
  type StatusFilter,
  type ViewFilter,
} from "../filters";
import { storeName } from "@/shared/ui/store-badge";
import { formatDisplay } from "@/features/parse/format";
import type { BrowseFacets } from "../queries";

const SELECT_CLASS =
  "h-9 rounded-lg border-0 bg-zinc-100 px-2.5 text-sm text-zinc-800 outline-none ring-1 ring-inset ring-zinc-200 focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700 dark:focus:ring-zinc-500";

interface FilterBarProps {
  filters: ListingFilters;
  facets: BrowseFacets;
}

export function FilterBar({ filters, facets }: FilterBarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState(filters.q);
  const [syncedQ, setSyncedQ] = useState(filters.q);

  // Keep the local input in sync when navigation changes the URL
  // (back/forward, clear button) — adjust during render, not in an effect.
  if (syncedQ !== filters.q) {
    setSyncedQ(filters.q);
    setQ(filters.q);
  }

  const navigate = (patch: Partial<ListingFilters>) => {
    startTransition(() => {
      router.replace(browseHref(patch, filters), { scroll: false });
    });
  };

  /** Search commits on Enter only — typing never touches the URL. */
  const submitQ = () => {
    if (q !== filters.q) {
      navigate({ q });
    }
  };

  const hasActiveFilters =
    filters.q !== "" ||
    filters.store !== "" ||
    filters.label !== "" ||
    filters.variant !== "" ||
    filters.format !== "" ||
    filters.availability !== "any" ||
    filters.status !== "all" ||
    filters.sort !== "newest";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="h-9 w-full min-w-52 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            submitQ();
          }}
        >
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, catalog no., movie — press Enter"
            className="h-9 w-full rounded-lg bg-zinc-100 px-3 text-sm text-zinc-800 placeholder:text-zinc-400 outline-none ring-1 ring-inset ring-zinc-200 focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700 dark:focus:ring-zinc-500"
          />
        </form>

        <select
          aria-label="Store"
          value={filters.store}
          onChange={(e) => navigate({ store: e.target.value })}
          className={SELECT_CLASS}
        >
          <option value="">All stores</option>
          {facets.stores.map((s) => (
            <option key={s.id} value={s.id}>
              {storeName(s.id)} ({s.count})
            </option>
          ))}
        </select>

        <select
          aria-label="Label"
          value={filters.label}
          onChange={(e) => navigate({ label: e.target.value })}
          className={SELECT_CLASS}
        >
          <option value="">All labels</option>
          {facets.labels.map((l) => (
            <option key={l.value} value={l.value}>
              {l.value === "retail" ? "Retail / other" : l.value.replaceAll("-", " ")} ({l.count})
            </option>
          ))}
        </select>

        <select
          aria-label="Variant"
          value={filters.variant}
          onChange={(e) => navigate({ variant: e.target.value })}
          className={SELECT_CLASS}
        >
          <option value="">All variants</option>
          {facets.variants.map((v) => (
            <option key={v.value} value={v.value}>
              {v.value.replaceAll("-", " ")} ({v.count})
            </option>
          ))}
        </select>

        <select
          aria-label="Format"
          value={filters.format}
          onChange={(e) => navigate({ format: e.target.value })}
          className={SELECT_CLASS}
        >
          <option value="">All formats</option>
          {facets.formats.map((f) => (
            <option key={f.value} value={f.value}>
              {formatDisplay(f.value)} ({f.count})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Availability"
          value={filters.availability}
          onChange={(e) => navigate({ availability: e.target.value as AvailabilityFilter })}
          className={SELECT_CLASS}
        >
          {AVAILABILITY_VALUES.map((a) => (
            <option key={a} value={a}>
              {a === "any" ? "Any availability" : a === "available" ? "In stock" : "Sold out"}
            </option>
          ))}
        </select>

        <select
          aria-label="Status"
          value={filters.status}
          onChange={(e) => navigate({ status: e.target.value as StatusFilter })}
          className={SELECT_CLASS}
        >
          {STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All releases" : "New (14 days)"}
            </option>
          ))}
        </select>

        <select
          aria-label="Sort"
          value={filters.sort}
          onChange={(e) => navigate({ sort: e.target.value as SortKey })}
          className={SELECT_CLASS}
        >
          {SORT_KEYS.map((s) => (
            <option key={s} value={s}>
              Sort: {sortLabel(s)}
            </option>
          ))}
        </select>

        <div
          role="group"
          aria-label="View"
          className="flex h-9 items-center rounded-lg ring-1 ring-inset ring-zinc-200 dark:ring-zinc-700"
        >
          {VIEW_VALUES.map((view, idx) => {
            const isActive = filters.view === view;

            return (
              <button
                key={view}
                type="button"
                aria-pressed={isActive}
                title={view === "grid" ? "Grid view" : "List view"}
                onClick={() => navigate({ view: view as ViewFilter })}
                className={`flex h-9 w-9 items-center justify-center ${
                  idx > 0 ? "border-l border-zinc-200 dark:border-zinc-700" : ""
                } ${
                  isActive
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                {view === "grid" ? <GridIcon /> : <ListIcon />}
              </button>
            );
          })}
        </div>

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={() =>
              startTransition(() => {
                router.replace("/", { scroll: false });
              })
            }
            className="ml-auto h-9 rounded-lg px-3 text-sm font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-100 dark:text-zinc-300 dark:ring-zinc-700 dark:hover:bg-zinc-800"
          >
            Clear filters
          </button>
        ) : null}

        {isPending ? (
          <span className="text-xs text-zinc-400">Updating…</span>
        ) : null}
      </div>
    </div>
  );
}

function sortLabel(sort: SortKey): string {
  switch (sort) {
    case "price-asc":
      return "Price ↑";
    case "price-desc":
      return "Price ↓";
    case "title":
      return "Title A–Z";
    default:
      return "Newest";
  }
}

function GridIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <rect x="1" y="1" width="5" height="5" rx="1" />
      <rect x="8" y="1" width="5" height="5" rx="1" />
      <rect x="1" y="8" width="5" height="5" rx="1" />
      <rect x="8" y="8" width="5" height="5" rx="1" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <rect x="1" y="2" width="12" height="2" rx="1" />
      <rect x="1" y="6" width="12" height="2" rx="1" />
      <rect x="1" y="10" width="12" height="2" rx="1" />
    </svg>
  );
}
