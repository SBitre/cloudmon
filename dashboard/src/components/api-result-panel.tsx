/**
 * Small presentational primitive that renders an API query result in a
 * consistent loading / error / data layout.
 *
 * Phase 1 only: this is intentionally raw JSON output to prove the wiring
 * end-to-end. Later phases replace the `<pre>` with proper visualizations
 * (chart for volume, alert cards for alerts).
 */
interface ApiResultPanelProps<T> {
  readonly title: string;
  readonly endpoint: string;
  readonly data: T | undefined;
  readonly error: Error | undefined;
  readonly isLoading: boolean;
  readonly isValidating: boolean;
}

export function ApiResultPanel<T>(props: ApiResultPanelProps<T>): React.JSX.Element {
  const { title, endpoint, data, error, isLoading, isValidating } = props;

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
          <p className="font-mono text-xs text-zinc-500">{endpoint}</p>
        </div>
        <StatusPill isLoading={isLoading} isValidating={isValidating} hasError={Boolean(error)} />
      </header>

      {error ? (
        <p className="rounded border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          {error.message}
        </p>
      ) : (
        <pre className="max-h-[420px] overflow-auto rounded bg-black/40 p-3 font-mono text-xs leading-relaxed text-zinc-300">
          {data ? JSON.stringify(data, null, 2) : "// awaiting first response..."}
        </pre>
      )}
    </section>
  );
}

interface StatusPillProps {
  readonly isLoading: boolean;
  readonly isValidating: boolean;
  readonly hasError: boolean;
}

function StatusPill({ isLoading, isValidating, hasError }: StatusPillProps): React.JSX.Element {
  if (hasError) {
    return <Pill tone="red" label="error" />;
  }
  if (isLoading) {
    return <Pill tone="zinc" label="loading" />;
  }
  if (isValidating) {
    return <Pill tone="amber" label="refreshing" />;
  }
  return <Pill tone="emerald" label="live" />;
}

const PILL_TONES = {
  red: "border-red-900 bg-red-950/60 text-red-300",
  amber: "border-amber-900 bg-amber-950/60 text-amber-300",
  emerald: "border-emerald-900 bg-emerald-950/60 text-emerald-300",
  zinc: "border-zinc-800 bg-zinc-900 text-zinc-400",
} as const;

function Pill({ tone, label }: { tone: keyof typeof PILL_TONES; label: string }): React.JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${PILL_TONES[tone]}`}
    >
      {label}
    </span>
  );
}
