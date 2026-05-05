/**
 * Severity-specific badge with a leading icon.
 *
 * Centralizing the `Severity → tone + icon` mapping here means every surface
 * (chart, alert cards, triggering events table) shows the same visual for the
 * same severity, with no per-component styling drift.
 */
import { Pill, type PillTone } from "@/components/ui/pill";
import { severityIcon } from "@/components/ui/icons";
import type { Severity } from "@/lib/types/api";

const SEVERITY_TONE: Readonly<Record<Severity, PillTone>> = {
  info: "blue",
  warning: "amber",
  error: "orange",
  critical: "red",
};

interface SeverityBadgeProps {
  readonly severity: Severity;
}

export function SeverityBadge({ severity }: SeverityBadgeProps): React.JSX.Element {
  return <Pill tone={SEVERITY_TONE[severity]} label={severity} icon={severityIcon(severity)} />;
}
