/**
 * Registry of monitored stores. `kind: "scraper"` entries are placeholders for
 * the Kimchi / WeET / FilmArena HTML scrapers that come later — they are
 * skipped by the ingest run until implemented.
 */

export interface StoreDef {
  id: string;
  name: string;
  baseUrl: string;
  kind: "shopify" | "scraper";
  role: "label" | "reseller";
  enabled: boolean;
  note?: string;
}

export const STORES: StoreDef[] = [
  // --- manufacturer-direct (label) stores ---
  {
    id: "manta-lab",
    name: "Manta Lab",
    baseUrl: "https://mantalab.com",
    kind: "shopify",
    role: "label",
    enabled: true,
  },
  {
    id: "plain-archive",
    name: "Plain Archive",
    baseUrl: "https://plainarchive.com",
    kind: "shopify",
    role: "label",
    enabled: true,
  },
  {
    id: "collectong",
    name: "Collectong",
    baseUrl: "https://collectong.com",
    kind: "shopify",
    role: "label",
    enabled: true,
    note: "Manta Lab partner storefront",
  },
  {
    id: "everythingblu",
    name: "EverythingBlu",
    baseUrl: "https://everythingblustore.com",
    kind: "shopify",
    role: "label",
    enabled: false,
    note: "products.json disabled at source; re-enable when feed returns",
  },
  {
    id: "cinemuseum",
    name: "Cinemuseum",
    baseUrl: "https://cinemuseum.com",
    kind: "shopify",
    role: "label",
    enabled: false,
    note: "domain not resolving; mirrored by steelbooklife meanwhile",
  },
  // --- resellers mirroring non-Shopify manufacturers ---
  {
    id: "hidefninja",
    name: "HiDefNinja Shop",
    baseUrl: "https://shop.hidefninja.com",
    kind: "shopify",
    role: "reseller",
    enabled: true,
  },
  {
    id: "bluraylife",
    name: "Blu-ray Life",
    baseUrl: "https://bluraylife.com",
    kind: "shopify",
    role: "reseller",
    enabled: true,
  },
  {
    id: "infinitesteeldealz",
    name: "Infinite Steel Dealz",
    baseUrl: "https://infinitesteeldealz.com",
    kind: "shopify",
    role: "reseller",
    enabled: true,
  },
  {
    id: "steelbookclub",
    name: "SteelBook Club",
    baseUrl: "https://steelbookclub.com",
    kind: "shopify",
    role: "reseller",
    enabled: true,
  },
  {
    id: "steelbooklife",
    name: "Steelbook Life",
    baseUrl: "https://steelbooklife.com",
    kind: "shopify",
    role: "reseller",
    enabled: true,
  },
  {
    id: "themovieroom",
    name: "The Movie Room",
    baseUrl: "https://themovieroom.com",
    kind: "shopify",
    role: "reseller",
    enabled: true,
  },
  {
    id: "steelbooks",
    name: "Steelbooks.com",
    baseUrl: "https://steelbooks.com",
    kind: "shopify",
    role: "reseller",
    enabled: true,
  },
  // --- HTML scrapers, later ---
  {
    id: "kimchi",
    name: "Kimchi DVD",
    baseUrl: "https://kimchidvd.com",
    kind: "scraper",
    role: "label",
    enabled: false,
    note: "HTML scraper not yet implemented",
  },
  {
    id: "weet",
    name: "WeET Collection",
    baseUrl: "https://weetcollection.com",
    kind: "scraper",
    role: "label",
    enabled: false,
    note: "HTML scraper not yet implemented",
  },
  {
    id: "filmarena",
    name: "FilmArena",
    baseUrl: "https://filmarena.org",
    kind: "scraper",
    role: "label",
    enabled: false,
    note: "HTML scraper not yet implemented",
  },
];

export function storeDef(id: string): StoreDef | undefined {
  return STORES.find((s) => s.id === id);
}
