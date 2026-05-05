"use client";

import { useState } from "react";

import { Icons, severityIcon } from "@/components/ui/icons";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { formatLocalDateTime, formatRelativeTime } from "@/lib/format/time";
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
 *
 * The triggering-events block is collapsed by default so the page does not
 * blow up vertically when many events are bundled into a single alert.
 */
interface AlertCardProps {
  readonly alert: Alert;
}

const BORDER_BY_SEVERITY: Readonly<Record<Severity, string>> = {
  info: "before:bg-blue-400/70",
  warning: "before:bg-amber-400/80",
  error: "before:bg-orange-400/80",
  critical: "before:bg-red-500/90",
};

const HEADER_ICON_TONE: Readonly<Record<Severity, string>> = {
  info: "text-blue-300",
  warning: "text-amber-300",
  error: "text-orange-300",
  critical: "text-red-300",
};

export function AlertCard({ alert }: AlertCardProps): React.JSX.Element {
  const [showTriggering, setShowTriggering] = useState(false);
  const triggeringCount = alert.triggering_events.length;
  const SeverityIcon = severityIcon(alert.severity);
  const ToggleIcon = showTriggering ? Icons.expand : Icons.collapse;

  return (
    <article
      className={`group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 pl-6 transition-colors hover:border-zinc-700 hover:bg-zinc-900/60 before:absolute before:inset-y-0 before:left-0 before:w-1 ${BORDER_BY_SEVERITY[alert.severity]}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-zinc-800/80 pb-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <SeverityIcon
            className={`h-4 w-4 ${HEADER_ICON_TONE[alert.severity]}`}
            aria-hidden
            strokeWidth={2.25}
          />
          <span className="text-base font-semibold tracking-tight text-zinc-50">{alert.service}</span>
          <span className="font-mono text-xs text-zinc-400">{alert.anomaly_type}</span>
          <SeverityBadge severity={alert.severity} />
        </div>
        <time
          className="font-mono text-[11px] tabular-nums text-zinc-500"
          dateTime={alert.timestamp}
          title={formatLocalDateTime(alert.timestamp)}
        >
          {formatRelativeTime(alert.timestamp)}
        </time>
      </header>

      <div className="mt-3 flex gap-3">
        <Icons.ai
          className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-400/80"
          aria-hidden
          strokeWidth={2.25}
        />
        {alert.explanation ? (
          <p className="text-sm leading-relaxed text-zinc-200">{alert.explanation}</p>
        ) : (
          <p className="text-sm italic text-zinc-500">No AI explanation available.</p>
        )}
      </div>

      {alert.recommended_actions.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Recommended actions
          </p>
          <ul className="space-y-1.5 text-sm text-zinc-300">
            {alert.recommended_actions.map((action) => (
              <li key={action} className="flex items-start gap-2">
                <Icons.ok
                  className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400/80"
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
        <div className="mt-4 border-t border-zinc-800/80 pt-3">
          <button
            type="button"
            onClick={() => setShowTriggering((prev) => !prev)}
            aria-expanded={showTriggering}
            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wider text-zinc-400 transition hover:text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
          >
            <ToggleIcon className="h-3 w-3" aria-hidden strokeWidth={2.25} />
            {showTriggering ? "Hide" : "Show"} triggering events
            <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-300">
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
    <div className="cloudmon-fade-in mt-3 max-h-72 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950/60">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur-sm text-[10px] uppercase tracking-wider text-zinc-500">
          <tr className="border-b border-zinc-800">
            <th className="px-3 py-2 font-medium">When</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Severity</th>
            <th className="px-3 py-2 font-medium">Detail</th>
          </tr>
        </thead>
        <tbody>
          {alert.triggering_events.map((event) => (
            <tr key={event.event_id} className="border-t border-zinc-800/60 align-top transition-colors hover:bg-zinc-900/40">
              <td className="whitespace-nowrap px-3 py-1.5 font-mono tabular-nums text-zinc-400">
                {formatLocalDateTime(event.timestamp)}
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 font-mono text-zinc-300">{event.event_type}</td>
              <td className="px-3 py-1.5">
                <SeverityBadge severity={event.severity} />
              </td>
              <td className="px-3 py-1.5 font-mono text-zinc-300">
                <span className="block max-w-[42ch] truncate" title={describeEventDetail(event)}>
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
