"use client";

import { useEffect, useRef, useState } from "react";

import { ACCENT_PREVIEW_COLOR } from "@/components/theme/accent-applier";
import { Icons } from "@/components/ui/icons";
import {
  type Accent,
  type Density,
  type PollingInterval,
  type Settings,
  type VolumeWindowMinutes,
  resetSettings,
  setSettings,
  useSettings,
} from "@/lib/store/settings";

/**
 * Disclosure menu that surfaces the user-tunable settings (polling
 * interval, volume window, alert density, accent color).
 *
 * The store is hand-rolled (`lib/store/settings.ts`) and persists to
 * localStorage; this component is a thin presenter on top of it.
 */
const POLLING_OPTIONS: ReadonlyArray<{ value: PollingInterval; label: string }> = [
  { value: 1000, label: "1s" },
  { value: 3000, label: "3s" },
  { value: 5000, label: "5s" },
  { value: 10000, label: "10s" },
  { value: "off", label: "Off" },
];

const WINDOW_OPTIONS: ReadonlyArray<{ value: VolumeWindowMinutes; label: string }> = [
  { value: 15, label: "15m" },
  { value: 30, label: "30m" },
  { value: 60, label: "1h" },
  { value: 120, label: "2h" },
];

const DENSITY_OPTIONS: ReadonlyArray<{ value: Density; label: string }> = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
];

const ACCENT_OPTIONS: ReadonlyArray<{ value: Accent; label: string }> = [
  { value: "emerald", label: "Emerald" },
  { value: "blue", label: "Blue" },
  { value: "violet", label: "Violet" },
  { value: "amber", label: "Amber" },
];

export function SettingsMenu(): React.JSX.Element {
  const settings = useSettings();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onDocumentClick(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Settings"
        title="Settings"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-stroke bg-surface text-fg-muted transition hover:border-accent/40 hover:bg-surface-elevated hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
      >
        <Icons.settings className="h-4 w-4" aria-hidden strokeWidth={2.25} />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Dashboard settings"
          className="cloudmon-fade-in absolute right-0 z-20 mt-2 w-[20rem] rounded-xl border border-stroke bg-surface p-4 shadow-[var(--shadow-elevation-md)]"
        >
          <Section label="Polling interval">
            <SegmentedControl
              ariaLabel="Polling interval"
              value={settings.pollingIntervalMs}
              options={POLLING_OPTIONS}
              onChange={(v) => setSettings({ pollingIntervalMs: v })}
            />
          </Section>

          <Section label="Volume window">
            <SegmentedControl
              ariaLabel="Volume window"
              value={settings.volumeWindowMinutes}
              options={WINDOW_OPTIONS}
              onChange={(v) => setSettings({ volumeWindowMinutes: v })}
            />
          </Section>

          <Section label="Density">
            <SegmentedControl
              ariaLabel="Density"
              value={settings.density}
              options={DENSITY_OPTIONS}
              onChange={(v) => setSettings({ density: v })}
            />
          </Section>

          <Section label="Accent">
            <div className="grid grid-cols-4 gap-2">
              {ACCENT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSettings({ accent: option.value })}
                  aria-pressed={settings.accent === option.value}
                  aria-label={option.label}
                  title={option.label}
                  className={`flex h-9 items-center justify-center rounded-md border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                    settings.accent === option.value
                      ? "border-accent/60 bg-[color:var(--color-accent-soft)]"
                      : "border-stroke bg-surface-elevated/40 hover:border-accent/30"
                  }`}
                >
                  <span
                    className="h-4 w-4 rounded-full"
                    style={{ background: ACCENT_PREVIEW_COLOR[option.value] }}
                    aria-hidden
                  />
                </button>
              ))}
            </div>
          </Section>

          <div className="mt-4 flex items-center justify-between border-t border-stroke pt-3">
            <p className="text-[11px] text-fg-subtle">{summarize(settings)}</p>
            <button
              type="button"
              onClick={resetSettings}
              className="rounded-md border border-stroke px-2.5 py-1 text-[11px] font-medium text-fg-muted transition hover:bg-surface-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              Reset
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Section({ label, children }: { readonly label: string; readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">{label}</p>
      {children}
    </div>
  );
}

interface SegmentedControlProps<V extends string | number> {
  readonly ariaLabel: string;
  readonly value: V;
  readonly options: ReadonlyArray<{ value: V; label: string }>;
  readonly onChange: (value: V) => void;
}

function SegmentedControl<V extends string | number>(props: SegmentedControlProps<V>): React.JSX.Element {
  const { ariaLabel, value, options, onChange } = props;
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
              active
                ? "border-accent/60 bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent-fg)]"
                : "border-stroke bg-surface-elevated/40 text-fg-muted hover:border-accent/30 hover:text-fg"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function summarize(settings: Settings): string {
  const interval = settings.pollingIntervalMs === "off" ? "paused" : `${settings.pollingIntervalMs / 1000}s`;
  return `Poll ${interval} · ${settings.volumeWindowMinutes}m · ${settings.density} · ${settings.accent}`;
}
