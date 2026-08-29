/** Display names for store ids, matching the registry in features/ingest/stores.ts. */

const STORE_NAMES: Record<string, string> = {
  "manta-lab": "Manta Lab",
  "plain-archive": "Plain Archive",
  collectong: "Collectong",
  everythingblu: "EverythingBlu",
  cinemuseum: "Cinemuseum",
  hidefninja: "HiDefNinja",
  bluraylife: "Blu-ray Life",
  infinitesteeldealz: "Infinite Steel",
  steelbookclub: "SteelBook Club",
  steelbooklife: "Steelbook Life",
  themovieroom: "Movie Room",
  steelbooks: "Steelbooks.com",
  kimchi: "Kimchi DVD",
  weet: "WeET",
  filmarena: "FilmArena",
};

export function storeName(storeId: string): string {
  return STORE_NAMES[storeId] ?? storeId;
}

export function storeNames(storeIds: string[]): string {
  return storeIds.map(storeName).join(" · ");
}
