import { Icons } from "@/components/ui/icons";
import {
  countBySeverity,
  eventsInLastBuckets,
  latestAlert,
  topServices,
} from "@/lib/derive/alerts";
import { formatRelativeTime } from "@/lib/format/time";
import type { Alert, VolumeBucket } from "@/lib/types/api";

/**
 * Top-of-page KPI strip. Six tiles summarizing the current state of
 * the system at a glance — total alerts, severity breakdown, recent
 * volume, top affected service, and the freshness of the latest
 * alert. Pure presentational; everything is derived from the live
 * `alerts` and `buckets` props.
 */
interface KpiStripProps {
  readonly alerts: readonly Alert[];
  readonly buckets: readonly VolumeBucket[];
  readonly nowMs: number;
}

export function KpiStrip({ alerts, buckets, nowMs }: KpiStripProps): React.JSX.Element {
  const counts = countBySeverity(alerts);
  const eventsLast5 = eventsInLastBuckets(buckets, 5);
  const top = topServices(alerts, 1)[0];
  const latest = latestAlert(alerts);

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Tile
        label="Total alerts"
        value={String(counts.total)}
        icon={Icons.brand}
        tone="neutral"
      />
      <Tile
        label="Critical"
        value={String(counts.critical)}
        icon={Icons.critical}
        tone="critical"
        emphasized={counts.critical > 0}
      />
      <Tile
        label="Error"
        value={String(counts.error)}
        icon={Icons.error}
        tone="error"
        emphasized={counts.error > 0}
      />
      <Tile
        label="Warning"
        value={String(counts.warning)}
        icon={Icons.warning}
        tone="warning"
        emphasized={counts.warning > 0}
      />
      <Tile
        label="Events / 5 min"
        value={String(eventsLast5)}
        icon={Icons.refresh}
        tone="accent"
      />
      <Tile
        label="Top service"
        value={top ? top.key : "—"}
        sub={top ? `${top.count} alert${top.count === 1 ? "" : "s"}` : "no data"}
        icon={Icons.bot}
        tone="neutral"
        compact
        secondaryFoot={
          latest ? `latest ${formatRelativeTime(latest.timestamp, nowMs)}` : undefined
        }
      />
    </ul>
  );
}

type TileTone = "neutral" | "accent" | "warning" | "error" | "critical";

const TONE_ICON: Readonly<Record<TileTone, string>> = {
  neutral: "text-fg-subtle",
  accent: "text-accent",
  warning: "text-[color:var(--color-warning)]",
  error: "text-[color:var(--color-error)]",
  critical: "text-[color:var(--color-critical)]",
};

const TONE_VALUE: Readonly<Record<TileTone, string>> = {
  neutral: "text-fg",
  accent: "text-fg",
  warning: "text-[color:var(--color-warning)]",
  error: "text-[color:var(--color-error)]",
  critical: "text-[color:var(--color-critical)]",
};

interface TileProps {
  readonly label: string;
  readonly value: string;
  readonly icon: typeof Icons[keyof typeof Icons];
  readonly tone: TileTone;
  readonly sub?: string;
  readonly emphasized?: boolean;
  readonly compact?: boolean;
  readonly secondaryFoot?: string;
}

function Tile({ label, value, icon: Icon, tone, sub, emphasized, compact, secondaryFoot }: TileProps): React.JSX.Element {
  return (
    <li
      className={`flex flex-col gap-1.5 rounded-lg border bg-surface/60 px-3 py-2.5 backdrop-blur-sm transition-colors ${
        emphasized ? "border-[color:var(--color-accent-ring)]/40" : "border-stroke"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
          {label}
        </span>
        <Icon className={`h-3.5 w-3.5 ${TONE_ICON[tone]}`} aria-hidden strokeWidth={2.25} />
      </div>
      <span
        className={`tabular-nums ${TONE_VALUE[tone]} ${compact ? "truncate font-mono text-sm font-medium" : "text-2xl font-semibold tracking-tight"}`}
      >
        {value}
      </span>
      {sub ? <span className="text-[11px] text-fg-subtle">{sub}</span> : null}
      {secondaryFoot ? <span className="font-mono text-[10px] text-fg-subtle">{secondaryFoot}</span> : null}
    </li>
  );
}
