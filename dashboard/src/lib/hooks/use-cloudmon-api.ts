"use client";

/**
 * SWR hooks for the CloudMon read API.
 *
 * Both hooks share a uniform return shape that components can consume
 * without importing SWR types directly:
 *   - `lastUpdatedAt` — epoch ms of the last successful fetch.
 *   - `isStale`        — true when the last successful response is older
 *     than `max(2 * pollingInterval, MIN_STALE_MS)`. The minimum
 *     threshold prevents false stale flashes when the user drops the
 *     polling interval (e.g. 10s → 1s) faster than SWR can fire the
 *     next poll.
 *   - `refresh()`      — imperative refetch, used by Retry buttons.
 */
import { useEffect, useRef, useState } from "react";
import useSWR, { type SWRConfiguration } from "swr";

import { fetchAlerts, fetchEventsVolume } from "@/lib/api/client";
import { POLLING_INTERVAL_MS } from "@/lib/config";
import { useSettings } from "@/lib/store/settings";
import type { AlertsResponse, EventsVolumeResponse } from "@/lib/types/api";

interface LiveQueryResult<T> {
  readonly data: T | undefined;
  readonly error: Error | undefined;
  readonly isLoading: boolean;
  readonly isValidating: boolean;
  readonly lastUpdatedAt: number | undefined;
  readonly isStale: boolean;
  readonly refresh: () => Promise<unknown>;
}

const STATIC_OPTIONS: SWRConfiguration = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  keepPreviousData: true,
  shouldRetryOnError: true,
  errorRetryCount: 5,
};

const STALE_MULTIPLIER = 2;
const MIN_STALE_MS = 30_000;

function useLive<T>(
  key: string,
  fetcher: () => Promise<T>,
): LiveQueryResult<T> {
  const refreshInterval = useEffectivePollingInterval();
  const [, forceTick] = useState(0);
  const lastUpdatedRef = useRef<number | undefined>(undefined);

  const { data, error, isLoading, isValidating, mutate } = useSWR<T, Error>(
    key,
    fetcher,
    {
      ...STATIC_OPTIONS,
      refreshInterval,
      onSuccess: () => {
        lastUpdatedRef.current = Date.now();
        forceTick((n) => n + 1);
      },
    },
  );

  // When the user changes polling interval, treat the timer as just-reset
  // so we don't show a spurious "stale" pill in the gap before the next
  // poll fires at the new cadence.
  useEffect(() => {
    if (lastUpdatedRef.current !== undefined) {
      lastUpdatedRef.current = Date.now();
      forceTick((n) => n + 1);
    }
  }, [refreshInterval]);

  // Re-render every second while polling is active so the staleness
  // computation stays current. Cheap (one re-render per second) and
  // bounded (cleared on unmount and on switching to "off").
  useEffect(() => {
    if (refreshInterval <= 0) {
      return;
    }
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [refreshInterval]);

  const isStale = computeStale(lastUpdatedRef.current, refreshInterval);

  return {
    data,
    error,
    isLoading,
    isValidating,
    lastUpdatedAt: lastUpdatedRef.current,
    isStale,
    refresh: () => mutate(),
  };
}

function computeStale(lastUpdatedAt: number | undefined, refreshInterval: number): boolean {
  if (lastUpdatedAt === undefined || refreshInterval <= 0) {
    return false;
  }
  const threshold = Math.max(refreshInterval * STALE_MULTIPLIER, MIN_STALE_MS);
  return Date.now() - lastUpdatedAt > threshold;
}

function useEffectivePollingInterval(): number {
  const setting = useSettings((state) => state.pollingIntervalMs);
  if (setting === "off") {
    return 0;
  }
  if (typeof setting === "number" && setting > 0) {
    return setting;
  }
  return POLLING_INTERVAL_MS;
}

export function useEventVolume(): LiveQueryResult<EventsVolumeResponse> {
  return useLive<EventsVolumeResponse>("events/volume", fetchEventsVolume);
}

export function useAlerts(): LiveQueryResult<AlertsResponse> {
  return useLive<AlertsResponse>("alerts", fetchAlerts);
}
