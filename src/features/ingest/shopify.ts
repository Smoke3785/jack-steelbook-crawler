/**
 * Shopify /products.json feed client. Handles pagination, retries, and
 * per-store timeouts; throws FeedError so one broken store never kills a run.
 */

export interface ShopifyVariant {
  id: number;
  title: string;
  price: string;
  compare_at_price: string | null;
  available: boolean;
  sku: string | null;
}

export interface ShopifyImage {
  src: string;
  position: number;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  vendor: string | null;
  product_type: string | null;
  tags: string[] | string;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  body_html: string | null;
  variants: ShopifyVariant[];
  images: ShopifyImage[];
}

export class FeedError extends Error {
  constructor(
    message: string,
    readonly storeId: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "FeedError";
  }
}

const USER_AGENT =
  "jack-steelbook-crawler/0.1 (+release tracker; contact via repo)";

const REQUEST_TIMEOUT_MS = 30_000;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(
  storeId: string,
  url: string,
  attempt = 0,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT, accept: "application/json" },
      cache: "no-store",
    });

    if (RETRYABLE_STATUS.has(res.status) && attempt < MAX_RETRIES) {
      await sleep(1500 * (attempt + 1));
      return fetchJson(storeId, url, attempt + 1);
    }

    if (!res.ok) {
      throw new FeedError(`GET ${url} -> HTTP ${res.status}`, storeId, res.status);
    }

    return (await res.json()) as unknown;
  } catch (err) {
    if (err instanceof FeedError) {
      throw err;
    }

    if (attempt < MAX_RETRIES) {
      await sleep(1500 * (attempt + 1));
      return fetchJson(storeId, url, attempt + 1);
    }

    throw new FeedError(`GET ${url} failed: ${(err as Error).message}`, storeId);
  } finally {
    clearTimeout(timer);
  }
}

function parseFeed(payload: unknown, storeId: string): ShopifyProduct[] {
  if (typeof payload !== "object" || payload === null) {
    throw new FeedError("feed payload is not an object", storeId);
  }

  const products = (payload as { products?: unknown }).products;

  if (!Array.isArray(products)) {
    throw new FeedError("feed payload has no products array", storeId);
  }

  return products as ShopifyProduct[];
}

/** Fetches every product from a store's paginated products.json feed. */
export async function fetchAllProducts(
  storeId: string,
  baseUrl: string,
  maxPages = 20,
): Promise<ShopifyProduct[]> {
  const all: ShopifyProduct[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const url = `${baseUrl}/products.json?limit=250&page=${page}`;
    const products = parseFeed(await fetchJson(storeId, url), storeId);

    all.push(...products);

    if (products.length < 250) {
      break;
    }

    await sleep(300); // be polite between pages
  }

  return all;
}

/** Fetches one product by handle — used by the edition page recheck. */
export async function fetchProductByHandle(
  storeId: string,
  baseUrl: string,
  handle: string,
): Promise<ShopifyProduct | null> {
  const url = `${baseUrl}/products/${encodeURIComponent(handle)}.json`;
  const payload = await fetchJson(storeId, url);

  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const product = (payload as { product?: unknown }).product;
  return product ? (product as ShopifyProduct) : null;
}
