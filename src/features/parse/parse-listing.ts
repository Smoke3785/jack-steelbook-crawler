import { slugify } from "@/shared/lib/slug";
import { extractCatalog } from "./catalog";
import { extractFormat } from "./format";
import { findLabelInText, LABELS } from "./labels";
import { extractVariant } from "./variants";

export interface ParseInput {
  title: string;
  vendor: string | null;
  productType?: string | null;
}

export interface ParseResult {
  labelSlug: string | null;
  catalogCode: string | null;
  variantSlug: string | null;
  variantDisplay: string | null;
  format: string | null;
  cleanedTitle: string;
  /** Best query string for TMDB search (AKA-left branch, possessives dropped). */
  searchQuery: string;
  yearHint: number | null;
  /** Retained parenthetical like "best buy exclusive" / "warner bros. uk". */
  editionNote: string | null;
  /** Stable grouping key, e.g. "manta-lab:ME#95:full-slip-a". */
  editionKey: string;
}

/**
 * Parenthetical/bracket noise that is never an edition note and never title.
 * Exact-match inside a bracket group, e.g. "(Copy)", "[PREORDER]".
 */
const BRACKET_NOISE = new Set([
  "copy",
  "preorder",
  "pre order",
  "pre-order",
  "region free",
  "region a",
  "region b",
  "region c",
  "region locked",
  "new",
  "sealed",
  "restock",
  "back in stock",
  "sold out",
  "oos",
  "collectong",
]);

/** Whole-word tokens dropped from the title regardless of position. */
const TITLE_STOP_TOKENS = [
  "steelbook",
  "steel book",
  "steel-case",
  "4k",
  "uhd",
  "ultra hd",
  "blu-ray",
  "bluray",
  "blu ray",
  "bd",
  "dvd",
  "1080p",
  "2d",
  "3d",
  "limited edition",
  "collectors edition",
  "collector's edition",
  "collector",
  "edition",
  "exclusive",
  "preorder",
  "pre-order",
  "numbered",
  "boxset",
  "box set",
  "booklet",
  "booklets",
  "postcards",
  "artcards",
  "art cards",
  "still cards",
  "lenticular card",
  "wwa",
  "wea",
  "w/",
  "+",
];

function stripTokens(text: string, tokens: string[]): string {
  let out = text;

  for (const token of tokens) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "gi"), "$1 $2");
  }

  return out;
}

function collapse(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/[\s:,\-–—]+$/g, "")
    .replace(/^[\s:,\-–—]+/g, "")
    .replace(/\s+(?:with|w\/|and|for)$/i, "")
    .replace(/\(\s*\)|\[\s*\]/g, "")
    .trim();
}

function classifyParenthetical(content: string): "variant" | "format" | "note" | "noise" | "year" {
  const normalized = content.trim().toLowerCase();

  if (/^\d{4}$/.test(normalized)) {
    return "year";
  }

  if (BRACKET_NOISE.has(normalized) || /^(region|copy|test)/.test(normalized)) {
    return "noise";
  }

  // Catalog codes inside brackets, e.g. "[ME#95]", are consumed by the catalog field.
  if (extractCatalog(normalized) !== null) {
    return "noise";
  }

  // Pure disc-combo contents like "2D+3D" or "4K + 2D" carry no edition signal.
  if (/^(?:\d?d|4k|uhd|bd|dvd|blu[\s-]?ray)[\s+]*(?:\d?d|4k|uhd|bd|dvd|blu[\s-]?ray)*$/i.test(normalized)) {
    return "noise";
  }

  if (extractVariant(normalized) !== null && normalized.split(/\s+/).length <= 6) {
    return "variant";
  }

  if (extractFormat(normalized) !== null && normalized.split(/\s+/).length <= 5) {
    return "format";
  }

  if (findLabelInText(normalized) !== null) {
    return "noise";
  }

  return "note";
}

/**
 * Parses a raw listing title (+vendor) into structured fields and an edition
 * grouping key. Pure function — safe to unit test and run in bulk.
 */
