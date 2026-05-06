"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { topAnomalyTypes, topServices, type CountedItem } from "@/lib/derive/alerts";
import type { Alert } from "@/lib/types/api";

/**
 * Generic horizontal-bar leaderboard. Used by the "Top services" and
 * "Top anomaly types" panels so both surfaces share visual rhythm
 * (same chart shape, same tooltip, same empty state).
 *
 * The data prop comes in pre-aggregated; this component is presentation
 * only. Callers pick how many rows to show by trimming before passing in.
 */
interface LeaderboardChartProps {
  readonly title: string;
  readonly data: readonly CountedItem[];
  readonly emptyMessage: string;
}

export function LeaderboardChart({ title, data, emptyMessage }: LeaderboardChartProps): React.JSX.Element {
  if (data.length === 0) {
    return <p className="py-6 text-center text-xs text-fg-subtle">{emptyMessage}</p>;
  }

  // Recharts horizontal bar = layout="vertical" with category on Y axis.
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-fg-subtle">{title}</p>
      <div className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={[...data]} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
            <XAxis type="number" hide allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="key"
              stroke="var(--color-stroke)"
              tick={{ fill: "var(--color-fg-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={120}
            />
            <Tooltip
              cursor={{ fill: "var(--color-surface-subtle)", fillOpacity: 0.5 }}
              contentStyle={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-stroke)",
                borderRadius: 8,
                fontSize: 12,
                padding: "6px 10px",
                color: "var(--color-fg)",
              }}
              labelStyle={{ color: "var(--color-fg)" }}
              itemStyle={{ color: "var(--color-accent)" }}
              formatter={(value) => [String(value), "alerts"]}
            />
            <Bar dataKey="count" radius={[0, 3, 3, 0]} isAnimationActive={false}>
              {data.map((entry) => (
                <Cell key={entry.key} fill="var(--color-accent)" fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function TopServicesChart({ alerts }: { readonly alerts: readonly Alert[] }): React.JSX.Element {
  return (
    <LeaderboardChart
      title="Top services"
      data={topServices(alerts, 5)}
      emptyMessage="No alerts grouped by service yet."
    />
  );
}

export function TopAnomalyTypesChart({ alerts }: { readonly alerts: readonly Alert[] }): React.JSX.Element {
  return (
    <LeaderboardChart
      title="Top anomaly types"
      data={topAnomalyTypes(alerts, 5)}
      emptyMessage="No alerts grouped by anomaly type yet."
    />
  );
}
