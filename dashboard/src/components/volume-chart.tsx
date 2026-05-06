"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatHourMinute, formatLocalDateTime } from "@/lib/format/time";
import { useSettings } from "@/lib/store/settings";
import type { VolumeBucket } from "@/lib/types/api";

/**
 * Live event-volume bar chart.
 *
 * - Last `windowMinutes` buckets only, so the chart stays readable as the
 *   API window grows.
 * - Most-recent bar is rendered with a brighter fill to draw the eye to the
 *   live edge.
 * - Tooltip and axes use CSS custom properties so the chart chrome flips
 *   automatically with the theme; the bar gradient stays emerald in both
 *   themes (accent color is consistent across modes by design).
 */
interface VolumeChartProps {
  readonly buckets: readonly VolumeBucket[];
  /** Optional override; falls back to the user's `volumeWindowMinutes` setting. */
  readonly windowMinutes?: number;
}

const FILL_LIVE = "var(--color-accent-hover)";
const FILL_HISTORY = "var(--color-accent)";

export function VolumeChart({ buckets, windowMinutes }: VolumeChartProps): React.JSX.Element {
  const settingWindow = useSettings((s) => s.volumeWindowMinutes);
  const effectiveWindow = windowMinutes ?? settingWindow;
  const visible = useMemo(() => buckets.slice(-effectiveWindow), [buckets, effectiveWindow]);
  const total = useMemo(() => visible.reduce((sum, bucket) => sum + bucket.count, 0), [visible]);
  const peak = useMemo(() => visible.reduce((max, b) => (b.count > max ? b.count : max), 0), [visible]);
  const latest = visible.length > 0 ? visible[visible.length - 1] : undefined;
  const apiCapped = visible.length < effectiveWindow;
  const windowLabel = apiCapped
    ? `${visible.length} / ${effectiveWindow} min`
    : `${visible.length} min`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <Stat label="Window" value={windowLabel} />
        <Stat label="Events" value={String(total)} accent />
        <Stat label="Peak / min" value={String(peak)} />
        {latest ? <Stat label="Now" value={String(latest.count)} mono /> : null}
      </div>

      {apiCapped ? (
        <p className="-mt-1 mb-3 font-mono text-[11px] text-fg-subtle">
          Read API returned {visible.length} min of buckets; pick a smaller window or
          extend the API to surface the full {effectiveWindow}-minute history.
        </p>
      ) : null}

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={[...visible]} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="cloudmon-bar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={FILL_HISTORY} stopOpacity={0.95} />
                <stop offset="100%" stopColor={FILL_HISTORY} stopOpacity={0.55} />
              </linearGradient>
              <linearGradient id="cloudmon-bar-live" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={FILL_LIVE} stopOpacity={1} />
                <stop offset="100%" stopColor={FILL_LIVE} stopOpacity={0.7} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-stroke)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="minute"
              tickFormatter={formatHourMinute}
              stroke="var(--color-stroke)"
              tick={{ fill: "var(--color-fg-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              allowDecimals={false}
              stroke="var(--color-stroke)"
              tick={{ fill: "var(--color-fg-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={32}
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
              labelStyle={{ color: "var(--color-fg)", marginBottom: 2 }}
              itemStyle={{ color: "var(--color-accent)" }}
              labelFormatter={(label) => formatLocalDateTime(String(label))}
              formatter={(value) => [String(value), "events"]}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {visible.map((bucket, index) => (
                <Cell
                  key={bucket.minute}
                  fill={index === visible.length - 1 ? "url(#cloudmon-bar-live)" : "url(#cloudmon-bar)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface StatProps {
  readonly label: string;
  readonly value: string;
  readonly accent?: boolean;
  readonly mono?: boolean;
}

function Stat({ label, value, accent, mono }: StatProps): React.JSX.Element {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-mono text-[10px] uppercase tracking-wide text-fg-subtle">{label}</span>
      <span
        className={`tabular-nums ${mono ? "font-mono" : "font-semibold"} ${accent ? "text-[color:var(--color-accent-fg)]" : "text-fg"}`}
      >
        {value}
      </span>
    </div>
  );
}
