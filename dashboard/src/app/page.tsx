"use client";

import { AlertList } from "@/components/alert-list";
import { ApiResultPanel } from "@/components/api-result-panel";
import { DefaultErrorFallback, ErrorBoundary } from "@/components/error-boundary";
import { SettingsMenu } from "@/components/settings-menu";
import { SeverityFilterStrip } from "@/components/severity-filter-strip";
import { AlertListSkeleton } from "@/components/skeletons/alert-list-skeleton";
import { ChartSkeleton } from "@/components/skeletons/chart-skeleton";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { TriggerScenarioMenu } from "@/components/trigger-scenario-menu";
import { Icons } from "@/components/ui/icons";
import { Pill } from "@/components/ui/pill";
import { VolumeChart } from "@/components/volume-chart";
import { useAlerts, useEventVolume } from "@/lib/hooks/use-cloudmon-api";
import { useSettings } from "@/lib/store/settings";

/**
 * Dashboard home.
 *
 * Composition (no fetching, no business logic — only wiring):
 *   - Skip-to-content link.
 *   - Sticky brand header with theme toggle, settings, and trigger menu.
 *   - Severity filter strip + polling cadence label.
 *   - Volume panel (chart + skeleton + retry + stale indicator).
 *   - Alerts panel (list + skeleton + retry + stale indicator).
 *
 * Each panel is wrapped in an `ErrorBoundary` so a render-time crash in
 * one panel does not blank the whole dashboard.
 */
export default function HomePage(): React.JSX.Element {
  const volume = useEventVolume();
  const alerts = useAlerts();

  const buckets = volume.data?.buckets ?? [];
  const alertList = alerts.data?.alerts ?? [];
  const filtered = useFilteredAlerts(alertList);

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 pb-24 pt-6 sm:px-8 sm:pt-10">
        <PageHeader />

        <SeverityFilterStripSection alerts={alertList} />

        <main id="main-content" className="flex flex-col gap-6">
          <ErrorBoundary
            resetKey={String(volume.lastUpdatedAt ?? "init")}
            fallback={(error, reset) => <DefaultErrorFallback error={error} reset={reset} />}
          >
            <ApiResultPanel
              sectionId="event-volume"
              title="Event volume"
              endpoint="GET /events/volume"
              hasError={Boolean(volume.error)}
              errorMessage={volume.error?.message}
              isLoading={volume.isLoading}
              isValidating={volume.isValidating}
              isStale={volume.isStale}
              isEmpty={!volume.isLoading && buckets.every((bucket) => bucket.count === 0)}
              emptyMessage="No events ingested in the visible window yet."
              loadingFallback={<ChartSkeleton />}
              onRetry={() => void volume.refresh()}
              ariaLive="off"
            >
              <VolumeChart buckets={buckets} />
            </ApiResultPanel>
          </ErrorBoundary>

          <ErrorBoundary
            resetKey={String(alerts.lastUpdatedAt ?? "init")}
            fallback={(error, reset) => <DefaultErrorFallback error={error} reset={reset} />}
          >
            <ApiResultPanel
              sectionId="alerts"
              title="Alerts"
              endpoint="GET /alerts"
              hasError={Boolean(alerts.error)}
              errorMessage={alerts.error?.message}
              isLoading={alerts.isLoading}
              isValidating={alerts.isValidating}
              isStale={alerts.isStale}
              isEmpty={!alerts.isLoading && filtered.length === 0}
              emptyMessage={
                alertList.length > 0
                  ? "All alerts are filtered out — check the severity filter above."
                  : "No anomalies detected."
              }
              loadingFallback={<AlertListSkeleton />}
              onRetry={() => void alerts.refresh()}
              ariaLive="polite"
            >
              <AlertList alerts={alertList} />
            </ApiResultPanel>
          </ErrorBoundary>
        </main>

        <PageFooter />
      </div>
    </>
  );
}

function PageHeader(): React.JSX.Element {
  return (
    <header className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-4 border-b border-stroke bg-[color:var(--color-surface-overlay)] px-4 pb-5 pt-4 backdrop-blur-md sm:-mx-8 sm:px-8">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-accent/40 bg-[color:var(--color-accent-soft)] text-accent"
          aria-hidden
        >
          <Icons.brand className="h-5 w-5" strokeWidth={2.25} />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-fg">CloudMon</h1>
          <p className="hidden text-xs text-fg-subtle sm:block">
            Real-time event monitoring with AI-powered anomaly explanations.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="accent" label="live" dot pulse />
        <TriggerScenarioMenu />
        <SettingsMenu />
        <ThemeToggle />
      </div>
    </header>
  );
}

function SeverityFilterStripSection({ alerts }: { readonly alerts: readonly import("@/lib/types/api").Alert[] }): React.JSX.Element {
  const polling = useSettings((s) => s.pollingIntervalMs);
  const cadence = polling === "off" ? "polling paused" : `polling every ${polling / 1000}s`;
  return (
    <section aria-label="Alert summary" className="flex flex-wrap items-center gap-2 text-xs">
      <SeverityFilterStrip alerts={alerts} />
      <span className="ml-auto font-mono text-[11px] text-fg-subtle">{cadence}</span>
    </section>
  );
}

function PageFooter(): React.JSX.Element {
  return (
    <footer className="mt-auto border-t border-stroke pt-4 text-[11px] text-fg-subtle">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>CloudMon dashboard</span>
        <span aria-hidden>·</span>
        <a
          href="https://github.com/SBitre/cloudmon"
          className="rounded text-fg-muted underline-offset-2 transition hover:text-fg hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
          target="_blank"
          rel="noopener noreferrer"
        >
          source
        </a>
        <span aria-hidden>·</span>
        <span>read API + ingest API on AWS</span>
      </p>
    </footer>
  );
}

function useFilteredAlerts(alerts: readonly import("@/lib/types/api").Alert[]): readonly import("@/lib/types/api").Alert[] {
  const severityFilter = useSettings((s) => s.severityFilter);
  return alerts.filter((alert) => severityFilter.includes(alert.severity));
}
