import type { LucideIcon } from "lucide-react";

/**
 * Compact, color-toned status badge.
 *
 * Three optional decorations layered on a shared shape:
 *   - `dot`   — a small filled circle (use for "live" / heartbeat states).
 *   - `pulse` — combine with `dot` to animate the dot.
 *   - `icon`  — leading lucide icon (use for severity / typed labels).
 *
 * One component, many uses; keeps the dashboard's visual language tight.
 */
export type PillTone = "red" | "amber" | "emerald" | "zinc" | "blue" | "orange";

const PILL_CLASSES: Readonly<Record<PillTone, string>> = {
  red: "border-red-500/30 bg-red-500/10 text-red-300",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  zinc: "border-zinc-700/60 bg-zinc-800/60 text-zinc-300",
  blue: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  orange: "border-orange-500/30 bg-orange-500/10 text-orange-300",
};

const DOT_CLASSES: Readonly<Record<PillTone, string>> = {
  red: "bg-red-400",
  amber: "bg-amber-400",
  emerald: "bg-emerald-400",
  zinc: "bg-zinc-400",
  blue: "bg-blue-400",
  orange: "bg-orange-400",
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
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide transition-colors ${PILL_CLASSES[tone]}`}
    >
      {dot ? (
        <span
          className={`h-1.5 w-1.5 rounded-full ${DOT_CLASSES[tone]} ${pulse ? "cloudmon-pulse" : ""}`}
          aria-hidden
        />
      ) : null}
      {Icon ? <Icon className="h-3 w-3" aria-hidden strokeWidth={2.25} /> : null}
      <span>{label}</span>
    </span>
  );
}
