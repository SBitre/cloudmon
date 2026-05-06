"use client";

import { Icons } from "@/components/ui/icons";
import { Pill, type PillTone } from "@/components/ui/pill";
import { setSettings, useSettings, type SeverityFilter } from "@/lib/store/settings";
import type { Alert, Severity } from "@/lib/types/api";

/**
 * Clickable severity-filter chip strip.
 *
 * Each visible severity gets a Pill whose pressed state matches whether
 * that severity is currently in the filter set; clicking toggles it.
 * Counts come from the live alerts list so users see the impact of
 * filtering at a glance.
 */
const SEVERITIES: ReadonlyArray<{ key: SeverityFilter; tone: PillTone; label: string; iconKey: keyof typeof Icons }> = [
  { key: "critical", tone: "critical", label: "critical", iconKey: "critical" },
  { key: "error", tone: "error", label: "error", iconKey: "error" },
  { key: "warning", tone: "warning", label: "warning", iconKey: "warning" },
  { key: "info", tone: "info", label: "info", iconKey: "info" },
];

interface SeverityFilterStripProps {
  readonly alerts: readonly Alert[];
}

export function SeverityFilterStrip({ alerts }: SeverityFilterStripProps): React.JSX.Element {
  const filter = useSettings((s) => s.severityFilter);
  const counts = countBySeverity(alerts);

  function toggle(key: SeverityFilter): void {
    const next = filter.includes(key) ? filter.filter((s) => s !== key) : [...filter, key];
    setSettings({ severityFilter: next });
  }

  return (
    <div role="group" aria-label="Filter alerts by severity" className="flex flex-wrap items-center gap-2">
      <Pill tone="neutral" label={`${alerts.length} total`} />
      {SEVERITIES.map((s) => {
        const count = counts[s.key];
        if (count === 0) {
          return null;
        }
        const active = filter.includes(s.key);
        const Icon = Icons[s.iconKey];
        return (
          <button
            key={s.key}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(s.key)}
            className={`rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base ${
              active ? "opacity-100" : "opacity-50 hover:opacity-90"
            }`}
          >
            <Pill tone={s.tone} label={`${count} ${s.label}`} icon={Icon} />
          </button>
        );
      })}
    </div>
  );
}

function countBySeverity(alerts: readonly Alert[]): Record<Severity, number> {
  const init: Record<Severity, number> = { info: 0, warning: 0, error: 0, critical: 0 };
  for (const alert of alerts) {
    init[alert.severity] += 1;
  }
  return init;
}
