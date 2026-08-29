/**
 * Single source of truth for browse-page filter state <-> URL search params.
 * Everything on the listings page is URL-managed so any view is shareable.
 */

export const SORT_KEYS = ["newest", "price-asc", "price-desc", "title"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const AVAILABILITY_VALUES = ["any", "available", "sold-out"] as const;
export type AvailabilityFilter = (typeof AVAILABILITY_VALUES)[number];

export const STATUS_VALUES = ["all", "new"] as const;
export type StatusFilter = (typeof STATUS_VALUES)[number];

export const VIEW_VALUES = ["grid", "list"] as const;
export type ViewFilter = (typeof VIEW_VALUES)[number];

export interface ListingFilters {
  q: string;
  store: string;
  label: string;
  variant: string;
  format: string;
  availability: AvailabilityFilter;
  status: StatusFilter;
  sort: SortKey;
  view: ViewFilter;
  page: number;
}

export const DEFAULT_FILTERS: ListingFilters = {
  q: "",
  store: "",
  label: "",
  variant: "",
  format: "",
  availability: "any",
  status: "all",
  sort: "newest",
  view: "grid",
  page: 1,
};

export const PAGE_SIZE = 24;

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export function parseFilters(params: RawParams): ListingFilters {
  const sort = first(params.sort) as SortKey;
  const availability = first(params.availability) as AvailabilityFilter;
  const status = first(params.status) as StatusFilter;
  const view = first(params.view) as ViewFilter;
  const page = Number.parseInt(first(params.page) || "1", 10);

  return {
    q: first(params.q).trim().slice(0, 120),
    store: first(params.store).trim(),
    label: first(params.label).trim(),
    variant: first(params.variant).trim(),
    format: first(params.format).trim(),
    availability: AVAILABILITY_VALUES.includes(availability) ? availability : "any",
    status: STATUS_VALUES.includes(status) ? status : "all",
    sort: SORT_KEYS.includes(sort) ? sort : "newest",
    view: VIEW_VALUES.includes(view) ? view : "grid",
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 500) : 1,
  };
}

/** Serializes filters, dropping defaults so shared URLs stay minimal. */
export function filtersToSearchParams(filters: ListingFilters): URLSearchParams {
  const sp = new URLSearchParams();

  const add = (key: string, value: string) => {
    if (value) {
      sp.set(key, value);
    }
  };

  add("q", filters.q);
  add("store", filters.store);
  add("label", filters.label);
  add("variant", filters.variant);
  add("format", filters.format);

  if (filters.availability !== "any") {
    sp.set("availability", filters.availability);
  }

  if (filters.status !== "all") {
    sp.set("status", filters.status);
  }

  if (filters.sort !== "newest") {
    sp.set("sort", filters.sort);
  }

  if (filters.view !== "grid") {
    sp.set("view", filters.view);
  }

  if (filters.page > 1) {
    sp.set("page", String(filters.page));
  }

  return sp;
}

/**
 * Builds a shareable href from a partial update. Changing any filter (except
 * the page itself or the view toggle) resets pagination, since result counts
 * shift.
 */
export function browseHref(
  patch: Partial<ListingFilters>,
  current: ListingFilters = DEFAULT_FILTERS,
): string {
  const resetsPage = Object.keys(patch).some((k) => k !== "page" && k !== "view");
  const merged: ListingFilters = {
    ...current,
    ...patch,
    page: resetsPage ? 1 : (patch.page ?? current.page),
  };

  const qs = filtersToSearchParams(merged).toString();

  return qs ? `/?${qs}` : "/";
}
