import { AlertCard } from "@/components/alert-card";
import type { Alert } from "@/lib/types/api";

/**
 * Vertical list of alert cards, sorted newest-first.
 *
 * The empty-state message is owned by the surrounding `ApiResultPanel`; this
 * component is purely a list. Keeps each component single-responsibility.
 */
interface AlertListProps {
  readonly alerts: readonly Alert[];
}

export function AlertList({ alerts }: AlertListProps): React.JSX.Element {
  const sorted = [...alerts].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return (
    <ol className="flex flex-col gap-4">
      {sorted.map((alert) => (
        <li key={alert.alert_id} className="cloudmon-fade-in">
          <AlertCard alert={alert} />
        </li>
      ))}
    </ol>
  );
}
