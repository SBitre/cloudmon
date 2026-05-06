import { AlertCard } from "@/components/alert-card";
import { useSettings } from "@/lib/store/settings";
import type { Alert } from "@/lib/types/api";

/**
 * Vertical list of alert cards, sorted newest-first, filtered by the
 * user's severity-filter setting.
 *
 * The empty-state message is owned by the surrounding `ApiResultPanel`
 * (which is given `isEmpty=true` when the visible list ends up empty),
 * so this component is purely a list. Single-responsibility.
 */
interface AlertListProps {
  readonly alerts: readonly Alert[];
}

export function AlertList({ alerts }: AlertListProps): React.JSX.Element {
  const severityFilter = useSettings((s) => s.severityFilter);
  const visible = alerts
    .filter((alert) => severityFilter.includes(alert.severity))
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
