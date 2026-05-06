/**
 * Browser-side ingest client for the demo "Trigger scenario" button.
 *
 * Mirrors the Python simulator's wire contract (`docs/event-schema.md`)
 * but stays minimal: no retries, no circuit breaker — those belong in the
 * Python simulator that drives serious workloads. This client is for the
 * dashboard's interactive demo affordance only.
 */
import { utcNowIso8601 } from "@/lib/format/time";
import type { Severity } from "@/lib/types/api";

/** The minimum fields required by the ingest Lambda. */
export interface SyntheticEvent {
  readonly event_id: string;
  readonly timestamp: string;
  readonly service: string;
  readonly event_type: string;
  readonly severity: Severity;
  readonly user_id?: string;
  readonly ip_address?: string;
  readonly endpoint?: string;
  readonly status_code?: number;
  readonly error_message?: string;
}

/** Resolve the configured ingest URL. Throws if not set. */
function getIngestUrl(): string {
  const raw = process.env.NEXT_PUBLIC_INGEST_URL?.trim();
  if (!raw) {
    throw new Error(
      "NEXT_PUBLIC_INGEST_URL is not set. Add it to dashboard/.env.local " +
        "to enable the demo Trigger Scenario button.",
    );
  }
  return raw.replace(/\/+$/, "");
}

/** Whether the trigger feature is wired up (ingest URL present). */
export function isTriggerEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_INGEST_URL?.trim());
}

/** POST one event to the ingest API. Throws on non-2xx. Honors `AbortSignal`. */
export async function postEvent(event: SyntheticEvent, signal?: AbortSignal): Promise<void> {
  const response = await fetch(getIngestUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
    signal,
  });
  if (!response.ok) {
    throw new Error(`POST /events failed with HTTP ${response.status}`);
  }
}

/**
 * Generate a UUID v4 using the platform Web Crypto API.
 *
 * Falls back to a non-cryptographic random string only if `crypto.randomUUID`
 * is unavailable; modern browsers ship it (Chrome 92+, Firefox 95+, Safari 15.4+).
 */
export function newEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `evt-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

/** Re-export so all event-construction helpers live in one module. */
export { utcNowIso8601 };
