/**
 * Severity-specific badge with a leading icon.
 *
 * Centralizes the `Severity → tone + icon` mapping so every surface
 * (chart, alert cards, triggering events table) shows the same visual.
 * The pill tones map onto semantic theme tokens so light/dark flips
 * preserve the contrast and intent.
 */
import { Pill, type PillTone } from "@/components/ui/pill";
import { severityIcon } from "@/components/ui/icons";
import type { Severity } from "@/lib/types/api";

const SEVERITY_TONE: Readonly<Record<Severity, PillTone>> = {
  info: "info",
  warning: "warning",
  error: "error",
  critical: "critical",
};

interface SeverityBadgeProps {
  readonly severity: Severity;
}

export function SeverityBadge({ severity }: SeverityBadgeProps): React.JSX.Element {
  return <Pill tone={SEVERITY_TONE[severity]} label={severity} icon={severityIcon(severity)} />;
}
