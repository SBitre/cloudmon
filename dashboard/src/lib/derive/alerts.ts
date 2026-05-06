/**
 * Pure, dependency-free derivations from the read-API responses.
 *
 * Lives outside React so it can be unit-tested in isolation. All
 * functions are O(n) over the input arrays and produce small, stable
 * shapes the UI consumes directly.
 */
import type { Alert, Severity, VolumeBucket } from "@/lib/types/api";

export interface SeverityCounts {
  readonly info: number;
  readonly warning: number;
  readonly error: number;
  readonly critical: number;
  readonly total: number;
}

export interface CountedItem {
  readonly key: string;
  readonly count: number;
}

/** Tally each severity in the alert list. */
export function countBySeverity(alerts: readonly Alert[]): SeverityCounts {
  const result = { info: 0, warning: 0, error: 0, critical: 0 };
  for (const alert of alerts) {
    result[alert.severity] += 1;
  }
  return { ...result, total: alerts.length };
}

/** Top services by alert count, descending. */
export function topServices(alerts: readonly Alert[], limit = 5): CountedItem[] {
  const tally = new Map<string, number>();
  for (const alert of alerts) {
    tally.set(alert.service, (tally.get(alert.service) ?? 0) + 1);
  }
  return [...tally.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Top anomaly types by alert count, descending. */
export function topAnomalyTypes(alerts: readonly Alert[], limit = 5): CountedItem[] {
  const tally = new Map<string, number>();
  for (const alert of alerts) {
    tally.set(alert.anomaly_type, (tally.get(alert.anomaly_type) ?? 0) + 1);
  }
  return [...tally.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Sum of events over the last `n` non-empty buckets ending at the
 * latest. Used for the "events / 5m" KPI tile.
 */
export function eventsInLastBuckets(buckets: readonly VolumeBucket[], n: number): number {
  if (buckets.length === 0) {
    return 0;
  }
  return buckets.slice(-n).reduce((sum, b) => sum + b.count, 0);
}

/** Truncate an ISO 8601 timestamp to the start of the minute (UTC, with `Z` suffix). */
export function alertMinuteBucket(iso: string): string {
  // "2026-05-06T01:23:45.678Z" → "2026-05-06T01:23:00Z"
  if (iso.length < 16) {
    return iso;
  }
  return `${iso.slice(0, 16)}:00Z`.replace(/(\d{2})00Z$/, "00Z");
}

/** Most recent alert's relative-time-friendly metadata, or null when empty. */
export function latestAlert(alerts: readonly Alert[]): Alert | null {
  if (alerts.length === 0) {
    return null;
  }
  return alerts.reduce((latest, current) =>
    current.timestamp > latest.timestamp ? current : latest,
  );
}

/** Tone hint per severity, matching the ui Pill tones used for badges. */
export const SEVERITY_ORDER: ReadonlyArray<Severity> = ["critical", "error", "warning", "info"];
