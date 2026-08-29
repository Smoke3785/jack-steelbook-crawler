/**
 * Format detection from free text, e.g. "4K UHD + Blu-ray" -> "uhd+bd".
 * Returns null when nothing recognizable is present.
 */

const FORMAT_DISPLAY: Record<string, string> = {
  uhd: "4K UHD",
  bd: "Blu-ray",
  dvd: "DVD",
  "uhd+bd": "4K UHD + Blu-ray",
  "uhd+dvd": "4K UHD + DVD",
  "bd+dvd": "Blu-ray + DVD",
};

export function formatDisplay(format: string | null): string {
  if (!format) {
    return "Unknown";
  }

  return FORMAT_DISPLAY[format] ?? format.toUpperCase();
}

export function extractFormat(text: string): string | null {
  const hasUhd = /\b(?:4k|uhd)\b/i.test(text);
  const hasBd = /\b(?:blu[\s-]?ray|blu[\s-]?ray|bd)\b/i.test(text) || /\bbd\b/i.test(text);
  const hasDvd = /\bdvd\b/i.test(text);

  if (hasUhd && hasBd) {
    return "uhd+bd";
  }

  if (hasUhd && hasDvd) {
    return "uhd+dvd";
  }

  if (hasBd && hasDvd) {
    return "bd+dvd";
  }

  if (hasUhd) {
    return "uhd";
  }

  if (hasBd) {
    return "bd";
  }

  if (hasDvd) {
    return "dvd";
  }

  return null;
}
