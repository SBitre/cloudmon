import type { ReactNode } from "react";

import { Icons } from "@/components/ui/icons";
import { Pill } from "@/components/ui/pill";

/**
 * Section shell for a live data panel.
 *
 * Owns the loading / refreshing / error / empty / stale plumbing so every
 * panel on the page shares the same visual rhythm. The body content is
 * delegated to the caller via `children`; loading-state body is delegated
 * to `loadingFallback` so each panel can render its own skeleton shape.
 */
interface ApiResultPanelProps {
  readonly title: string;
  /** Optional small caption under the title (e.g. data source). Hidden when omitted. */
  readonly caption?: string;
  readonly hasError: boolean;
  readonly errorMessage?: string;
  readonly isLoading: boolean;
  readonly isValidating: boolean;
  readonly isStale?: boolean;
  readonly isEmpty?: boolean;
  readonly emptyMessage?: string;
  readonly children?: ReactNode;
  /** Optional skeleton to render while `isLoading && data === undefined`. */
  readonly loadingFallback?: ReactNode;
  /** Optional retry callback — when present, the error block shows a Retry button. */
  readonly onRetry?: () => void;
  /** Optional ARIA live region. */
  readonly ariaLive?: "polite" | "assertive" | "off";
  /** Optional id used for landmark labelling and aria-controls targets. */
  readonly sectionId?: string;
  /** Optional element rendered in the header's right-side action slot. */
  readonly headerActions?: ReactNode;
}

export function ApiResultPanel(props: ApiResultPanelProps): React.JSX.Element {
  const {
    title,
    caption,
    hasError,
    errorMessage,
    isLoading,
    isValidating,
    isStale,
    isEmpty,
    emptyMessage,
    children,
    loadingFallback,
    onRetry,
    ariaLive,
    sectionId,
    headerActions,
  } = props;

  const showLoadingSkeleton = Boolean(isLoading && loadingFallback);

  return (
    <section
      id={sectionId}
      aria-labelledby={sectionId ? `${sectionId}-title` : undefined}
      className="overflow-hidden rounded-xl border border-stroke bg-surface/60 backdrop-blur-sm shadow-[var(--shadow-elevation-sm)]"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stroke bg-surface-elevated/60 px-5 py-3">
        <div className="min-w-0">
          <h2
            id={sectionId ? `${sectionId}-title` : undefined}
            className="truncate text-sm font-semibold tracking-tight text-fg"
          >
            {title}
          </h2>
          {caption ? <p className="truncate text-[11px] text-fg-subtle">{caption}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {headerActions}
          {isStale ? <Pill tone="warning" label="stale" icon={Icons.warning} /> : null}
          <StatusPill isLoading={isLoading} isValidating={isValidating} hasError={hasError} />
        </div>
      </header>

      <div
        className="cloudmon-fade-in p-5"
        key={`${hasError}-${isEmpty}-${showLoadingSkeleton}`}
        aria-live={ariaLive}
        aria-busy={isLoading || isValidating}
      >
        {hasError ? (
          <ErrorBlock message={errorMessage} onRetry={onRetry} />
        ) : showLoadingSkeleton ? (
          <>{loadingFallback}</>
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
    const InboxIcon = Icons.empty;
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-stroke bg-surface-elevated/50 px-4 py-10 text-center"
      >
        <InboxIcon className="h-6 w-6 text-fg-subtle" aria-hidden strokeWidth={1.75} />
        <p className="text-sm text-fg-muted">{emptyMessage ?? "No data yet."}</p>
      </div>
    );
  }
  return <>{children}</>;
}

function ErrorBlock({
  message,
  onRetry,
}: {
  readonly message?: string;
  readonly onRetry?: () => void;
}): React.JSX.Element {
  const Triangle = Icons.error;
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-[color:var(--color-critical)]/40 bg-[color:var(--color-critical-soft)] p-4"
    >
      <Triangle
        className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--color-critical)]"
        aria-hidden
        strokeWidth={2.25}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[color:var(--color-critical)]">{message ?? "Request failed."}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-stroke bg-surface px-2.5 py-1 text-xs font-medium text-fg transition hover:bg-surface-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
          >
            <Icons.refresh className="h-3.5 w-3.5" aria-hidden strokeWidth={2.25} />
            Retry
          </button>
        ) : null}
      </div>
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
    return <Pill tone="critical" label="error" icon={Icons.error} />;
  }
  if (isLoading) {
    return <Pill tone="neutral" label="loading" />;
  }
  if (isValidating) {
    return <Pill tone="warning" label="refreshing" icon={Icons.refresh} />;
  }
  return <Pill tone="accent" label="live" dot pulse />;
}
