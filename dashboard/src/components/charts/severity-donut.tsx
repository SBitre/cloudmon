"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { countBySeverity } from "@/lib/derive/alerts";
import type { Alert } from "@/lib/types/api";

/**
 * Compact donut chart of alert mix by severity.
 *
 * Uses CSS-var-driven fills so the slices flip with the theme + accent
 * picker. Empty slices are filtered out so the legend stays clean. If
 * there are no alerts at all, the donut is hidden in favor of a thin
 * placeholder line — let the surrounding panel decide whether to render
 * an empty state.
 */
interface SeverityDonutProps {
  readonly alerts: readonly Alert[];
}

interface Slice {
  readonly key: string;
  readonly value: number;
  readonly fill: string;
}

const COLORS = {
  info: "var(--color-info)",
  warning: "var(--color-warning)",
  error: "var(--color-error)",
  critical: "var(--color-critical)",
} as const;

export function SeverityDonut({ alerts }: SeverityDonutProps): React.JSX.Element {
  const counts = countBySeverity(alerts);
  const slices: Slice[] = [
    { key: "critical", value: counts.critical, fill: COLORS.critical },
    { key: "error", value: counts.error, fill: COLORS.error },
    { key: "warning", value: counts.warning, fill: COLORS.warning },
    { key: "info", value: counts.info, fill: COLORS.info },
  ].filter((slice) => slice.value > 0);

  if (counts.total === 0) {
    return (
      <p className="py-6 text-center text-xs text-fg-subtle">No alerts to break down yet.</p>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-32 w-32 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="key"
              cx="50%"
              cy="50%"
              innerRadius={36}
              outerRadius={56}
              paddingAngle={2}
              isAnimationActive={false}
            >
              {slices.map((slice) => (
                <Cell key={slice.key} fill={slice.fill} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-stroke)",
                borderRadius: 8,
                fontSize: 12,
                padding: "6px 10px",
                color: "var(--color-fg)",
              }}
              labelStyle={{ color: "var(--color-fg)" }}
              itemStyle={{ color: "var(--color-fg)" }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums text-fg">{counts.total}</span>
          <span className="text-[10px] uppercase tracking-wider text-fg-subtle">total</span>
        </div>
      </div>
      <ul className="flex flex-col gap-1 text-xs">
        {slices.map((slice) => (
          <li key={slice.key} className="flex items-center gap-2 text-fg">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: slice.fill }}
              aria-hidden
            />
            <span className="font-mono uppercase tracking-wide text-fg-subtle">{slice.key}</span>
            <span className="ml-auto font-mono tabular-nums">{slice.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
