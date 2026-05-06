/**
 * Runtime configuration loaded from `NEXT_PUBLIC_*` environment variables.
 *
 * All values are validated at module load so misconfiguration surfaces
 * immediately instead of as cryptic fetch errors at runtime. Defaults are
 * intentionally absent for the API base URL — the dashboard refuses to start
 * without a deliberate choice. This keeps prod-deploys honest.
 */

/** Polling interval for live data, in milliseconds. */
export const POLLING_INTERVAL_MS = 3_000;

/** Timeout for a single API request, in milliseconds. */
export const REQUEST_TIMEOUT_MS = 8_000;

/**
 * Base URL of the CloudMon read API, without a trailing slash.
 *
 * Set `NEXT_PUBLIC_API_URL` in `.env.local` (development) or as a build-time
 * environment variable (CI / Vercel) to the deployed API Gateway endpoint,
 * e.g. `https://3kwuojzcc3.execute-api.us-east-1.amazonaws.com`.
 */
export function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set. Copy dashboard/.env.example to " +
        "dashboard/.env.local and point it at the deployed read API.",
    );
  }
  return raw.replace(/\/+$/, "");
}
