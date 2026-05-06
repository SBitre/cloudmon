/**
 * Re-export the canonical wire-level types.
 *
 * Backwards-compatible barrel: existing components import
 * `{ Alert, AlertsResponse, ... } from "@/lib/types/api"`. The runtime
 * schemas live in `schemas.ts`; this file re-exports the inferred TS
 * types so runtime + compile-time stay in lockstep.
 */
export type {
  Alert,
  AlertsResponse,
  EventsVolumeResponse,
  Severity,
  TriggeringEvent,
  VolumeBucket,
} from "@/lib/types/schemas";
