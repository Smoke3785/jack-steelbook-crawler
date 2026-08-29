/**
 * Variant (packaging) detection: fullslip / lenti / quarter / one-click /
 * Type A-B / OAB etc. Components are found independently and composed into a
 * canonical slug, e.g. "Double Lenticular Full Slip-B" ->
 * "double-lenticular-full-slip-b".
 */

export interface VariantMatch {
  /** Canonical composed slug, e.g. "one-click-double-lenticular". */
  slug: string;
  /** Human-readable form for chips, e.g. "One-Click · Double Lenticular · B". */
  display: string;
}

const VARIANT_COMPONENTS: { slug: string; display: string; pattern: RegExp }[] = [
  {
    slug: "one-click",
    display: "One-Click",
    pattern: /\b(?:one[\s-]?click|1[\s-]?click|oab)\b/i,
  },
  {
    slug: "double-lenticular",
    display: "Double Lenticular",
    pattern: /\b(?:double[\s-]?lenticular|dbl[\s-]?lenticular|double[\s-]?lenti)\b/i,
  },
  {
    slug: "lenticular",
    display: "Lenticular",
    pattern: /\b(?:lenticular|lenti)\b/i,
  },
  {
    slug: "full-slip",
    display: "Full Slip",
    pattern: /\bfull[\s-]?slip\b/i,
  },
  {
    slug: "quarter-slip",
    display: "Quarter Slip",
    pattern: /\bquarter[\s-]?slip\b/i,
  },
  {
    slug: "half-slip",
    display: "Half Slip",
    pattern: /\bhalf[\s-]?slip\b/i,
  },
  {
    slug: "slipcover",
    display: "Slipcover",
    pattern: /\bslip[\s-]?cover\b/i,
  },
  {
    slug: "box-set",
    display: "Box Set",
    pattern: /\bbox[\s-]?set\b/i,
  },
  {
    slug: "wea",
    display: "WEA",
    pattern: /\bwea\b/i,
  },
  {
    slug: "wwa",
    display: "WWA",
    pattern: /\bwwa\b/i,
  },
];

/** Type/cover letters: "Full Slip-B", "Cover A", "Type A", "Ver. C", "- A". */
const TYPE_LETTER_RE =
  /\b(?:type|version|ver|cover)[\s.]*(a|b|c|d)\b|(?:full[\s-]?slip|lenticular|lenti|quarter[\s-]?slip|one[\s-]?click|1[\s-]?click)[\s-]*(a|b|c|d)\b/i;

export function extractVariant(text: string): VariantMatch | null {
  const found = VARIANT_COMPONENTS.filter((c) => c.pattern.test(text));

  // A one-click is a one-click: it bundles every slip, so qualifiers like
  // "box set" or "(Double Lenticular)" must not split it into new editions.
  if (found.some((c) => c.slug === "one-click")) {
    return { slug: "one-click", display: "One-Click" };
  }

  // "double lenticular" supersedes plain "lenticular" if both somehow match.
  const hasDouble = found.some((c) => c.slug === "double-lenticular");
  const components = hasDouble ? found.filter((c) => c.slug !== "lenticular") : found;

  const typeMatch = TYPE_LETTER_RE.exec(text);
  const typeLetter = typeMatch ? typeMatch[1] ?? typeMatch[2] : null;

  if (components.length === 0 && !typeLetter) {
    return null;
  }

  const displayParts = components.map((c) => c.display);

  if (typeLetter) {
    displayParts.push(typeLetter.toUpperCase());
  }

  const slugParts = components.map((c) => c.slug);

  if (typeLetter) {
    slugParts.push(typeLetter.toLowerCase());
  }

  return {
    slug: slugParts.join("-"),
    display: displayParts.join(" · "),
  };
}
