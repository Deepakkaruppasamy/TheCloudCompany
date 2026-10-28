/**
 * src/lib/time.ts
 *
 * Display helpers for time formatting.
 * Database time is always authoritative; these are display only.
 */

/** Format a Date or ISO string as a human-readable relative time */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = Date.now();
  const diffMs = d.getTime() - now;
  const absDiff = Math.abs(diffMs);
  const isPast = diffMs < 0;

  if (absDiff < 60_000) {
    return isPast ? "just now" : "in a few seconds";
  }
  if (absDiff < 3_600_000) {
    const mins = Math.round(absDiff / 60_000);
    return isPast ? `${mins}m ago` : `in ${mins}m`;
  }
  if (absDiff < 86_400_000) {
    const hrs = Math.round(absDiff / 3_600_000);
    return isPast ? `${hrs}h ago` : `in ${hrs}h`;
  }
  const days = Math.round(absDiff / 86_400_000);
  return isPast ? `${days}d ago` : `in ${days}d`;
}

/** Format a countdown (ms remaining) into HH:MM:SS */
export function formatCountdown(remainingMs: number): string {
  if (remainingMs <= 0) return "Closed";
  const totalSecs = Math.floor(remainingMs / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Format a Date as a locale string */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Closing soon = within 24 hours */
export function isClosingSoon(closesAt: Date | string): boolean {
  const d = typeof closesAt === "string" ? new Date(closesAt) : closesAt;
  const diffMs = d.getTime() - Date.now();
  return diffMs > 0 && diffMs < 86_400_000;
}
