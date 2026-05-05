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
import type { VolumeBucket } from "@/lib/types/api";

/**
 * Live event-volume bar chart.
 *
 * - Last `windowMinutes` buckets only, so the chart stays readable as the
 *   API window grows.
 * - Most-recent bar is rendered with a brighter emerald fill to draw the eye
 *   to the live edge.
 * - X-axis is local-time `HH:MM`; tooltip shows full local datetime.
 * - Empty / loading framing is owned by the surrounding `ApiResultPanel`.
 */
interface VolumeChartProps {
  readonly buckets: readonly VolumeBucket[];
  readonly windowMinutes?: number;
}

const FILL_LIVE = "#34d399";
const FILL_HISTORY = "#10b981";

export function VolumeChart({ buckets, windowMinutes = 30 }: VolumeChartProps): React.JSX.Element {
  const visible = useMemo(() => buckets.slice(-windowMinutes), [buckets, windowMinutes]);
  const total = useMemo(() => visible.reduce((sum, bucket) => sum + bucket.count, 0), [visible]);
  const peak = useMemo(() => visible.reduce((max, b) => (b.count > max ? b.count : max), 0), [visible]);
  const latest = visible.length > 0 ? visible[visible.length - 1] : undefined;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <Stat label="Window" value={`${visible.length} min`} />
        <Stat label="Events" value={String(total)} accent />
        <Stat label="Peak / min" value={String(peak)} />
        {latest ? <Stat label="Now" value={String(latest.count)} mono /> : null}
      </div>

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
            <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="minute"
              tickFormatter={formatHourMinute}
              stroke="#3f3f46"
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              allowDecimals={false}
              stroke="#3f3f46"
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <Tooltip
              cursor={{ fill: "rgba(63, 63, 70, 0.25)" }}
              contentStyle={{
                background: "#09090b",
                border: "1px solid #27272a",
                borderRadius: 8,
                fontSize: 12,
                padding: "6px 10px",
              }}
              labelStyle={{ color: "#e4e4e7", marginBottom: 2 }}
              itemStyle={{ color: "#34d399" }}
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
      <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">{label}</span>
      <span
        className={`tabular-nums ${mono ? "font-mono" : "font-semibold"} ${accent ? "text-emerald-300" : "text-zinc-100"}`}
      >
        {value}
      </span>
    </div>
  );
}
