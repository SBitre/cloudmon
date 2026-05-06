/**
 * Pure formatting helpers for timestamps and time-deltas.
 *
 * Kept dependency-free so the same helpers can be reused from any
 * component, server or client. All inputs are ISO 8601 UTC strings as
 * produced by the read API.
 */

/**
 * Current time as ISO 8601 UTC with `Z` suffix and millisecond precision.
 *
 * Millisecond precision matters for DynamoDB: the `cloudmon-events` table
 * is keyed `(service, timestamp)`, so second-precision timestamps cause
 * silent overwrites when the dashboard fires multiple events per second
 * at the same service. The Python simulator uses microsecond precision
 * via `datetime.now(...).isoformat()` for the same reason.
 */
export function utcNowIso8601(): string {
  return new Date().toISOString();
}

/** Format an ISO timestamp as a short local-time `HH:MM` label. */
export function formatHourMinute(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Format an ISO timestamp as a full local datetime label. */
export function formatLocalDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/** Format the time elapsed since `iso` as a compact string (e.g. "12s ago", "3m ago"). */
export function formatRelativeTime(iso: string, nowMs: number = Date.now()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const diffSeconds = Math.max(0, Math.round((nowMs - date.getTime()) / 1000));
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}
