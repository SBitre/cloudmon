"use client";

import { useState } from "react";

import { Icons, severityIcon } from "@/components/ui/icons";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { formatLocalDateTime, formatRelativeTime } from "@/lib/format/time";
import { useSettings } from "@/lib/store/settings";
import type { Alert, Severity } from "@/lib/types/api";

/**
 * Card view of a single alert.
 *
 * Visual structure (top to bottom):
 *
 *   ┃ severity-tinted left border (1.5px)
 *   header  — severity icon + service · anomaly type · severity badge · "X ago"
 *   body    — Gemini-generated explanation (with subtle AI sparkle marker)
 *   actions — recommended actions list with check-circle bullets
 *   footer  — collapsible block listing the events that triggered this alert
 */
interface AlertCardProps {
  readonly alert: Alert;
}

const ACCENT_BORDER_VAR: Readonly<Record<Severity, string>> = {
  info: "before:bg-[color:var(--color-info)]/70",
  warning: "before:bg-[color:var(--color-warning)]/80",
  error: "before:bg-[color:var(--color-error)]/80",
  critical: "before:bg-[color:var(--color-critical)]/90",
};

const HEADER_ICON_TONE: Readonly<Record<Severity, string>> = {
  info: "text-[color:var(--color-info)]",
  warning: "text-[color:var(--color-warning)]",
  error: "text-[color:var(--color-error)]",
  critical: "text-[color:var(--color-critical)]",
};

export function AlertCard({ alert }: AlertCardProps): React.JSX.Element {
  const density = useSettings((s) => s.density);
  const [showTriggering, setShowTriggering] = useState(false);
  const triggeringCount = alert.triggering_events.length;
  const SeverityIcon = severityIcon(alert.severity);
  const ToggleIcon = showTriggering ? Icons.expand : Icons.collapse;
  const AiIcon = Icons.ai;
  const OkIcon = Icons.ok;
  const padding = density === "compact" ? "p-3 pl-4" : "p-5 pl-6";

  return (
    <article
      className={`group relative overflow-hidden rounded-xl border border-stroke bg-surface/60 ${padding} transition-colors hover:border-accent/40 hover:bg-surface-elevated/80 before:absolute before:inset-y-0 before:left-0 before:w-1 ${ACCENT_BORDER_VAR[alert.severity]}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-stroke pb-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <SeverityIcon
            className={`h-4 w-4 ${HEADER_ICON_TONE[alert.severity]}`}
            aria-hidden
            strokeWidth={2.25}
          />
          <span className="text-base font-semibold tracking-tight text-fg">{alert.service}</span>
          <span className="font-mono text-xs text-fg-muted">{alert.anomaly_type}</span>
          <SeverityBadge severity={alert.severity} />
        </div>
        <time
          className="font-mono text-[11px] tabular-nums text-fg-subtle"
          dateTime={alert.timestamp}
          title={formatLocalDateTime(alert.timestamp)}
        >
          {formatRelativeTime(alert.timestamp)}
        </time>
      </header>

      <div className="mt-3 flex gap-3">
        <AiIcon
          className="mt-1 h-3.5 w-3.5 shrink-0 text-accent"
          aria-hidden
          strokeWidth={2.25}
        />
        {alert.explanation ? (
          <p className="text-sm leading-relaxed text-fg">{alert.explanation}</p>
        ) : (
          <p className="text-sm italic text-fg-subtle">No AI explanation available.</p>
        )}
      </div>

      {alert.recommended_actions.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
            Recommended actions
          </p>
          <ul className="space-y-1.5 text-sm text-fg">
            {alert.recommended_actions.map((action) => (
              <li key={action} className="flex items-start gap-2">
                <OkIcon
                  className="mt-0.5 h-4 w-4 shrink-0 text-accent"
                  aria-hidden
                  strokeWidth={2.25}
                />
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {triggeringCount > 0 ? (
        <div className="mt-4 border-t border-stroke pt-3">
          <button
            type="button"
            onClick={() => setShowTriggering((prev) => !prev)}
            aria-expanded={showTriggering}
            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wider text-fg-muted transition hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
          >
            <ToggleIcon className="h-3 w-3" aria-hidden strokeWidth={2.25} />
            {showTriggering ? "Hide" : "Show"} triggering events
            <span className="rounded-full bg-surface-elevated px-1.5 py-0.5 text-[10px] tabular-nums text-fg">
              {triggeringCount}
            </span>
          </button>
          {showTriggering ? <TriggeringEventsTable alert={alert} /> : null}
        </div>
      ) : null}
    </article>
  );
}

function TriggeringEventsTable({ alert }: { readonly alert: Alert }): React.JSX.Element {
  return (
    <div className="cloudmon-fade-in mt-3 max-h-72 overflow-auto rounded-lg border border-stroke bg-surface-base/60">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-surface-elevated/95 backdrop-blur-sm text-[10px] uppercase tracking-wider text-fg-subtle">
          <tr className="border-b border-stroke">
            <th scope="col" className="px-3 py-2 font-medium">When</th>
            <th scope="col" className="px-3 py-2 font-medium">Type</th>
            <th scope="col" className="px-3 py-2 font-medium">Severity</th>
            <th scope="col" className="px-3 py-2 font-medium">Detail</th>
          </tr>
        </thead>
        <tbody>
          {alert.triggering_events.map((event) => (
            <tr key={event.event_id} className="border-t border-stroke align-top transition-colors hover:bg-surface-elevated/60">
              <td className="whitespace-nowrap px-3 py-1.5 font-mono tabular-nums text-fg-muted">
                {formatLocalDateTime(event.timestamp)}
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 font-mono text-fg">{event.event_type}</td>
              <td className="px-3 py-1.5">
                <SeverityBadge severity={event.severity} />
              </td>
              <td className="px-3 py-1.5 font-mono text-fg">
                <span className="wrap-break-word whitespace-pre-wrap">
                  {describeEventDetail(event)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function describeEventDetail(event: Alert["triggering_events"][number]): string {
  const parts: string[] = [];
  if (event.endpoint) {
    parts.push(event.endpoint);
  }
  if (event.status_code !== undefined) {
    parts.push(String(event.status_code));
  }
  if (event.ip_address) {
    parts.push(event.ip_address);
  }
  if (event.user_id) {
    parts.push(event.user_id);
  }
  if (event.error_message) {
    parts.push(event.error_message);
  }
  return parts.join(" · ");
}
