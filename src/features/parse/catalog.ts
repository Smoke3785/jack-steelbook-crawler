/**
 * Catalog number extraction, e.g. "[ME#95] ..." -> ME#95, "FAC #55", "BF#210".
 * Prefixes are data-driven so new schemes are a one-line addition.
 */

export interface CatalogMatch {
  /** Canonical form, e.g. "ME#95". */
  code: string;
  prefix: string;
  number: number;
  /** Label slug implied by the prefix, when known. */
  labelSlug: string | null;
}

const CATALOG_PREFIXES: Record<string, string | null> = {
  ME: "manta-lab",
  MBL: "manta-lab",
  FAC: "filmarena",
  FA: "filmarena",
  BF: "blufans",
  BE: null,
  KD: "kimchi",
  HDZ: "hdzeta",
  PA: "plain-archive",
  NOVA: "nova-media",
  WEET: "weet-collection",
  EE: "eternal-empire",
};

const PREFIX_ALTERNATION = Object.keys(CATALOG_PREFIXES)
  .sort((a, b) => b.length - a.length)
  .join("|");

const CATALOG_RE = new RegExp(
  `\\b(${PREFIX_ALTERNATION})\\s*#\\s*(\\d{1,4})\\b|\\b(${PREFIX_ALTERNATION})\\s*#?(\\d{2,4})\\b`,
  "i",
);

function toMatch(prefix: string, number: number): CatalogMatch {
  const canonicalPrefix = prefix.toUpperCase();

  return {
    code: `${canonicalPrefix}#${number}`,
    prefix: canonicalPrefix,
    number,
    labelSlug: CATALOG_PREFIXES[canonicalPrefix] ?? null,
  };
}

/**
 * Extracts the most meaningful catalog number from text. Matches with a "#"
 * separator are preferred (ME#95, FAC #55) over bare forms (BF210), and
 * prefixes that map to a known label win over ambiguous ones.
 */
export function extractCatalog(text: string): CatalogMatch | null {
  const matches: CatalogMatch[] = [];
  const re = new RegExp(CATALOG_RE.source, "gi");
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m[1] !== undefined) {
      matches.push(toMatch(m[1], Number(m[2])));
    } else {
      matches.push(toMatch(m[3], Number(m[4])));
    }
  }

  if (matches.length === 0) {
    return null;
  }

  const knownLabel = matches.filter((mm) => mm.labelSlug !== null);

  if (knownLabel.length > 0) {
    return knownLabel[0];
  }

  return matches[0];
}
