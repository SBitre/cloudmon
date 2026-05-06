# CloudMon Dashboard

Next.js 15 frontend that visualizes the CloudMon read API: live event volume and Gemini-explained alerts.

> **Status — Phase 1 (wiring smoke test).** Both API endpoints are wired through SWR-powered hooks and rendered as raw JSON to prove the data layer end-to-end. Phase 2 will replace the JSON dumps with a volume chart and alert cards.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) | SSG/ISR friendly, modern React 19 server-component story |
| Language | TypeScript (strict) | Wire-level types match `docs/event-schema.md` |
| Styling | Tailwind CSS v4 | Zero-runtime, utility-first, tiny bundle |
| Theming | `next-themes` | System / light / dark with persistence; OS preference respected |
| Data fetching | SWR | Stale-while-revalidate, auto-pause on tab blur, errors keep last good data |
| Charts | Recharts | Composable, declarative, plays well with React 19 |
| Icons | lucide-react | Tree-shaken; ~3 KB per imported icon |

## Project layout

```
dashboard/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout, fonts, metadata
│   │   ├── page.tsx            # Phase 1 wiring page
│   │   └── globals.css         # Tailwind base + theme tokens
│   ├── components/
│   │   └── api-result-panel.tsx  # Reusable loading/error/data shell
│   └── lib/
│       ├── config.ts             # NEXT_PUBLIC_API_URL + timeouts
│       ├── api/
│       │   └── client.ts         # Typed fetch with timeout + ApiError
│       ├── hooks/
│       │   └── use-cloudmon-api.ts # useEventVolume / useAlerts
│       └── types/
│           └── api.ts            # Wire-level types (EventsVolumeResponse, Alert, ...)
├── .env.example
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── postcss.config.mjs
└── tsconfig.json
```

The boundary between layers is intentional and follows separation-of-concerns:

- **`lib/types/`** — pure shapes, zero runtime code. Single source of truth for the contract.
- **`lib/api/`** — knows about HTTP, knows nothing about React or SWR. Unit-testable in isolation.
- **`lib/hooks/`** — SWR adapters. Components only talk to hooks.
- **`components/`** — presentational, props-only, no fetching.
- **`app/`** — route shells that compose hooks and components.

This means a future swap of the data layer (e.g. to TanStack Query, or to a Lambda Edge function for SSR) only touches `lib/`; the components and pages do not change.

## Prerequisites

- Node.js 20+ (tested on 24.x)
- npm 10+

## Setup

```bash
cd dashboard
npm install
cp .env.example .env.local      # then edit if pointing at a non-default API
```

`.env.local` must define `NEXT_PUBLIC_API_URL` — the base URL of the deployed CloudMon read API, without a trailing slash. The default in `.env.example` points at the team's `us-east-1` deployment; resolve a fresh value with:

```bash
cd ../terraform && terraform output -raw read_api_endpoint
```

The dashboard refuses to start without this variable to keep deployments honest.

## Scripts

```bash
npm run dev      # local dev server with HMR (http://localhost:3000)
npm run build    # production build (also surfaces TS errors)
npm run start    # serve the production build
npm run lint     # eslint via next/core-web-vitals + typescript-eslint
```

## Environment variables

| Name | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | yes | Base URL of the deployed read API (no trailing slash) |
| `NEXT_PUBLIC_INGEST_URL` | optional | Full URL of the ingest endpoint (`.../events`). When set, the in-page Trigger Scenario menu becomes active and posts events directly from the browser. The Lambda allows `Origin: *` so this works without infra changes. |

`NEXT_PUBLIC_*` variables are inlined at build time and are visible in the browser bundle by design. Do **not** put secrets here.

## Data-flow contract

The dashboard consumes two read-only endpoints; both are documented in `docs/event-schema.md` and produced by `lambdas/api/handler.py`.

### `GET /events/volume`

```json
{ "buckets": [ { "minute": "2026-05-05T00:21:00Z", "count": 149 } ] }
```

### `GET /alerts`

```json
{
  "alerts": [
    {
      "alert_id": "...",
      "timestamp": "2026-05-05T00:23:18.257259Z",
      "service": "checkout-service",
      "anomaly_type": "api_error_spike",
      "severity": "warning",
      "explanation": "...",
      "recommended_actions": ["..."],
      "triggering_events": [{ "...": "..." }]
    }
  ]
}
```

## Polling behavior

- Refresh interval: 3 seconds (`POLLING_INTERVAL_MS` in `lib/config.ts`).
- Auto-pauses when the tab is backgrounded (SWR default), so demo Lambdas stop being invoked the moment you tab to slides.
- Refetches immediately on tab focus and network reconnect.
- A failed poll keeps the last successful payload visible — the dashboard never blanks out mid-demo because of a transient hiccup.

## Accessibility

- Skip-to-content link for keyboard users (visible on focus).
- Semantic landmarks (`<header>`, `<main>`, `<footer>`, `<section aria-label>`).
- Alerts panel has `aria-live="polite"` so screen readers announce new alerts as they arrive.
- All interactive controls (theme toggle, scenario picker, triggering-events disclosure) have visible focus rings using the accent ring token, plus accessible names via `aria-label` or button text.
- Severity is communicated by both color and icon, never by color alone.

## Theming

Three modes: **System** (default — follows OS preference), **Light**, **Dark**. Toggle in the header cycles through them; the choice is persisted via `next-themes` (`localStorage`). Components consume semantic tokens (`bg-surface`, `text-fg-muted`, `border-stroke`, etc.) so palette tweaks live in one place — `src/app/globals.css`.

## Roadmap

- **Phase 1** — typed data layer + wiring (raw JSON view).
- **Phase 2** — Recharts volume chart, alert cards with severity icons + Gemini explanation, empty / error / refreshing states.
- **Phase 3** — Light/dark/system theming, trigger demo scenario menu, accessibility pass, mobile-responsive polish.
