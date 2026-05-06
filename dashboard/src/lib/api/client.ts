/**
 * Strongly-typed HTTP client for the CloudMon read API.
 *
 * Responsibilities:
 *   1. Compose URLs from the configured base URL.
 *   2. Apply a per-request timeout via `AbortController`.
 *   3. Surface non-2xx, network, and JSON-parse failures as a domain
 *      `ApiError` with stable error codes the UI can branch on.
 *   4. Validate every successful response against a Zod schema; reject
 *      malformed payloads as `ApiError` with code `invalid_payload`.
 *
 * This module deliberately knows nothing about React or SWR; that allows
 * it to be unit-tested in isolation and reused from server components,
 * route handlers, or scripts.
 */
import type { ZodSchema } from "zod";

import { REQUEST_TIMEOUT_MS, getApiBaseUrl } from "@/lib/config";
import {
  AlertsResponseSchema,
  EventsVolumeResponseSchema,
  type AlertsResponse,
  type EventsVolumeResponse,
} from "@/lib/types/schemas";

export type ApiErrorCode =
  | "network"
  | "timeout"
  | "http"
  | "invalid_json"
  | "invalid_payload"
  | "config";

/**
 * Domain error for the read-API client. Fields are stable so consumers
 * (panels, error boundaries, telemetry) can branch on them.
 */
export class ApiError extends Error {
  public readonly code: ApiErrorCode;
  public readonly status: number;
  public readonly path: string;
  public readonly cause?: unknown;

  constructor(params: {
    message: string;
    code: ApiErrorCode;
    status: number;
    path: string;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = "ApiError";
    this.code = params.code;
    this.status = params.status;
    this.path = params.path;
    this.cause = params.cause;
  }
}

async function getJson<T>(path: string, schema: ZodSchema<T>): Promise<T> {
  let baseUrl: string;
  try {
    baseUrl = getApiBaseUrl();
  } catch (cause) {
    throw new ApiError({
      message: cause instanceof Error ? cause.message : "missing API base URL",
      code: "config",
      status: 0,
      path,
      cause,
    });
  }

  const url = `${baseUrl}${path}`;
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
    const isAbort =
      cause instanceof DOMException && cause.name === "AbortError";
    throw new ApiError({
      message: isAbort
        ? `Request to ${path} timed out after ${REQUEST_TIMEOUT_MS}ms`
        : `Request to ${path} failed: ${cause instanceof Error ? cause.message : "network error"}`,
      code: isAbort ? "timeout" : "network",
      status: 0,
      path,
      cause,
    });
  }
  clearTimeout(timer);

  if (!response.ok) {
    throw new ApiError({
      message: `Request to ${path} failed with HTTP ${response.status}`,
      code: "http",
      status: response.status,
      path,
    });
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch (cause) {
    throw new ApiError({
      message: `Response from ${path} was not valid JSON`,
      code: "invalid_json",
      status: response.status,
      path,
      cause,
    });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError({
      message: `Response from ${path} did not match schema (${parsed.error.issues.length} issue${parsed.error.issues.length === 1 ? "" : "s"})`,
      code: "invalid_payload",
      status: response.status,
      path,
      cause: parsed.error,
    });
  }
  return parsed.data;
}

export function fetchEventsVolume(): Promise<EventsVolumeResponse> {
  return getJson("/events/volume", EventsVolumeResponseSchema);
}

export function fetchAlerts(): Promise<AlertsResponse> {
  return getJson("/alerts", AlertsResponseSchema);
}
