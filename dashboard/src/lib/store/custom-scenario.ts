"use client";

/**
 * Persistent form state for the user's "Custom scenario" definition.
 *
 * Lives outside the settings store on purpose: it's only consumed by the
 * trigger menu, so a dedicated hook keeps the public settings API
 * focused on dashboard chrome (polling / window / density / accent /
 * filter) rather than ballooning into a config dump.
 *
 * Storage: localStorage key `cloudmon.custom_scenario.v1`. SSR-safe via
 * `useSyncExternalStore` (returns defaults on the server and during the
 * initial client paint before hydration finishes).
 */
import { useSyncExternalStore } from "react";

import type { Severity } from "@/lib/types/api";

export const SUPPORTED_EVENT_TYPES = [
  "successful_login",
  "failed_login",
  "api_call",
  "api_error",
  "payment_success",
  "payment_failed",
  "traffic_spike",
] as const;
export type SupportedEventType = (typeof SUPPORTED_EVENT_TYPES)[number];

export const SEVERITIES: ReadonlyArray<Severity> = ["info", "warning", "error", "critical"];

export interface CustomScenarioConfig {
  readonly eventType: SupportedEventType;
  readonly service: string;
  readonly severity: Severity;
  readonly endpoint: string;
  readonly statusCode: string; // free-text in the form so empty stays empty
  readonly ipAddress: string;
  readonly userId: string;
  readonly errorMessage: string;
}

const DEFAULTS: CustomScenarioConfig = {
  eventType: "api_call",
  service: "checkout-service",
  severity: "info",
  endpoint: "",
  statusCode: "",
  ipAddress: "",
  userId: "",
  errorMessage: "",
};

const STORAGE_KEY = "cloudmon.custom_scenario.v1";
const SUBSCRIBERS = new Set<() => void>();
let CURRENT: CustomScenarioConfig = DEFAULTS;
let HYDRATED = false;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function isSupportedEventType(value: unknown): value is SupportedEventType {
  return typeof value === "string" && SUPPORTED_EVENT_TYPES.includes(value as SupportedEventType);
}

function isSeverity(value: unknown): value is Severity {
  return value === "info" || value === "warning" || value === "error" || value === "critical";
}

function read(): CustomScenarioConfig {
  if (!isBrowser()) {
    return DEFAULTS;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULTS;
    }
    const parsed = JSON.parse(raw) as Partial<CustomScenarioConfig> | null;
    if (!parsed || typeof parsed !== "object") {
      return DEFAULTS;
    }
    return {
      eventType: isSupportedEventType(parsed.eventType) ? parsed.eventType : DEFAULTS.eventType,
      service: typeof parsed.service === "string" ? parsed.service : DEFAULTS.service,
      severity: isSeverity(parsed.severity) ? parsed.severity : DEFAULTS.severity,
      endpoint: typeof parsed.endpoint === "string" ? parsed.endpoint : DEFAULTS.endpoint,
      statusCode: typeof parsed.statusCode === "string" ? parsed.statusCode : DEFAULTS.statusCode,
      ipAddress: typeof parsed.ipAddress === "string" ? parsed.ipAddress : DEFAULTS.ipAddress,
      userId: typeof parsed.userId === "string" ? parsed.userId : DEFAULTS.userId,
      errorMessage: typeof parsed.errorMessage === "string" ? parsed.errorMessage : DEFAULTS.errorMessage,
    };
  } catch {
    return DEFAULTS;
  }
}

function write(value: CustomScenarioConfig): void {
  if (!isBrowser()) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* localStorage unavailable; fall through silently. */
  }
}

function notify(): void {
  for (const subscriber of SUBSCRIBERS) {
    subscriber();
  }
}

function ensureHydrated(): void {
  if (HYDRATED || !isBrowser()) {
    return;
  }
  HYDRATED = true;
  CURRENT = read();
  notify();
}

function subscribe(subscriber: () => void): () => void {
  ensureHydrated();
  SUBSCRIBERS.add(subscriber);
  return () => {
    SUBSCRIBERS.delete(subscriber);
  };
}

function getSnapshot(): CustomScenarioConfig {
  return CURRENT;
}

function getServerSnapshot(): CustomScenarioConfig {
  return DEFAULTS;
}

export function useCustomScenario(): CustomScenarioConfig {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setCustomScenario(patch: Partial<CustomScenarioConfig>): void {
  ensureHydrated();
  CURRENT = { ...CURRENT, ...patch };
  write(CURRENT);
  notify();
}

export function resetCustomScenario(): void {
  CURRENT = DEFAULTS;
  write(CURRENT);
  notify();
}

export function getCustomScenarioSnapshot(): CustomScenarioConfig {
  ensureHydrated();
  return CURRENT;
}
