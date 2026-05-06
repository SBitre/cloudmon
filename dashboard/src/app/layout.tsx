import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { AccentApplier } from "@/components/theme/accent-applier";
import { ThemeProvider } from "@/components/theme/theme-provider";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CloudMon",
  description:
    "Real-time cloud event monitoring with AI-powered anomaly explanations.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ThemeProvider>
          <AccentApplier />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
