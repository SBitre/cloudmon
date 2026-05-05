/**
 * Strongly-typed HTTP client for the CloudMon read API.
 *
 * Responsibilities:
 * - Compose URLs from the configured base URL.
 * - Apply a per-request timeout via `AbortController`.
 * - Surface non-2xx responses as a domain-specific `ApiError` so consumers
 *   (hooks, components, error boundaries) can distinguish HTTP failures from
 *   network failures and JSON-parse failures.
 *
 * This module deliberately knows nothing about React or SWR; that allows it
 * to be unit-tested in isolation and reused from server components, route
 * handlers, or scripts.
 */
import { REQUEST_TIMEOUT_MS, getApiBaseUrl } from "@/lib/config";
import type { AlertsResponse, EventsVolumeResponse } from "@/lib/types/api";

/**
 * Error thrown for any non-2xx response or network failure.
 *
 * `status` is `0` when the request never produced a response (network error,
 * timeout, CORS rejection, etc.); otherwise it carries the HTTP status code.
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly path: string;

  constructor(message: string, status: number, path: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.path = path;
  }
}

/**
 * Internal fetch helper with timeout + JSON decoding + error normalization.
 *
 * Generic over the expected response payload `T`. The caller is responsible
 * for picking the correct type; runtime shape validation is intentionally
 * out of scope here (the read API contract is enforced by the schema doc and
 * the Lambda's tests).
 */
async function getJson<T>(path: string): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (cause) {
    clearTimeout(timer);
    const message = cause instanceof Error ? cause.message : "network error";
    throw new ApiError(`Request to ${path} failed: ${message}`, 0, path);
  }
  clearTimeout(timer);

  if (!response.ok) {
    throw new ApiError(
      `Request to ${path} failed with HTTP ${response.status}`,
      response.status,
      path,
    );
  }

  try {
    return (await response.json()) as T;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "invalid JSON";
    throw new ApiError(`Response from ${path} was not valid JSON: ${message}`, response.status, path);
  }
}

/** Fetch the per-minute event volume buckets from `GET /events/volume`. */
export function fetchEventsVolume(): Promise<EventsVolumeResponse> {
  return getJson<EventsVolumeResponse>("/events/volume");
}

/** Fetch the most recent alerts from `GET /alerts`. */
export function fetchAlerts(): Promise<AlertsResponse> {
  return getJson<AlertsResponse>("/alerts");
}
