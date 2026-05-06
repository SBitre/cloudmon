"use client";

import { useEffect } from "react";

import { useSettings, type Accent } from "@/lib/store/settings";

/**
 * Applies the user-selected accent color by overriding the
 * `--color-accent*` CSS custom properties on `<html>`. Lives at the root
 * of the React tree so the overrides flush before children render in
 * the same frame.
 *
 * Each accent ships a 4-tuple (`base`, `hover`, `soft`, `ring`, `fg`)
 * tuned for both light and dark themes; we only need to set `base`,
 * `hover`, `soft`, `ring`, `fg` because every other token in the design
 * is derived from these.
 */
const ACCENTS: Readonly<Record<Accent, {
  light: { base: string; hover: string; soft: string; ring: string; fg: string };
  dark: { base: string; hover: string; soft: string; ring: string; fg: string };
}>> = {
  emerald: {
    light: { base: "#059669", hover: "#047857", soft: "rgba(16, 185, 129, 0.12)", ring: "rgba(16, 185, 129, 0.4)", fg: "#065f46" },
    dark: { base: "#10b981", hover: "#34d399", soft: "rgba(16, 185, 129, 0.15)", ring: "rgba(16, 185, 129, 0.45)", fg: "#6ee7b7" },
  },
  blue: {
    light: { base: "#2563eb", hover: "#1d4ed8", soft: "rgba(37, 99, 235, 0.12)", ring: "rgba(37, 99, 235, 0.4)", fg: "#1e40af" },
    dark: { base: "#3b82f6", hover: "#60a5fa", soft: "rgba(59, 130, 246, 0.15)", ring: "rgba(59, 130, 246, 0.45)", fg: "#93c5fd" },
  },
  violet: {
    light: { base: "#7c3aed", hover: "#6d28d9", soft: "rgba(124, 58, 237, 0.12)", ring: "rgba(124, 58, 237, 0.4)", fg: "#5b21b6" },
    dark: { base: "#8b5cf6", hover: "#a78bfa", soft: "rgba(139, 92, 246, 0.15)", ring: "rgba(139, 92, 246, 0.45)", fg: "#c4b5fd" },
  },
  amber: {
    light: { base: "#d97706", hover: "#b45309", soft: "rgba(217, 119, 6, 0.14)", ring: "rgba(217, 119, 6, 0.4)", fg: "#92400e" },
    dark: { base: "#f59e0b", hover: "#fbbf24", soft: "rgba(245, 158, 11, 0.18)", ring: "rgba(245, 158, 11, 0.45)", fg: "#fcd34d" },
  },
};

export function AccentApplier(): null {
  const accent = useSettings((s) => s.accent);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    const isDark = root.classList.contains("dark");
    const palette = ACCENTS[accent][isDark ? "dark" : "light"];
    root.style.setProperty("--color-accent", palette.base);
    root.style.setProperty("--color-accent-hover", palette.hover);
    root.style.setProperty("--color-accent-soft", palette.soft);
    root.style.setProperty("--color-accent-ring", palette.ring);
    root.style.setProperty("--color-accent-fg", palette.fg);

    // Also re-apply when theme flips: observe `class` changes on <html>.
    const observer = new MutationObserver(() => {
      const dark = root.classList.contains("dark");
      const next = ACCENTS[accent][dark ? "dark" : "light"];
      root.style.setProperty("--color-accent", next.base);
      root.style.setProperty("--color-accent-hover", next.hover);
      root.style.setProperty("--color-accent-soft", next.soft);
      root.style.setProperty("--color-accent-ring", next.ring);
      root.style.setProperty("--color-accent-fg", next.fg);
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [accent]);

  return null;
}

export const ACCENT_PREVIEW_COLOR: Readonly<Record<Accent, string>> = {
  emerald: "#10b981",
  blue: "#3b82f6",
  violet: "#8b5cf6",
  amber: "#f59e0b",
};
