"use client";

import { useEffect, useRef, useState } from "react";
import { useSWRConfig } from "swr";

import { Icons } from "@/components/ui/icons";
import { Pill, type PillTone } from "@/components/ui/pill";
import { isTriggerEnabled, postEvent } from "@/lib/api/ingest";
import {
  CUSTOM_SCENARIO_ID,
  SCENARIOS,
  predictTriggers,
  type ScenarioDefinition,
} from "@/lib/api/scenarios";
import {
  SEVERITIES,
  SUPPORTED_EVENT_TYPES,
  setCustomScenario,
  useCustomScenario,
  type CustomScenarioConfig,
} from "@/lib/store/custom-scenario";
import type { Severity } from "@/lib/types/api";

/**
 * Demo affordance that lets a presenter fire a scenario from the
 * dashboard itself instead of switching to a terminal mid-demo.
 *
 * Layout:
 *   - Compact scrollable scenario list grouped by category.
 *   - Selected scenario's description (or custom form) is rendered in
 *     a single caption area below the list.
 *   - Count input with ±5 nudge.
 *   - Run-status read-out (aria-live polite).
 *   - Cancel / Fire button.
 */
type RunStatus = "idle" | "firing" | "done" | "error" | "cancelled";

interface RunState {
  readonly status: RunStatus;
  readonly sent: number;
  readonly target: number;
  readonly errorMessage?: string;
}

