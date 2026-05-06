# CloudMon Dashboard

Real-time Next.js 15 ops dashboard for the CloudMon read API: live event volume, AI-explained alerts, derived KPI summary, an in-page demo trigger, and full theming.

## Features at a glance

| | |
|---|---|
| **KPI strip** | Six tiles: total alerts · critical · error · warning · events / 5 min · top affected service (with freshness indicator) |
| **Event volume chart** | Recharts bar chart over the user's selected window (15 / 30 / 60 / 120 min). Most-recent bar highlighted. **Click a bar to filter alerts to that minute.** |
| **Breakdown panel** | Severity donut · Top services · Top anomaly types — all derived client-side from `/alerts`, no extra API calls |
| **Alerts panel** | Severity-tinted cards with AI-sparkle Gemini explanation, check-circle recommended actions, expandable triggering-events table (sticky header, full-text wrap) |
| **Filters** | Severity / Service / Anomaly type chip strips · click-to-toggle · live counts · "Clear filters" affordance |
| **Trigger menu** | 8 scenarios (anomaly / traffic / custom) · customizable count · readiness hint · AbortController cancel |
| **Settings** | Polling interval · volume window · density · accent color (4 tones, all theme-aware) — persisted to localStorage |
| **Theme toggle** | System / Light / Dark via `next-themes` |
| **Robustness** | Zod runtime validation · per-panel error boundary + Retry · skeleton loaders · stale indicator · 8s request timeouts |
| **A11y** | Skip link · semantic landmarks · `aria-live` alerts panel · accent focus rings · severity = icon + color |

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) | Modern React 19; statically prerenders the dashboard |
| Language | TypeScript (strict) | Wire-level types match `docs/event-schema.md` exactly via Zod-inferred shapes |
| Styling | Tailwind CSS v4 (`@theme inline`) | Semantic utility tokens (`bg-surface`, `text-fg`, `--color-accent`) flip with theme |
| Theming | `next-themes` | System / light / dark with persistence |
| Data fetching | SWR | Stale-while-revalidate, auto-pause on tab blur, errors keep last good data |
| Validation | Zod | Runtime schema validation at the network boundary |
| Charts | Recharts | Bar chart + pie + horizontal leaderboards |
| Icons | lucide-react | Tree-shaken; ~3 KB per icon |

## Project layout

```
dashboard/
├── README.md
├── .env.example
└── src/
    ├── app/
    │   ├── layout.tsx              # ThemeProvider + AccentApplier mount
    │   ├── page.tsx                # Composition: header → KPIs → charts → filters → alerts
    │   ├── globals.css             # Semantic theme tokens, ambient gradient, animations
    │   └── icon.svg                # Brand favicon (auto-detected by Next.js)
    │
    ├── components/
    │   ├── api-result-panel.tsx    # Loading / error / refreshing / stale shell + Retry
    │   ├── alert-card.tsx          # Severity-tinted card with AI explanation
    │   ├── alert-list.tsx          # Filtered + sorted list
    │   ├── kpi-strip.tsx           # Six-tile summary
    │   ├── volume-chart.tsx        # Live bar chart with click-to-filter-by-minute
    │   ├── severity-filter-strip.tsx
    │   ├── facet-filter-strip.tsx  # Generic over services / anomalyTypes
    │   ├── trigger-scenario-menu.tsx
    │   ├── settings-menu.tsx
    │   ├── error-boundary.tsx
    │   ├── theme/                  # ThemeProvider, ThemeToggle, AccentApplier
    │   ├── ui/                     # Pill, SeverityBadge, Skeleton, Icons
    │   ├── charts/                 # SeverityDonut, LeaderboardChart
    │   └── skeletons/              # ChartSkeleton, AlertListSkeleton
    │
    └── lib/
        ├── api/                    # client.ts (read API), ingest.ts (browser POST), scenarios.ts
        ├── derive/                 # alerts.ts pure aggregations (countBySeverity, topServices, …)
        ├── format/                 # time.ts (utcNowIso8601, formatRelativeTime, …)
        ├── hooks/                  # use-cloudmon-api.ts (SWR adapters)
        ├── store/
        │   ├── settings.ts         # Persisted: polling, window, density, accent
        │   ├── filters.ts          # Ephemeral: severity, services, anomalyTypes, minute
        │   └── custom-scenario.ts  # Persisted: custom-event form state
        └── types/
            ├── schemas.ts          # Zod schemas (single source of truth)
            └── api.ts              # Re-exports inferred TS types
```

### Architectural invariants

- **Components never fetch.** They only consume hooks via props.
- **`lib/api/*` never imports React.** Unit-testable in isolation.
- **All wire shapes live in `lib/types/schemas.ts`.** Zod schema doubles as the TS type via `z.infer<>`.
- **All visual tokens live in `app/globals.css`** (`@theme inline`). A theme flip touches one file.
- **View state vs config state are separate stores.** Filters reset on reload; settings persist.

