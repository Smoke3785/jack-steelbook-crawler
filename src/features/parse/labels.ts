/**
 * Premium label detection. Labels are identified by alias tokens appearing in
 * the vendor field or the title — store vendors like PARAMOUNT (Collectong) or
 * shop names (Steelbooks.com) are deliberately not labels.
 */

export interface LabelDef {
  slug: string;
  name: string;
  aliases: string[];
}

export const LABELS: LabelDef[] = [
  {
    slug: "manta-lab",
    name: "Manta Lab",
    aliases: ["manta lab exclusive", "manta labs", "manta lab", "manta"],
  },
  {
    slug: "plain-archive",
    name: "Plain Archive",
    aliases: ["plain archive", "plainarchive"],
  },
  { slug: "blufans", name: "BluFans", aliases: ["blufans", "blu fans"] },
  {
    slug: "filmarena",
    name: "FilmArena",
    aliases: ["filmarena", "film arena"],
  },
  { slug: "kimchi", name: "Kimchi DVD", aliases: ["kimchi dvd", "kimchi"] },
  {
    slug: "weet-collection",
    name: "WeET Collection",
    aliases: ["weet collection", "weet"],
  },
  { slug: "hdzeta", name: "HDZeta", aliases: ["hdzeta", "hd zeta"] },
  { slug: "nova-media", name: "Nova Media", aliases: ["nova media", "nova"] },
  { slug: "cinemuseum", name: "Cinemuseum", aliases: ["cinemuseum"] },
  {
    slug: "everythingblu",
    name: "EverythingBlu",
    aliases: ["everythingblu", "everything blu"],
  },
  {
    slug: "eternal-empire",
    name: "Eternal Empire",
    aliases: ["eternal empire"],
  },
  { slug: "teleport", name: "Teleport", aliases: ["teleport"] },
];

const ALIAS_LOOKUP: Map<string, string> = (() => {
  const map = new Map<string, string>();

  for (const label of LABELS) {
    for (const alias of label.aliases) {
      map.set(alias, label.slug);
    }
  }

  return map;
})();

/** Longest aliases first so "manta lab" wins over "manta". */
const ALIASES_BY_LENGTH = [...ALIAS_LOOKUP.keys()].sort(
  (a, b) => b.length - a.length,
);

export function labelName(slug: string): string {
  return LABELS.find((l) => l.slug === slug)?.name ?? slug;
}

/** Finds a known label slug inside an arbitrary blob of text. */
export function findLabelInText(text: string): string | null {
  const haystack = text.toLowerCase();
  const escaped = ALIASES_BY_LENGTH.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  for (let i = 0; i < escaped.length; i++) {
    const aliasRegex = new RegExp(`(?:^|[^a-z0-9])${escaped[i]}(?:[^a-z0-9]|$)`);

    if (aliasRegex.test(haystack)) {
      return ALIAS_LOOKUP.get(ALIASES_BY_LENGTH[i]) ?? null;
    }
  }

  return null;
}
