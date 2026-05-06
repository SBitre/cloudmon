"use client";

/**
 * Ephemeral view-state filters.
 *
 * Lives separately from `lib/store/settings` because filters are *view*
 * state (what slice of data am I looking at right now) rather than
 * *configuration* (how do I want the dashboard to behave). This keeps
 * the persistence story clean: settings persist across reloads,
 * filters reset on every load. Nothing more confusing than reloading
 * the dashboard and wondering why "no alerts" — when actually a stale
 * filter from yesterday is still active.
 *
 * Storage: in-memory only, useSyncExternalStore-driven, SSR-safe.
 */
import { useSyncExternalStore } from "react";

import type { Severity } from "@/lib/types/api";

export interface FilterState {
  /** Severity levels currently visible. Empty array hides all alerts. */
  readonly severity: ReadonlyArray<Severity>;
  /** Service names to filter by. Empty array means show all services. */
  readonly services: ReadonlyArray<string>;
  /** Anomaly types to filter by. Empty array means show all anomaly types. */
  readonly anomalyTypes: ReadonlyArray<string>;
  /** ISO 8601 minute bucket (e.g. "2026-05-06T01:00:00Z") to scope alerts to. */
  readonly minute: string | null;
}

const DEFAULTS: FilterState = {
  severity: ["info", "warning", "error", "critical"],
  services: [],
  anomalyTypes: [],
  minute: null,
};

const SUBSCRIBERS = new Set<() => void>();
let CURRENT: FilterState = DEFAULTS;

function notify(): void {
  for (const subscriber of SUBSCRIBERS) {
    subscriber();
  }
}

function subscribe(subscriber: () => void): () => void {
  SUBSCRIBERS.add(subscriber);
  return () => {
    SUBSCRIBERS.delete(subscriber);
  };
}

function getSnapshot(): FilterState {
  return CURRENT;
}

function getServerSnapshot(): FilterState {
  return DEFAULTS;
}

export function useFilters(): FilterState;
export function useFilters<T>(selector: (state: FilterState) => T): T;
export function useFilters<T>(selector?: (state: FilterState) => T): FilterState | T {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return selector ? selector(state) : state;
}

/** Replace one or more keys. */
export function setFilters(patch: Partial<FilterState>): void {
  CURRENT = { ...CURRENT, ...patch };
  notify();
}

/** Toggle a value within a multi-select filter. */
export function toggleFilter<K extends "severity" | "services" | "anomalyTypes">(
  key: K,
  value: FilterState[K] extends ReadonlyArray<infer V> ? V : never,
): void {
  const current = CURRENT[key] as ReadonlyArray<unknown>;
  const next = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];
  CURRENT = { ...CURRENT, [key]: next } as FilterState;
  notify();
}

/** Restore default (all severities visible, no other filters). */
export function resetFilters(): void {
  CURRENT = DEFAULTS;
  notify();
}

/** True when at least one non-default filter is active. */
export function hasActiveFilters(state: FilterState): boolean {
  return (
    state.severity.length !== DEFAULTS.severity.length ||
    state.services.length > 0 ||
    state.anomalyTypes.length > 0 ||
    state.minute !== null
  );
}
