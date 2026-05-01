# CloudMon — Real-Time Cloud Event Monitoring with AI Explanations

A real-time cloud event monitoring and anomaly detection system on AWS, with an AI-powered explanation layer using Gemini. Course project for [Course Name], [Semester].

## What this is

A serverless backend that ingests application events (failed logins, API errors, traffic spikes), detects anomalies in real time, and uses generative AI to explain likely root causes and recommended actions. Think mini Datadog, with an AI triage layer on top.

For full context, see [`docs/project-scope.md`](docs/project-scope.md).

## Architecture

API Gateway → Ingest Lambda → DynamoDB → Detection Lambda (scheduled) → Gemini API → Alerts table → Next.js dashboard.

Architecture diagram: [`docs/architecture.md`](docs/architecture.md)

## Tech stack

- **AWS**: Lambda, API Gateway, DynamoDB, EventBridge
- **IaC**: Terraform
- **AI**: Gemini API
- **Frontend**: Next.js
- **Simulator**: Python

## Team & roles

| Role | Owner | Folder ownership |
|---|---|---|
| Infrastructure Lead | Sumukh Pitre | `/terraform`, `/scripts` |
| Backend Engineer | TBD | `/lambdas/ingest`, `/lambdas/api` |
| Detection + AI Engineer | TBD | `/lambdas/detection` |
| Simulator + Frontend | TBD | `/simulator`, `/dashboard` |
| Documentation + Demo | TBD | `/docs` |

## Branching & contributing

- Never push to `main` directly
- Work on feature branches: `feature/<area>-<description>` (e.g. `feature/ingest-lambda`)
- Open PRs into `main`, get one teammate to review, merge
- Pull latest `main` into your branch daily to avoid merge hell

See [`docs/contributing.md`](docs/contributing.md) for full workflow.

## Timeline

- **May 1–2**: Setup (AWS, repo, event schema)
- **May 3–4**: Ingest pipeline
- **May 5–6**: Detection + Gemini integration
- **May 7–8**: Dashboard
- **May 9**: Polish + docs
- **May 10**: Submit (May 11–12 buffer)

## Deployment

TBD — will be filled in by Infra Lead once Terraform is set up.

## Local development

TBD — will be filled in as components are built.