## Prerequisites

- Node.js 20+ (tested on 24.x)
- npm 10+

## Setup

```bash
cd dashboard
npm install
cp .env.example .env.local      # edit if pointing at a non-default API
```

The default `.env.example` points at the team's `us-east-1` deployment. Resolve a fresh value with:

```bash
cd ../terraform && terraform output -raw read_api_endpoint
```

The dashboard refuses to start without `NEXT_PUBLIC_API_URL` to keep deployments honest.

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

`NEXT_PUBLIC_*` variables are inlined at build time and visible in the browser bundle by design. Do **not** put secrets here.

## Data-flow contract

The dashboard consumes two read-only endpoints (documented in `docs/event-schema.md`, produced by `lambdas/api/handler.py`) and optionally posts to one write endpoint when the trigger menu is enabled.

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

### `POST /events` (only used by the in-page trigger menu)

Browser POSTs schema-compliant `SyntheticEvent` payloads (matches `docs/event-schema.md`). All optional fields are omitted from the body when empty.

## Polling behavior

- Refresh interval: configurable in Settings (1 / 3 / 5 / 10 s, or **Off**), default 3 s.
- Auto-pauses when the tab is backgrounded (SWR default).
- Refetches immediately on tab focus and network reconnect.
- A failed poll keeps the last successful payload visible — the dashboard never blanks out mid-demo because of a transient hiccup.
- Each panel tracks last-update; a "stale" pill appears when `> max(2 × interval, 30 s)` has passed without success.

## Filters

Click chips in the filter bar to toggle:
- **Severity** — info / warning / error / critical (icons match colors)
- **Services** — top 5 services by alert count
- **Anomaly types** — top 5 anomaly types by alert count

You can also **click a bar in the volume chart** to scope alerts to that minute. The selected bar turns amber, others dim, and a clear pill appears in the volume panel header.

All filters are ephemeral by design (do not persist across reloads). "Clear filters" appears in the strip when any filter is active.

## In-page Trigger Scenario menu

Active when `NEXT_PUBLIC_INGEST_URL` is set. Eight scenarios across three groups:

**Anomaly** (designed to trigger detection rules):
- Credential stuffing burst → `failed_login_burst`
- API error spike → `api_error_spike`
- Payment failure burst → `payment_failure_burst`

**Traffic** (populate the volume chart, no alerts expected):
- Realistic traffic mix — weighted 60/10/20/5/4/1 distribution matching the Python simulator
- Successful login burst
- API call burst
- Payment success burst

**Custom** — define your own `event_type`, `severity`, `service`, plus optional `endpoint` / `status_code` / `ip_address` / `user_id` / `error_message`. Form state persists across reloads.

Each scenario declares its own min/max/default count. The status block predicts whether the run will trigger any detection rule at the current count, with the formula `expected_events_of_relevant_type ≥ threshold`. Cancel mid-run with a real `AbortController` — aborts in-flight requests and inter-event sleep both.

## Accessibility

- Skip-to-content link visible on focus.
- Semantic landmarks (`<header>`, `<main>`, `<footer>`, `<section aria-label>`).
- Alerts panel has `aria-live="polite"` so screen readers announce new alerts as they arrive.
- All interactive controls (theme toggle, settings, scenario picker, filters, triggering-events disclosure) have visible accent focus rings + accessible names.
- Severity is communicated by **icon + color**, never color alone.

## Theming

Three modes: **System** (default — follows OS preference), **Light**, **Dark**. Toggle in the header cycles through them; choice persists via `next-themes` (`localStorage`).

Components consume semantic tokens (`bg-surface`, `text-fg-muted`, `border-stroke`, `--color-accent`, …) so a palette tweak lives in one file (`src/app/globals.css`).

The **accent picker** in Settings (emerald / blue / violet / amber) overrides the `--color-accent*` CSS vars on `<html>`. Each accent ships a tuned palette per theme so contrast stays right in both modes.

## Quality gates

- ESLint: clean
- `tsc --noEmit` (TypeScript strict): clean
- `next build`: clean (`/` route ≈ 260 KB First Load JS, statically prerendered)
- `ReadLints` over `dashboard/`: zero errors

## Roadmap

- **Phase 1** — typed data layer + wiring (raw JSON view).
- **Phase 2** — Recharts volume chart, alert cards with severity icons + Gemini explanation.
- **Phase 3** — Light/dark/system theming, trigger demo menu, settings store, accessibility pass.
- **Phase 4** — KPI strip, breakdown charts (severity donut + top services + top anomaly types), service/anomaly/minute filters with click-to-filter on volume bars, brand favicon, layout tightening.
