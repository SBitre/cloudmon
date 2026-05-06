"use client";

import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes";

/**
 * Thin wrapper around `next-themes` so the rest of the app imports a
 * single project-local component instead of the third-party package.
 *
 * Defaults: respect OS preference, persist user choice, no animation
 * suppression on initial paint (we accept a brief flicker on first load
 * in exchange for keeping the markup pristine for SSR).
 */
export function ThemeProvider(props: Omit<ThemeProviderProps, "attribute" | "enableSystem" | "defaultTheme">): React.JSX.Element {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange={false}
      {...props}
    />
  );
}
