"use client";

import { AlertList } from "@/components/alert-list";
import { ApiResultPanel } from "@/components/api-result-panel";
import { Icons } from "@/components/ui/icons";
import { Pill } from "@/components/ui/pill";
import { VolumeChart } from "@/components/volume-chart";
import { useAlerts, useEventVolume } from "@/lib/hooks/use-cloudmon-api";

/**
 * Dashboard home — Phase 2.
 *
 * Two live panels powered by SWR with empty / error / refreshing states
 * owned by `ApiResultPanel`, plus a brand header that surfaces the polling
 * cadence and a stats strip summarizing the current alert mix.
 */
export default function HomePage(): React.JSX.Element {
  const volume = useEventVolume();
  const alerts = useAlerts();

  const buckets = volume.data?.buckets ?? [];
  const alertList = alerts.data?.alerts ?? [];

  const criticalCount = alertList.filter((alert) => alert.severity === "critical").length;
  const errorCount = alertList.filter((alert) => alert.severity === "error").length;
  const warningCount = alertList.filter((alert) => alert.severity === "warning").length;

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 p-6 pb-24 sm:p-10">
      <PageHeader />

      <section className="flex flex-wrap items-center gap-2 text-xs">
        <Pill tone="zinc" label={`${alertList.length} total`} />
        {criticalCount > 0 ? <Pill tone="red" label={`${criticalCount} critical`} icon={Icons.critical} /> : null}
        {errorCount > 0 ? <Pill tone="orange" label={`${errorCount} error`} icon={Icons.error} /> : null}
        {warningCount > 0 ? <Pill tone="amber" label={`${warningCount} warning`} icon={Icons.warning} /> : null}
        <span className="ml-auto font-mono text-[11px] text-zinc-500">polling every 3s</span>
      </section>

      <ApiResultPanel
        title="Event volume"
        endpoint="GET /events/volume"
        hasError={Boolean(volume.error)}
        errorMessage={volume.error?.message}
        isLoading={volume.isLoading}
        isValidating={volume.isValidating}
        isEmpty={!volume.isLoading && buckets.every((bucket) => bucket.count === 0)}
        emptyMessage="No events ingested in the visible window yet."
      >
        <VolumeChart buckets={buckets} />
      </ApiResultPanel>

      <ApiResultPanel
        title="Alerts"
        endpoint="GET /alerts"
        hasError={Boolean(alerts.error)}
        errorMessage={alerts.error?.message}
        isLoading={alerts.isLoading}
        isValidating={alerts.isValidating}
        isEmpty={!alerts.isLoading && alertList.length === 0}
        emptyMessage="No anomalies detected."
      >
        <AlertList alerts={alertList} />
      </ApiResultPanel>
    </main>
  );
}

function PageHeader(): React.JSX.Element {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
          <Icons.brand className="h-5 w-5" aria-hidden strokeWidth={2.25} />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-50">CloudMon</h1>
          <p className="text-xs text-zinc-500">
            Real-time event monitoring with AI-powered anomaly explanations.
          </p>
        </div>
      </div>
      <Pill tone="emerald" label="live" dot pulse />
    </header>
  );
}
