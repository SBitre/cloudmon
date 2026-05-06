"use client";

import { useSyncExternalStore } from "react";

/**
 * Project-local settings store.
 *
 * One typed store, persisted to `localStorage`, SSR-safe (returns
 * defaults during server render and during the initial client paint
 * before hydration finishes), reactive across components via
 * `useSyncExternalStore`.
 *
 * Why hand-rolled instead of `zustand` / `jotai` / Redux:
 *   - Tiny surface area (5 keys), zero need for middleware.
 *   - Avoid yet another npm dep + provider in the layout.
 *   - `useSyncExternalStore` is the idiomatic React 18+ primitive for
 *     external stores; behaves correctly under concurrent rendering.
 */

export type PollingInterval = "off" | 1000 | 3000 | 5000 | 10000;
export type VolumeWindowMinutes = 15 | 30 | 60 | 120;
export type Density = "comfortable" | "compact";
export type Accent = "emerald" | "blue" | "violet" | "amber";

export interface Settings {
  /** SWR refresh interval. `"off"` disables polling. */
  readonly pollingIntervalMs: PollingInterval;
  /** Number of trailing minute buckets the volume chart renders. */
  readonly volumeWindowMinutes: VolumeWindowMinutes;
  /** Card padding density. */
  readonly density: Density;
  /** Accent color tone (drives `--color-accent*` CSS vars). */
  readonly accent: Accent;
}

const DEFAULTS: Settings = {
  pollingIntervalMs: 3000,
  volumeWindowMinutes: 30,
  density: "comfortable",
  accent: "emerald",
};

const STORAGE_KEY = "cloudmon.settings.v1";
const SUBSCRIBERS = new Set<() => void>();
let CURRENT: Settings = DEFAULTS;
let HYDRATED = false;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function read(): Settings {
  if (!isBrowser()) {
    return DEFAULTS;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULTS;
    }
    const parsed = JSON.parse(raw) as Partial<Settings> | null;
    if (!parsed || typeof parsed !== "object") {
      return DEFAULTS;
    }
    return {
      pollingIntervalMs: isPollingInterval(parsed.pollingIntervalMs)
        ? parsed.pollingIntervalMs
        : DEFAULTS.pollingIntervalMs,
      volumeWindowMinutes: isVolumeWindow(parsed.volumeWindowMinutes)
        ? parsed.volumeWindowMinutes
        : DEFAULTS.volumeWindowMinutes,
      density: isDensity(parsed.density) ? parsed.density : DEFAULTS.density,
      accent: isAccent(parsed.accent) ? parsed.accent : DEFAULTS.accent,
    };
  } catch {
    return DEFAULTS;
  }
}

function write(value: Settings): void {
  if (!isBrowser()) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* localStorage may be unavailable (private mode); fall through silently. */
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

function getSnapshot(): Settings {
  return CURRENT;
}

function getServerSnapshot(): Settings {
  return DEFAULTS;
}

/**
 * React hook. Pass an optional selector to subscribe only to a slice of
 * the settings tree (matches the zustand convention).
 */
export function useSettings(): Settings;
export function useSettings<T>(selector: (state: Settings) => T): T;
export function useSettings<T>(selector?: (state: Settings) => T): Settings | T {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return selector ? selector(state) : state;
}

/** Imperative setter — replaces one or more keys and persists the result. */
export function setSettings(patch: Partial<Settings>): void {
  ensureHydrated();
  CURRENT = { ...CURRENT, ...patch };
  write(CURRENT);
  notify();
}

/** Reset to factory defaults. */
export function resetSettings(): void {
  CURRENT = DEFAULTS;
  write(CURRENT);
  notify();
}

/** Read defaults without subscribing (used by the settings UI to render reset state). */
export function getDefaults(): Settings {
  return DEFAULTS;
}

// --- Type guards --------------------------------------------------------

function isPollingInterval(value: unknown): value is PollingInterval {
  return value === "off" || value === 1000 || value === 3000 || value === 5000 || value === 10000;
}

function isVolumeWindow(value: unknown): value is VolumeWindowMinutes {
  return value === 15 || value === 30 || value === 60 || value === 120;
}

function isDensity(value: unknown): value is Density {
  return value === "comfortable" || value === "compact";
}

function isAccent(value: unknown): value is Accent {
  return value === "emerald" || value === "blue" || value === "violet" || value === "amber";
}