export function parseListing(input: ParseInput): ParseResult {
  const { title, vendor } = input;

  // --- structured extraction ---
  const catalog = extractCatalog(title);
  const variant = extractVariant(title);
  const format = extractFormat(title);

  const titleLabel = findLabelInText(title);
  const vendorLabel = vendor ? findLabelInText(vendor) : null;
  const labelSlug = titleLabel ?? vendorLabel ?? catalog?.labelSlug ?? null;

  const yearMatch = /\((19\d{2}|20\d{2})\)/.exec(title);
  const yearHint = yearMatch ? Number(yearMatch[1]) : null;

  // --- title cleaning ---
  let working = title;

  // Drop bracketed segments by classification.
  working = working.replace(/\[([^\]]*)\]|\(([^)]*)\)/g, (_m, square?: string, round?: string) => {
    const content = square ?? round ?? "";

    if (classifyParenthetical(content) === "note") {
      return `(${content})`; // keep notes; handled below
    }

    return " ";
  });

  // Capture the first surviving parenthetical as the edition note, then drop all.
  let editionNote: string | null = null;
  const noteMatch = /\(([^)]+)\)/.exec(working);

  if (noteMatch) {
    editionNote = noteMatch[1].trim();
  }

  working = working.replace(/\([^)]*\)/g, " ");

  // Remove catalog token, label aliases, and variant spans from the remainder.
  if (catalog) {
    working = working.replace(
      new RegExp(
        `${catalog.prefix}\\s*#?\\s*${catalog.number}\\b`,
        "i",
      ),
      " ",
    );
  }

  if (titleLabel) {
    working = stripLabelTokens(working);
  }

  if (variant) {
    working = working
      .replace(/\b(?:one|1)[\s-]?click\b/gi, " ")
      .replace(/\boab\b/gi, " ")
      .replace(/\bdouble[\s-]?(?:lenticular|lenti)\b/gi, " ")
      .replace(/\blenticular\b|\blenti\b/gi, " ")
      .replace(/\b(?:full|quarter|half)[\s-]?slip\b/gi, " ")
      .replace(/\bslip[\s-]?cover\b/gi, " ")
      .replace(/\btype\s*[a-d]\b/gi, " ")
      .replace(/\bcover\s*[a-d]\b/gi, " ")
      .replace(/\bversion\s*[a-d]\b/gi, " ")
      .replace(/\bver\.?\s*[a-d]\b/gi, " ");
  }

  working = stripTokens(working, TITLE_STOP_TOKENS);

  if (vendorLabel && !titleLabel) {
    working = stripLabelTokens(working);
  }

  // Drop the extracted type letter when it survives as a trailing token,
  // e.g. "Ghost In The Shell B" -> "Ghost In The Shell".
  if (variant?.display && /\b[a-d]\b/i.test(variant.display.slice(-1))) {
    const letter = variant.display.slice(-1);
    working = working.replace(new RegExp(`[\\s-]+${letter}$`, "i"), "");
  }

  const cleanedTitle = collapse(working) || title.trim();

  // --- search query derivation ---
  let searchQuery = cleanedTitle;

  const akaIdx = searchQuery.search(/\baka\b|\ba\.k\.a\.?\b/i);

  if (akaIdx > 0) {
    searchQuery = searchQuery.slice(0, akaIdx);
  }

  searchQuery = collapse(
    searchQuery
      // Strip a leading possessive name phrase ("Lee Cronin's The Mummy" -> "The Mummy")
      .replace(/^(?:[A-Z]\w*\s+)*[A-Z]\w*['’]s\s+/g, "")
      .replace(/\b[\w']+['’]s\b/gi, " ")
      .replace(/\s+/g, " "),
  );

  // --- edition key ---
  const variantPart = variant?.slug ?? "standard";
  let editionKey: string;

  if (catalog) {
    const label = labelSlug ?? catalog.labelSlug ?? "catalog";
    editionKey = `${label}:${catalog.code}:${variantPart}`;
  } else {
    const namespace = labelSlug ?? (editionNote ? `note:${slugify(editionNote)}` : "retail");
    editionKey = `${namespace}:${slugify(cleanedTitle)}:${variantPart}`;
  }

  return {
    labelSlug,
    catalogCode: catalog?.code ?? null,
    variantSlug: variant?.slug ?? null,
    variantDisplay: variant?.display ?? null,
    format,
    cleanedTitle,
    searchQuery: searchQuery || cleanedTitle,
    yearHint,
    editionNote,
    editionKey,
  };
}

/**
 * Removes every known label alias occurrence from text (e.g. both
 * "Manta Lab" and "Exclusive" in "Manta Lab Exclusive Edition").
 */
function stripLabelTokens(text: string): string {
  const allAliases = LABELS.flatMap((l) => l.aliases).sort((a, b) => b.length - a.length);

  return stripTokens(text, allAliases);
}
