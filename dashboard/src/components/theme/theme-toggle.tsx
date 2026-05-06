"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { Icons } from "@/components/ui/icons";

/**
 * Cycles theme: light -> dark -> system -> light.
 *
 * Renders nothing until mounted on the client to avoid SSR hydration
 * mismatch (the resolved theme is only known on the client). The button
 * exposes its current resolved state via `aria-pressed` so screen readers
 * announce the toggle correctly.
 */
const THEMES = ["light", "dark", "system"] as const;
type ThemeName = (typeof THEMES)[number];

const THEME_ICON: Readonly<Record<ThemeName, keyof typeof Icons>> = {
  light: "sun",
  dark: "moon",
  system: "monitor",
};

const THEME_LABEL: Readonly<Record<ThemeName, string>> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export function ThemeToggle(): React.JSX.Element | null {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <ToggleShell ariaLabel="Theme" disabled />;
  }

  const current = (THEMES.includes(theme as ThemeName) ? theme : "system") as ThemeName;
  const Icon = Icons[THEME_ICON[current]];
  const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];

  return (
    <ToggleShell
      ariaLabel={`Theme: ${THEME_LABEL[current]} (resolved: ${resolvedTheme}). Click to switch to ${THEME_LABEL[next]}.`}
      onClick={() => setTheme(next)}
    >
      <Icon className="h-4 w-4" aria-hidden strokeWidth={2.25} />
    </ToggleShell>
  );
}

interface ToggleShellProps {
  readonly ariaLabel: string;
  readonly disabled?: boolean;
  readonly onClick?: () => void;
  readonly children?: React.ReactNode;
}

function ToggleShell({ ariaLabel, disabled, onClick, children }: ToggleShellProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={ariaLabel}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-stroke bg-surface text-fg-muted transition hover:border-accent/40 hover:bg-surface-elevated hover:text-fg disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
    >
      {children}
    </button>
  );
}
