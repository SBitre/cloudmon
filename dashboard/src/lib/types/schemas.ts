/**
 * Runtime schemas for the CloudMon read API.
 *
 * Zod schemas double as TypeScript types via `z.infer<>` so the wire
 * contract has exactly one source of truth — no chance of the static type
 * drifting from the runtime validator. Validation runs at the network
 * boundary in `lib/api/client.ts`; if the upstream API ships malformed
 * data (a missing field, a stray null, a renamed key), we surface a
 * structured `ApiError` with the full Zod issue trail instead of
 * rendering corrupted UI.
 */
import { z } from "zod";

export const SeveritySchema = z.enum(["info", "warning", "error", "critical"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const VolumeBucketSchema = z.object({
  minute: z.string(),
  count: z.number().int().nonnegative(),
});
export type VolumeBucket = z.infer<typeof VolumeBucketSchema>;

export const EventsVolumeResponseSchema = z.object({
  buckets: z.array(VolumeBucketSchema),
});
export type EventsVolumeResponse = z.infer<typeof EventsVolumeResponseSchema>;

/**
 * Triggering events have a permissive shape because the detection Lambda
 * forwards whatever was on the original event. We require only the fields
 * the dashboard actually renders; everything else is optional.
 */
export const TriggeringEventSchema = z.object({
  event_id: z.string(),
  timestamp: z.string(),
  service: z.string(),
  event_type: z.string(),
  severity: SeveritySchema,
  user_id: z.string().optional(),
  ip_address: z.string().optional(),
  endpoint: z.string().optional(),
  status_code: z.number().int().optional(),
  error_message: z.string().optional(),
});
export type TriggeringEvent = z.infer<typeof TriggeringEventSchema>;

export const AlertSchema = z.object({
  alert_id: z.string(),
  timestamp: z.string(),
  service: z.string(),
  anomaly_type: z.string(),
  severity: SeveritySchema,
  explanation: z.string().default(""),
  recommended_actions: z.array(z.string()).default([]),
  triggering_events: z.array(TriggeringEventSchema).default([]),
});
export type Alert = z.infer<typeof AlertSchema>;

export const AlertsResponseSchema = z.object({
  alerts: z.array(AlertSchema),
});
export type AlertsResponse = z.infer<typeof AlertsResponseSchema>;
