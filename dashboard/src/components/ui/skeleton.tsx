import type { CSSProperties } from "react";

/**
 * Animated shimmer loader. Single building block for skeleton UI.
 *
 * Pure presentation: callers pass tailwind utility classes for shape and
 * size. Tailwind's `animate-pulse` keyframe drives the shimmer; the bg
 * tone is theme-aware via the `bg-surface-elevated` token.
 */
interface SkeletonProps {
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly label?: string;
}

export function Skeleton({ className = "", style, label }: SkeletonProps): React.JSX.Element {
  return (
    <span
      role="presentation"
      aria-label={label}
      style={style}
      className={`inline-block animate-pulse rounded bg-surface-elevated ${className}`}
    />
  );
}