const INITIAL_STATE: RunState = { status: "idle", sent: 0, target: 0 };
const INTERVAL_MS = 250;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort(): void {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve();
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

const CATEGORY_TONE: Readonly<Record<ScenarioDefinition["category"], PillTone>> = {
  anomaly: "critical",
  traffic: "info",
  custom: "neutral",
};

const CATEGORY_LABEL: Readonly<Record<ScenarioDefinition["category"], string>> = {
  anomaly: "anomaly",
  traffic: "traffic",
  custom: "custom",
};

export function TriggerScenarioMenu(): React.JSX.Element | null {
  const enabled = isTriggerEnabled();
  const [open, setOpen] = useState(false);
  const [scenarioId, setScenarioId] = useState<string>(SCENARIOS[0].id);
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];
  const [count, setCount] = useState<number>(scenario.defaultCount);
  const [run, setRun] = useState<RunState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { mutate } = useSWRConfig();

  useEffect(() => {
    setCount(scenario.defaultCount);
    setRun(INITIAL_STATE);
  }, [scenario.defaultCount, scenarioId]);

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

  if (!enabled) {
    return null;
  }

  async function fireOne(
    index: number,
    controller: AbortController,
  ): Promise<"continue" | "cancelled" | "error"> {
    if (controller.signal.aborted) {
      return "cancelled";
    }
    try {
      await postEvent(scenario.buildEvent(index), controller.signal);
    } catch (cause) {
      if (controller.signal.aborted) {
        return "cancelled";
      }
      const message = cause instanceof Error ? cause.message : "request failed";
      setRun((prev) => ({ ...prev, status: "error", errorMessage: message }));
      return "error";
    }
    setRun((prev) => ({ ...prev, sent: prev.sent + 1 }));
    return "continue";
  }

  async function fire(): Promise<void> {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const target = clamp(count, scenario.minCount, scenario.maxCount);
    setRun({ status: "firing", sent: 0, target });

    for (let i = 0; i < target; i += 1) {
      const outcome = await fireOne(i, controller);
      if (outcome === "cancelled") {
        setRun((prev) => ({ ...prev, status: "cancelled" }));
        return;
      }
      if (outcome === "error") {
        return;
      }
      if (i < target - 1) {
        await sleep(INTERVAL_MS, controller.signal);
        if (controller.signal.aborted) {
          setRun((prev) => ({ ...prev, status: "cancelled" }));
          return;
        }
      }
    }
    setRun((prev) => ({ ...prev, status: "done" }));
    void mutate("events/volume");
    void mutate("alerts");
  }

  function handleCancel(): void {
    abortRef.current?.abort();
  }

  function reset(): void {
    setRun(INITIAL_STATE);
  }

  const isFiring = run.status === "firing";
  const triggerLabel = isFiring ? `Firing ${run.sent}/${run.target}` : "Trigger scenario";

  const groups: Array<{ key: ScenarioDefinition["category"]; label: string }> = [
    { key: "anomaly", label: "Anomaly" },
    { key: "traffic", label: "Traffic" },
    { key: "custom", label: "Custom" },
  ];

  const FireIcon = Icons.fire;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-stroke bg-surface px-3 text-sm font-medium text-fg-muted transition hover:border-accent/40 hover:bg-surface-elevated hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
      >
        <FireIcon className="h-4 w-4 text-accent" aria-hidden strokeWidth={2.25} />
        <span>{triggerLabel}</span>
      </button>

      {open ? (
        <div
          aria-label="Trigger demo scenario"
          className="cloudmon-fade-in absolute right-0 z-20 mt-2 flex max-h-[calc(100vh-6rem)] w-88 flex-col overflow-hidden rounded-xl border border-stroke bg-surface shadow-(--shadow-elevation-md)"
        >
          <div className="flex-1 overflow-y-auto p-4">
            <ScenarioList
              groups={groups}
              scenarios={SCENARIOS}
              selectedId={scenarioId}
              disabled={isFiring}
              onSelect={setScenarioId}
            />

            {scenario.id === CUSTOM_SCENARIO_ID ? (
              <div className="mt-3 rounded-md border border-stroke bg-surface-base/40 p-3">
                <CustomScenarioForm disabled={isFiring} />
              </div>
            ) : null}

            <div className="mt-4">
              <CountInput
                value={count}
                onChange={setCount}
                min={scenario.minCount}
                max={scenario.maxCount}
                disabled={isFiring}
              />
            </div>

            <div
              role="status"
              aria-live="polite"
              className="mt-3 rounded-md border border-stroke bg-surface-base/40 p-3 text-xs"
            >
              <RunStatusReadout
                run={run}
                scenario={scenario}
                count={clamp(count, scenario.minCount, scenario.maxCount)}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-stroke bg-surface-elevated/40 px-4 py-3">
            {isFiring ? (
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-md border border-stroke px-3 py-1.5 text-xs font-medium text-fg-muted transition hover:bg-surface-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                Cancel
              </button>
            ) : (
              <PrimaryActionButton
                runStatus={run.status}
                count={clamp(count, scenario.minCount, scenario.maxCount)}
                onFire={fire}
                onReset={reset}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface PrimaryActionButtonProps {
  readonly runStatus: RunStatus;
  readonly count: number;
  readonly onFire: () => Promise<void>;
  readonly onReset: () => void;
}

function PrimaryActionButton({ runStatus, count, onFire, onReset }: PrimaryActionButtonProps): React.JSX.Element {
  const Play = Icons.play;
  const isResettable = runStatus === "idle" || runStatus === "done" || runStatus === "cancelled";
  const handleClick = isResettable ? () => void onFire() : onReset;
  const label = runStatus === "error" ? "Retry" : `Fire ${count} events`;
  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      <Play className="h-3.5 w-3.5" aria-hidden strokeWidth={2.25} />
      {label}
    </button>
  );
}

interface ScenarioListProps {
  readonly groups: ReadonlyArray<{ key: ScenarioDefinition["category"]; label: string }>;
  readonly scenarios: readonly ScenarioDefinition[];
  readonly selectedId: string;
  readonly disabled: boolean;
  readonly onSelect: (id: string) => void;
}

function ScenarioList({ groups, scenarios, selectedId, disabled, onSelect }: ScenarioListProps): React.JSX.Element {
  return (
    <div role="radiogroup" aria-label="Scenarios" className="flex flex-col gap-3">
      {groups.map((group) => {
        const items = scenarios.filter((s) => s.category === group.key);
        if (items.length === 0) {
          return null;
        }
        return (
          <div key={group.key}>
            <p className="px-1 pb-1.5 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
              {group.label}
            </p>
            <ul className="flex flex-col gap-1">
              {items.map((option) => {
                const active = option.id === selectedId;
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={disabled}
                      onClick={() => onSelect(option.id)}
                      className={`flex w-full flex-col items-start gap-1 rounded-md border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                        active
                          ? "border-accent/50 bg-accent-soft"
                          : "border-stroke bg-surface-elevated/40 hover:border-accent/30 hover:bg-surface-elevated"
                      }`}
                    >
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="text-sm font-medium text-fg">{option.title}</span>
                        <Pill tone={CATEGORY_TONE[option.category]} label={CATEGORY_LABEL[option.category]} />
                      </span>
                      <span className="font-mono text-[11px] leading-snug text-fg-subtle">
                        {option.description}
                      </span>
                      {option.anomalyType ? (
                        <span className="font-mono text-[11px] text-fg-subtle">
                          Triggers: <span className="text-fg">{option.anomalyType}</span>
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function CustomScenarioForm({ disabled }: { readonly disabled: boolean }): React.JSX.Element {
  const config = useCustomScenario();
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">Custom event</p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Event type">
          <Select
            value={config.eventType}
            disabled={disabled}
            onChange={(value) => setCustomScenario({ eventType: value as CustomScenarioConfig["eventType"] })}
            options={SUPPORTED_EVENT_TYPES.map((value) => ({ value, label: value }))}
          />
        </Field>
        <Field label="Severity">
          <Select
            value={config.severity}
            disabled={disabled}
            onChange={(value) => setCustomScenario({ severity: value as Severity })}
            options={SEVERITIES.map((value) => ({ value, label: value }))}
          />
        </Field>
        <Field label="Service" full>
          <Text
            value={config.service}
            disabled={disabled}
            placeholder="checkout-service"
            onChange={(value) => setCustomScenario({ service: value })}
          />
        </Field>
        <Field label="Endpoint">
          <Text
            value={config.endpoint}
            disabled={disabled}
            placeholder="/api/orders"
            onChange={(value) => setCustomScenario({ endpoint: value })}
          />
        </Field>
        <Field label="Status code">
          <Text
            value={config.statusCode}
            disabled={disabled}
            placeholder="200"
            onChange={(value) => setCustomScenario({ statusCode: value })}
          />
        </Field>
        <Field label="IP address">
          <Text
            value={config.ipAddress}
            disabled={disabled}
            placeholder="198.51.100.42"
            onChange={(value) => setCustomScenario({ ipAddress: value })}
          />
        </Field>
        <Field label="User ID prefix">
          <Text
            value={config.userId}
            disabled={disabled}
            placeholder="user"
            onChange={(value) => setCustomScenario({ userId: value })}
          />
        </Field>
        <Field label="Error message" full>
          <Text
            value={config.errorMessage}
            disabled={disabled}
            placeholder="Optional error_message"
            onChange={(value) => setCustomScenario({ errorMessage: value })}
          />
        </Field>
      </div>
      <p className="text-[10px] text-fg-subtle">
        Empty optional fields are omitted from the payload. User IDs are suffixed with the event index.
      </p>
    </div>
  );
}

function Field({
  label,
  full,
  children,
}: {
  readonly label: string;
  readonly full?: boolean;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label className={`flex flex-col gap-1 ${full ? "col-span-2" : ""}`}>
      <span className="text-[10px] font-medium uppercase tracking-wider text-fg-subtle">{label}</span>
      {children}
    </label>
  );
}

interface SelectProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly options: ReadonlyArray<{ value: string; label: string }>;
  readonly disabled?: boolean;
}

function Select({ value, onChange, options, disabled }: SelectProps): React.JSX.Element {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-md border border-stroke bg-surface-base/60 px-2 py-1 font-mono text-xs text-fg transition focus:border-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

interface TextProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
}

function Text({ value, onChange, placeholder, disabled }: TextProps): React.JSX.Element {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-md border border-stroke bg-surface-base/60 px-2 py-1 font-mono text-xs text-fg transition placeholder:text-fg-subtle focus:border-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}

interface CountInputProps {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min: number;
  readonly max: number;
  readonly disabled: boolean;
}

function CountInput({ value, onChange, min, max, disabled }: CountInputProps): React.JSX.Element {
  function handleChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const raw = Number(event.target.value);
    if (Number.isNaN(raw)) {
      return;
    }
    onChange(clamp(Math.round(raw), min, max));
  }
  function nudge(delta: number): void {
    onChange(clamp(value + delta, min, max));
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="trigger-count" className="text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
        Event count <span className="font-mono normal-case text-fg-subtle">({min}–{max})</span>
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => nudge(-5)}
          disabled={disabled || value <= min}
          aria-label="Decrease event count by 5"
          className="rounded-md border border-stroke bg-surface-elevated/40 px-2 py-1 text-xs text-fg-muted transition hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          −5
        </button>
        <input
          id="trigger-count"
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className="w-full flex-1 rounded-md border border-stroke bg-surface-base/60 px-3 py-1.5 text-center font-mono text-sm tabular-nums text-fg transition focus:border-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => nudge(5)}
          disabled={disabled || value >= max}
          aria-label="Increase event count by 5"
          className="rounded-md border border-stroke bg-surface-elevated/40 px-2 py-1 text-xs text-fg-muted transition hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          +5
        </button>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

interface IdleReadoutProps {
  readonly scenario: ScenarioDefinition;
  readonly count: number;
}

function IdleReadout({ scenario, count }: IdleReadoutProps): React.JSX.Element {
  const Ok = Icons.ok;
  const Warning = Icons.warning;

  if (scenario.category === "custom") {
    return (
      <p className="text-fg-subtle">
        Custom event will be ingested as configured. Whether an alert fires depends on the
        detection rules and your event_type / service.
      </p>
    );
  }

  const predictions = predictTriggers(scenario, count);

  if (predictions.length === 0) {
    return (
      <p className="text-fg-subtle">
        Healthy traffic — populates the volume chart but does not produce events that any
        detection rule looks for.
      </p>
    );
  }

  const willTrigger = predictions.filter((p) => p.willTrigger);
  const wontTrigger = predictions.filter((p) => !p.willTrigger);

  return (
    <div className="flex flex-col gap-1.5">
      {willTrigger.length > 0 ? (
        <p className="inline-flex items-start gap-1.5 text-accent-fg">
          <Ok className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden strokeWidth={2.25} />
          <span>
            At {count} events, expected to trigger{" "}
            {willTrigger.map((p, i) => (
              <span key={p.ruleName}>
                {i > 0 ? ", " : ""}
                <span className="font-mono text-fg">{p.ruleName}</span>{" "}
                <span className="text-fg-subtle">
                  (~{p.expectedCount}/{p.threshold})
                </span>
              </span>
            ))}
            {" "}within ~60s.
          </span>
        </p>
      ) : null}
      {wontTrigger.length > 0 ? (
        <p className="inline-flex items-start gap-1.5 text-fg-subtle">
          <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden strokeWidth={2.25} />
          <span>
            Below threshold for{" "}
            {wontTrigger.map((p, i) => (
              <span key={p.ruleName}>
                {i > 0 ? ", " : ""}
                <span className="font-mono text-fg">{p.ruleName}</span>{" "}
                <span className="text-fg-subtle">
                  (~{p.expectedCount}/{p.threshold}, need ≥{p.neededCount})
                </span>
              </span>
            ))}
            .
          </span>
        </p>
      ) : null}
    </div>
  );
}

interface ReadoutProps {
  readonly run: RunState;
  readonly scenario: ScenarioDefinition;
  readonly count: number;
}

function RunStatusReadout({ run, scenario, count }: ReadoutProps): React.JSX.Element {
  const Spinner = Icons.spinner;
  const Ok = Icons.ok;
  const ErrorIcon = Icons.error;

  if (run.status === "idle") {
    return <IdleReadout scenario={scenario} count={count} />;
  }
  if (run.status === "firing") {
    const pct = Math.round((run.sent / Math.max(1, run.target)) * 100);
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-fg">
          <span className="inline-flex items-center gap-1.5">
            <Spinner className="h-3.5 w-3.5 animate-spin text-accent" aria-hidden strokeWidth={2.25} />
            Firing events…
          </span>
          <span className="font-mono tabular-nums text-fg-muted">
            {run.sent}/{run.target}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-elevated" aria-hidden>
          <div className="h-full bg-accent transition-[width] duration-200" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }
  if (run.status === "done") {
    return (
      <p className="inline-flex items-center gap-1.5 text-accent-fg">
        <Ok className="h-4 w-4" aria-hidden strokeWidth={2.25} />
        {run.target} events delivered.
        {scenario.category === "anomaly" ? " Watch for an alert in the next ~60s." : ""}
      </p>
    );
  }
  if (run.status === "cancelled") {
    return (
      <p className="text-fg-muted">
        Cancelled after {run.sent}/{run.target} events. Detection rules may still fire if their thresholds were reached.
      </p>
    );
  }
  return (
    <p className="inline-flex items-start gap-1.5 text-critical">
      <ErrorIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden strokeWidth={2.25} />
      <span>{run.errorMessage ?? "Request failed."}</span>
    </p>
  );
}
