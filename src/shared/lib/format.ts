export function formatPriceRange(
  min: number | null,
  max: number | null,
): string {
  if (min === null && max === null) {
    return "—";
  }

  if (min === null || max === null) {
    return formatCents(min ?? max ?? 0);
  }

  if (min === max) {
    return formatCents(min);
  }

  return `${formatCents(min)} – ${formatCents(max)}`;
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function formatDate(iso: string): string {
  return new Date(`${iso.replace(" ", "T")}Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Formats a Date the way SQLite stores datetimes ("YYYY-MM-DD HH:MM:SS" UTC),
 *  so the parse-and-append-Z helpers above round-trip it. */
export function toSqliteUtc(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export function formatDateTime(iso: string): string {
  return new Date(`${iso.replace(" ", "T")}Z`).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function timeAgo(iso: string): string {
  const then = new Date(`${iso.replace(" ", "T")}Z`).getTime();
  const seconds = Math.max(1, Math.floor((Date.now() - then) / 1000));

  if (seconds < 60) {
    return "just now";
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 30) {
    return `${days}d ago`;
  }

  return formatDate(iso);
}

/** Inverse of timeAgo for future timestamps (e.g. the next scheduled ingest). */
export function timeUntil(iso: string): string {
  const then = new Date(`${iso.replace(" ", "T")}Z`).getTime();
  const seconds = Math.floor((then - Date.now()) / 1000);

  if (seconds <= 0) {
    return "any moment";
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `in ${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `in ${hours}h`;
  }

  return `in ${Math.floor(hours / 24)}d`;
}
