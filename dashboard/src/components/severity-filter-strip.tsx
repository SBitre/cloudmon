"use client";

import { Icons } from "@/components/ui/icons";
import { Pill, type PillTone } from "@/components/ui/pill";
import { countBySeverity } from "@/lib/derive/alerts";
import { toggleFilter, useFilters } from "@/lib/store/filters";
import type { Alert, Severity } from "@/lib/types/api";

const SEVERITIES: ReadonlyArray<{ key: Severity; tone: PillTone; label: string; iconKey: keyof typeof Icons }> = [
  { key: "critical", tone: "critical", label: "critical", iconKey: "critical" },
  { key: "error", tone: "error", label: "error", iconKey: "error" },
  { key: "warning", tone: "warning", label: "warning", iconKey: "warning" },
  { key: "info", tone: "info", label: "info", iconKey: "info" },
];

interface SeverityFilterStripProps {
  readonly alerts: readonly Alert[];
}

export function SeverityFilterStrip({ alerts }: SeverityFilterStripProps): React.JSX.Element {
  const filter = useFilters((s) => s.severity);
  const counts = countBySeverity(alerts);

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
            onClick={() => toggleFilter("severity", s.key)}
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
