"use client";

import { useEffect, useState } from "react";

import { AlertList, countVisibleAlerts } from "@/components/alert-list";
import { ApiResultPanel } from "@/components/api-result-panel";
import { LeaderboardChart } from "@/components/charts/leaderboard-charts";
import { SeverityDonut } from "@/components/charts/severity-donut";
import { DefaultErrorFallback, ErrorBoundary } from "@/components/error-boundary";
import { FacetFilterStrip } from "@/components/facet-filter-strip";
import { KpiStrip } from "@/components/kpi-strip";
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
import { topAnomalyTypes, topServices } from "@/lib/derive/alerts";
import { formatLocalDateTime } from "@/lib/format/time";
import { hasActiveFilters, resetFilters, setFilters, useFilters } from "@/lib/store/filters";
import { useSettings } from "@/lib/store/settings";

/**
 * Dashboard home — strategic ops layout.
 *
 *   Header  · brand · trigger menu · settings · theme toggle
 *   KPI strip                                · 6 tiles
 *   Charts row                               · volume (lg col-span-2) · severity donut · leaderboards
 *   Filter strips                            · severity · services · anomaly types · clear all
 *   Alert list                               · full width below
 *
 * Charts are derived client-side from the alerts list — no extra API
 * calls. Filters are ephemeral (per-session), severity persists for
 * convenience but resets to all-on by default.
 */
export default function HomePage(): React.JSX.Element {
  const volume = useEventVolume();
  const alerts = useAlerts();

  const buckets = volume.data?.buckets ?? [];
  const alertList = alerts.data?.alerts ?? [];

  const filters = useFilters();
  const visibleAlertCount = countVisibleAlerts(alertList, filters);
  const filtersActive = hasActiveFilters(filters);

  // Drive the relative-time labels in the KPI tile via a once-a-second tick.
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 pb-24 pt-6 sm:px-8 sm:pt-10">
        <PageHeader />

        <KpiStrip alerts={alertList} buckets={buckets} nowMs={nowMs} />

        <main id="main-content" className="flex flex-col gap-4">
          <ChartsRow volume={volume} alerts={alerts} buckets={buckets} alertList={alertList} />

          <FilterBar alerts={alertList} filtersActive={filtersActive} />

          <ErrorBoundary
            resetKey={String(alerts.lastUpdatedAt ?? "init")}
            fallback={(error, reset) => <DefaultErrorFallback error={error} reset={reset} />}
          >
            <ApiResultPanel
              sectionId="alerts"
              title="Alerts"
              hasError={Boolean(alerts.error)}
              errorMessage={alerts.error?.message}
              isLoading={alerts.isLoading}
              isValidating={alerts.isValidating}
              isStale={alerts.isStale}
              isEmpty={!alerts.isLoading && visibleAlertCount === 0}
              emptyMessage={
                alertList.length > 0
                  ? "All alerts are filtered out — clear filters above to see more."
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

interface ChartsRowProps {
  readonly volume: ReturnType<typeof useEventVolume>;
  readonly alerts: ReturnType<typeof useAlerts>;
  readonly buckets: readonly import("@/lib/types/api").VolumeBucket[];
  readonly alertList: readonly import("@/lib/types/api").Alert[];
}

function ChartsRow({ volume, alerts, buckets, alertList }: ChartsRowProps): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <ErrorBoundary
          resetKey={String(volume.lastUpdatedAt ?? "init")}
          fallback={(error, reset) => <DefaultErrorFallback error={error} reset={reset} />}
        >
          <ApiResultPanel
            sectionId="event-volume"
            title="Event volume"
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
            headerActions={<MinuteSelectionPill />}
          >
            <VolumeChart buckets={buckets} />
          </ApiResultPanel>
        </ErrorBoundary>
      </div>

      <ErrorBoundary
        resetKey={String(alerts.lastUpdatedAt ?? "init")}
        fallback={(error, reset) => <DefaultErrorFallback error={error} reset={reset} />}
      >
        <ApiResultPanel
          title="Breakdown"
          hasError={Boolean(alerts.error)}
          errorMessage={alerts.error?.message}
          isLoading={alerts.isLoading}
          isValidating={alerts.isValidating}
          isStale={alerts.isStale}
          isEmpty={!alerts.isLoading && alertList.length === 0}
          emptyMessage="No alerts to break down yet."
          loadingFallback={<BreakdownSkeleton />}
          ariaLive="off"
        >
          <div className="flex flex-col gap-4">
            <SeverityDonut alerts={alertList} />
            <LeaderboardChart
              title="Top services"
              data={topServices(alertList, 5)}
              emptyMessage="No alerts grouped by service yet."
            />
            <LeaderboardChart
              title="Top anomaly types"
              data={topAnomalyTypes(alertList, 5)}
              emptyMessage="No alerts grouped by anomaly type yet."
            />
          </div>
        </ApiResultPanel>
      </ErrorBoundary>
    </div>
  );
}

function MinuteSelectionPill(): React.JSX.Element | null {
  const minute = useFilters((s) => s.minute);
  if (!minute) {
    return null;
  }
  return (
    <button
      type="button"
      onClick={() => setFilters({ minute: null })}
      className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-warning)]/40 bg-[color:var(--color-warning-soft)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[color:var(--color-warning)] transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
      aria-label={`Clear minute filter (${formatLocalDateTime(minute)})`}
      title="Clear minute filter"
    >
      <span>at {formatLocalDateTime(minute)}</span>
      <span aria-hidden>×</span>
    </button>
  );
}

interface FilterBarProps {
  readonly alerts: readonly import("@/lib/types/api").Alert[];
  readonly filtersActive: boolean;
}

function FilterBar({ alerts, filtersActive }: FilterBarProps): React.JSX.Element {
  return (
    <section
      aria-label="Filters"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1"
    >
      <SeverityFilterStrip alerts={alerts} />
      <FacetFilterStrip alerts={alerts} facet="services" label="Services" />
      <FacetFilterStrip alerts={alerts} facet="anomalyTypes" label="Anomaly types" />
      {filtersActive ? (
        <button
          type="button"
          onClick={() => resetFilters()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-stroke bg-surface px-2.5 py-1 text-[11px] font-medium text-fg-muted transition hover:bg-surface-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
        >
          <Icons.refresh className="h-3 w-3" aria-hidden strokeWidth={2.25} />
          Clear filters
        </button>
      ) : null}
    </section>
  );
}

function PageHeader(): React.JSX.Element {
  const polling = useSettings((s) => s.pollingIntervalMs);
  const cadence = polling === "off" ? "polling paused" : `polling every ${polling / 1000}s`;
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
        <span className="hidden font-mono text-[11px] text-fg-subtle md:inline">{cadence}</span>
        <TriggerScenarioMenu />
        <SettingsMenu />
        <ThemeToggle />
      </div>
    </header>
  );
}

function BreakdownSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-32 w-full animate-pulse rounded-md bg-surface-elevated" />
      <div className="h-24 w-full animate-pulse rounded-md bg-surface-elevated" />
      <div className="h-24 w-full animate-pulse rounded-md bg-surface-elevated" />
    </div>
  );
}

function PageFooter(): React.JSX.Element {
  const polling = useSettings((s) => s.pollingIntervalMs);
  const cadence = polling === "off" ? "polling paused" : `polling every ${polling / 1000}s`;
  return (
    <footer className="mt-auto border-t border-stroke pt-4 text-[11px] text-fg-subtle">
      <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span>CloudMon · real-time event monitoring</span>
        <span className="font-mono">{cadence}</span>
      </p>
    </footer>
  );
}
