"use client";

import { Pill } from "@/components/ui/pill";
import { topAnomalyTypes, topServices } from "@/lib/derive/alerts";
import { toggleFilter, useFilters } from "@/lib/store/filters";
import type { Alert } from "@/lib/types/api";

/**
 * Click-to-toggle filter strip for an arbitrary alert facet.
 *
 * Generic over the filter key (services / anomalyTypes) so the same
 * component renders both strips with the right derivation function.
 * If a strip has no items to show (no alerts in the current view), it
 * renders nothing — the page does not need to wrap it in a conditional.
 */
type FacetKey = "services" | "anomalyTypes";

interface FacetFilterStripProps {
  readonly alerts: readonly Alert[];
  readonly facet: FacetKey;
  readonly label: string;
  readonly limit?: number;
}

export function FacetFilterStrip({ alerts, facet, label, limit = 5 }: FacetFilterStripProps): React.JSX.Element | null {
  const active = useFilters((s) => s[facet]);
  const items = facet === "services" ? topServices(alerts, limit) : topAnomalyTypes(alerts, limit);

  if (items.length === 0) {
    return null;
  }

  return (
    <div role="group" aria-label={`Filter alerts by ${label}`} className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-medium uppercase tracking-wider text-fg-subtle">{label}</span>
      {items.map((item) => {
        const isActive = active.includes(item.key);
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => toggleFilter(facet, item.key)}
            className={`rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base ${
              isActive ? "opacity-100" : "opacity-50 hover:opacity-90"
            }`}
          >
            <Pill tone="neutral" label={`${item.count} ${item.key}`} />
          </button>
        );
      })}
    </div>
  );
}
