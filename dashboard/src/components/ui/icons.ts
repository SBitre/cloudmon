/**
 * Centralized icon registry.
 *
 * One file. One source of truth. Any component that needs an icon picks a
 * semantic name from here so the visual language stays coherent and we can
 * later swap the underlying icon library without touching consumers.
 */
import {
  AlertOctagon,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Inbox,
  Info,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

import type { Severity } from "@/lib/types/api";

export const Icons = {
  // Severity
  info: Info,
  warning: AlertTriangle,
  error: TriangleAlert,
  critical: AlertOctagon,

  // System / branding
  brand: ShieldAlert,
  ai: Sparkles,
  bot: Bot,

  // Affordances
  refresh: RefreshCw,
  expand: ChevronDown,
  collapse: ChevronRight,
  empty: Inbox,
  ok: CheckCircle2,
} as const;

const SEVERITY_ICON_KEY: Readonly<Record<Severity, keyof typeof Icons>> = {
  info: "info",
  warning: "warning",
  error: "error",
  critical: "critical",
};

/** Resolve the canonical icon component for a given severity. */
export function severityIcon(severity: Severity): (typeof Icons)[keyof typeof Icons] {
  return Icons[SEVERITY_ICON_KEY[severity]];
}
