import { AlertCard } from "@/components/alert-card";
import { alertMinuteBucket } from "@/lib/derive/alerts";
import { useFilters } from "@/lib/store/filters";
import type { Alert } from "@/lib/types/api";

/**
 * Vertical list of alert cards, sorted newest-first, filtered by the
 * current filters store (severity / services / anomaly types / minute).
 *
 * The empty-state message is owned by the surrounding `ApiResultPanel`
 * (which receives `isEmpty=true` when the visible list is empty), so
 * this component is purely a list. Single-responsibility.
 */
interface AlertListProps {
  readonly alerts: readonly Alert[];
}

export function AlertList({ alerts }: AlertListProps): React.JSX.Element {
  const filters = useFilters();
  const visible = alerts
    .filter((alert) => filters.severity.includes(alert.severity))
    .filter((alert) => filters.services.length === 0 || filters.services.includes(alert.service))
    .filter(
      (alert) => filters.anomalyTypes.length === 0 || filters.anomalyTypes.includes(alert.anomaly_type),
    )
    .filter(
      (alert) => filters.minute === null || alertMinuteBucket(alert.timestamp) === filters.minute,
    )
    .slice()
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return (
    <ol className="flex flex-col gap-4">
      {visible.map((alert) => (
        <li key={alert.alert_id} className="cloudmon-fade-in">
          <AlertCard alert={alert} />
        </li>
      ))}
    </ol>
  );
}

/**
 * Helper for the page to know whether the visible list will be empty
 * (so the surrounding panel can show the right "no results" copy).
 */
export function countVisibleAlerts(
  alerts: readonly Alert[],
  filters: {
    readonly severity: ReadonlyArray<string>;
    readonly services: ReadonlyArray<string>;
    readonly anomalyTypes: ReadonlyArray<string>;
    readonly minute: string | null;
  },
): number {
  return alerts.filter(
    (alert) =>
      filters.severity.includes(alert.severity) &&
      (filters.services.length === 0 || filters.services.includes(alert.service)) &&
      (filters.anomalyTypes.length === 0 || filters.anomalyTypes.includes(alert.anomaly_type)) &&
      (filters.minute === null || alertMinuteBucket(alert.timestamp) === filters.minute),
  ).length;
}
