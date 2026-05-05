import type { ReactNode } from "react";

import { Icons } from "@/components/ui/icons";
import { Pill } from "@/components/ui/pill";

/**
 * Section shell for a live data panel.
 *
 * Owns the loading / refreshing / error / empty plumbing so every panel on
 * the page shares the same visual rhythm. The body content is delegated to
 * the caller via `children` — one shell, many bodies (chart, alert list,
 * raw JSON, future widgets).
 */
interface ApiResultPanelProps {
  readonly title: string;
  readonly endpoint: string;
  readonly hasError: boolean;
  readonly errorMessage?: string;
  readonly isLoading: boolean;
  readonly isValidating: boolean;
  readonly isEmpty?: boolean;
  readonly emptyMessage?: string;
  readonly children?: ReactNode;
}

export function ApiResultPanel(props: ApiResultPanelProps): React.JSX.Element {
  const {
    title,
    endpoint,
    hasError,
    errorMessage,
    isLoading,
    isValidating,
    isEmpty,
    emptyMessage,
    children,
  } = props;

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/40 backdrop-blur-sm">
      <header className="flex items-baseline justify-between gap-3 border-b border-zinc-800/80 bg-zinc-900/40 px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-zinc-100">{title}</h2>
          <p className="font-mono text-[11px] text-zinc-500">{endpoint}</p>
        </div>
        <StatusPill isLoading={isLoading} isValidating={isValidating} hasError={hasError} />
      </header>

      <div className="cloudmon-fade-in p-5" key={`${hasError}-${isEmpty}`}>
        {hasError ? (
          <ErrorBlock message={errorMessage} />
        ) : (
          <ResultBody isEmpty={isEmpty} emptyMessage={emptyMessage}>
            {children}
          </ResultBody>
        )}
      </div>
    </section>
  );
}

interface ResultBodyProps {
  readonly isEmpty?: boolean;
  readonly emptyMessage?: string;
  readonly children?: ReactNode;
}

function ResultBody({ isEmpty, emptyMessage, children }: ResultBodyProps): React.JSX.Element {
  if (isEmpty) {
    const Inbox = Icons.empty;
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 px-4 py-10 text-center">
        <Inbox className="h-6 w-6 text-zinc-600" aria-hidden strokeWidth={1.75} />
        <p className="text-sm text-zinc-400">{emptyMessage ?? "No data yet."}</p>
      </div>
    );
  }
  return <>{children}</>;
}

function ErrorBlock({ message }: { readonly message?: string }): React.JSX.Element {
  const Triangle = Icons.error;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-900/60 bg-red-950/30 p-4">
      <Triangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden strokeWidth={2.25} />
      <p className="text-sm text-red-200">{message ?? "Request failed."}</p>
    </div>
  );
}

interface StatusPillProps {
  readonly isLoading: boolean;
  readonly isValidating: boolean;
  readonly hasError: boolean;
}

function StatusPill({ isLoading, isValidating, hasError }: StatusPillProps): React.JSX.Element {
  if (hasError) {
    return <Pill tone="red" label="error" icon={Icons.error} />;
  }
  if (isLoading) {
    return <Pill tone="zinc" label="loading" />;
  }
  if (isValidating) {
    return <Pill tone="amber" label="refreshing" icon={Icons.refresh} />;
  }
  return <Pill tone="emerald" label="live" dot pulse />;
}
