import type { LucideIcon } from "lucide-react";

/**
 * Compact, color-toned status badge.
 *
 * Three optional decorations layered on a shared shape:
 *   - `dot`   — a small filled circle (use for "live" / heartbeat states).
 *   - `pulse` — combine with `dot` to animate the dot.
 *   - `icon`  — leading lucide icon (use for severity / typed labels).
 *
 * Tones map to the semantic theme tokens declared in `globals.css`, so
 * the same Pill renders correctly in both light and dark themes without
 * per-tone overrides.
 */
export type PillTone =
  | "neutral"
  | "accent"
  | "info"
  | "warning"
  | "error"
  | "critical";

const PILL_BG: Readonly<Record<PillTone, string>> = {
  neutral: "bg-surface-elevated",
  accent: "bg-[color:var(--color-accent-soft)]",
  info: "bg-[color:var(--color-info-soft)]",
  warning: "bg-[color:var(--color-warning-soft)]",
  error: "bg-[color:var(--color-error-soft)]",
  critical: "bg-[color:var(--color-critical-soft)]",
};

const PILL_BORDER: Readonly<Record<PillTone, string>> = {
  neutral: "border-stroke",
  accent: "border-[color:var(--color-accent)]/30",
  info: "border-[color:var(--color-info)]/35",
  warning: "border-[color:var(--color-warning)]/35",
  error: "border-[color:var(--color-error)]/35",
  critical: "border-[color:var(--color-critical)]/45",
};

const PILL_TEXT: Readonly<Record<PillTone, string>> = {
  neutral: "text-fg-muted",
  accent: "text-[color:var(--color-accent-fg)]",
  info: "text-[color:var(--color-info)]",
  warning: "text-[color:var(--color-warning)]",
  error: "text-[color:var(--color-error)]",
  critical: "text-[color:var(--color-critical)]",
};

const DOT_BG: Readonly<Record<PillTone, string>> = {
  neutral: "bg-fg-subtle",
  accent: "bg-accent",
  info: "bg-[color:var(--color-info)]",
  warning: "bg-[color:var(--color-warning)]",
  error: "bg-[color:var(--color-error)]",
  critical: "bg-[color:var(--color-critical)]",
};

interface PillProps {
  readonly tone: PillTone;
  readonly label: string;
  readonly dot?: boolean;
  readonly pulse?: boolean;
  readonly icon?: LucideIcon;
}

export function Pill({ tone, label, dot, pulse, icon: Icon }: PillProps): React.JSX.Element {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide transition-colors ${PILL_BG[tone]} ${PILL_BORDER[tone]} ${PILL_TEXT[tone]}`}
    >
      {dot ? (
        <span
          className={`h-1.5 w-1.5 rounded-full ${DOT_BG[tone]} ${pulse ? "cloudmon-pulse" : ""}`}
          aria-hidden
        />
      ) : null}
      {Icon ? <Icon className="h-3 w-3" aria-hidden strokeWidth={2.25} /> : null}
      <span>{label}</span>
    </span>
  );
}
