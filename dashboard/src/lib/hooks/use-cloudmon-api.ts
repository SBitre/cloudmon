/**
 * SWR hooks for the CloudMon read API.
 *
 * Both hooks share the same defaults:
 * - Live polling at `POLLING_INTERVAL_MS`.
 * - `keepPreviousData` so refetches do not blank the UI mid-demo.
 * - `revalidateOnFocus` so tabbing back to the dashboard refreshes
 *   immediately without waiting for the next poll tick.
 *
 * Returning a uniform `{ data, error, isLoading, isValidating }` shape keeps
 * components free of SWR-specific imports and makes it trivial to swap the
 * data layer later (e.g. to TanStack Query) without a UI rewrite.
 */
import useSWR, { type SWRConfiguration } from "swr";

import { fetchAlerts, fetchEventsVolume } from "@/lib/api/client";
import { POLLING_INTERVAL_MS } from "@/lib/config";
import type { AlertsResponse, EventsVolumeResponse } from "@/lib/types/api";

interface LiveQueryResult<T> {
  readonly data: T | undefined;
  readonly error: Error | undefined;
  readonly isLoading: boolean;
  readonly isValidating: boolean;
}

const SHARED_SWR_OPTIONS: SWRConfiguration = {
  refreshInterval: POLLING_INTERVAL_MS,
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  keepPreviousData: true,
  shouldRetryOnError: true,
  errorRetryCount: 5,
};

/** Live per-minute event volume buckets, polled every `POLLING_INTERVAL_MS`. */
export function useEventVolume(): LiveQueryResult<EventsVolumeResponse> {
  const { data, error, isLoading, isValidating } = useSWR<EventsVolumeResponse, Error>(
    "events/volume",
    fetchEventsVolume,
    SHARED_SWR_OPTIONS,
  );
  return { data, error, isLoading, isValidating };
}

/** Live alerts list, polled every `POLLING_INTERVAL_MS`. */
export function useAlerts(): LiveQueryResult<AlertsResponse> {
  const { data, error, isLoading, isValidating } = useSWR<AlertsResponse, Error>(
    "alerts",
    fetchAlerts,
    SHARED_SWR_OPTIONS,
  );
  return { data, error, isLoading, isValidating };
}
