"use client";

import { ApiResultPanel } from "@/components/api-result-panel";
import { useAlerts, useEventVolume } from "@/lib/hooks/use-cloudmon-api";
import type { AlertsResponse, EventsVolumeResponse } from "@/lib/types/api";

/**
 * Phase 1 home page: proves end-to-end wiring against the deployed read API.
 *
 * Both endpoints are polled live via SWR; payloads are rendered as raw JSON
 * so we can visually confirm the contract before building richer
 * visualizations in Phase 2.
 */
export default function HomePage(): React.JSX.Element {
  const volume = useEventVolume();
  const alerts = useAlerts();

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-6 pb-24 sm:p-10">
      <header className="flex items-baseline justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">CloudMon Dashboard</h1>
          <p className="text-xs text-zinc-500">
            Phase 1: live wiring smoke test against the deployed read API.
          </p>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">live</span>
      </header>

      <ApiResultPanel<EventsVolumeResponse>
        title="Event volume"
        endpoint="GET /events/volume"
        data={volume.data}
        error={volume.error}
        isLoading={volume.isLoading}
        isValidating={volume.isValidating}
      />

      <ApiResultPanel<AlertsResponse>
        title="Alerts"
        endpoint="GET /alerts"
        data={alerts.data}
        error={alerts.error}
        isLoading={alerts.isLoading}
        isValidating={alerts.isValidating}
      />
    </main>
  );
}
