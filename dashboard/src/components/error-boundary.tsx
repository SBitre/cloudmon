"use client";

import { Component, type ReactNode } from "react";

import { Icons } from "@/components/ui/icons";

/**
 * Class-based error boundary.
 *
 * React requires a class component for error boundaries; this is the only
 * place in the codebase that uses one. Wrap any subtree whose failure
 * should not take down its siblings (each `ApiResultPanel`, the trigger
 * menu, etc.). The `fallback` render-prop receives the captured error so
 * callers can show context-specific messaging.
 */
interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly fallback: (error: Error, reset: () => void) => ReactNode;
  /** Optional reset key — when it changes, the boundary clears its error state. */
  readonly resetKey?: string | number;
}

interface ErrorBoundaryState {
  readonly error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { error: null };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  public componentDidUpdate(prev: ErrorBoundaryProps): void {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  public componentDidCatch(error: Error): void {
    if (process.env.NODE_ENV !== "production") {
      console.error("[CloudMon ErrorBoundary]", error);
    }
  }

  private readonly handleReset = (): void => {
    this.setState({ error: null });
  };

  public render(): ReactNode {
    if (this.state.error) {
      return this.props.fallback(this.state.error, this.handleReset);
    }
    return this.props.children;
  }
}

/**
 * Default fallback used by the page-level boundary. Renders a full-bleed
 * panel with a retry affordance so a single component crash does not
 * leave the user staring at a blank page.
 */
export function DefaultErrorFallback({
  error,
  reset,
}: {
  readonly error: Error;
  readonly reset: () => void;
}): React.JSX.Element {
  const Triangle = Icons.error;
  return (
    <div
      role="alert"
      className="mx-auto my-12 flex max-w-md flex-col items-start gap-3 rounded-xl border border-[color:var(--color-critical)]/40 bg-[color:var(--color-critical-soft)] p-5"
    >
      <Triangle className="h-5 w-5 text-[color:var(--color-critical)]" aria-hidden strokeWidth={2.25} />
      <div>
        <p className="text-sm font-medium text-[color:var(--color-critical)]">Something broke.</p>
        <p className="mt-1 break-words text-xs text-fg-muted">{error.message}</p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-stroke bg-surface px-3 py-1.5 text-xs font-medium text-fg transition hover:bg-surface-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
      >
        <Icons.refresh className="h-3.5 w-3.5" aria-hidden strokeWidth={2.25} />
        Retry
      </button>
    </div>
  );
}
