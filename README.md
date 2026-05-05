# CloudMon — Real-Time Cloud Event Monitoring with AI Explanations

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Terraform](https://img.shields.io/badge/Terraform-%E2%89%A51.0-7B42BC?logo=terraform&logoColor=white)](https://www.terraform.io/)
[![AWS](https://img.shields.io/badge/AWS-Lambda%20%7C%20DynamoDB%20%7C%20API%20Gateway-FF9900?logo=amazonaws&logoColor=white)](https://aws.amazon.com/)
[![Next.js](https://img.shields.io/badge/Next.js-React-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)

A real-time cloud event monitoring and anomaly detection system on AWS, with an AI-powered explanation layer using Gemini. Course project for [Course Name], [Semester].

## What this is

A serverless backend that ingests application events (failed logins, API errors, traffic spikes), detects anomalies in real time, and uses generative AI to explain likely root causes and recommended actions. Think mini Datadog, with an AI triage layer on top.

For full context, see [`docs/project-scope.md`](docs/project-scope.md).

## Architecture

API Gateway → Ingest Lambda → DynamoDB → Detection Lambda (scheduled) → Gemini API → Alerts table → Next.js dashboard.

Five Lambda-backed components, two HTTP APIs, two DynamoDB tables, one EventBridge schedule. Full diagram and resource inventory in [`docs/architecture.md`](docs/architecture.md).

## Subsystems

| Subsystem | Path | What it does | README |
|---|---|---|---|
| Infrastructure | [`terraform/`](terraform/) | Provisions all AWS resources via Terraform (S3-backed remote state) | — |
| Ingest API | [`lambdas/ingest/`](lambdas/ingest/) | Validates incoming events and writes them to DynamoDB | — |
| Detection | [`lambdas/detection/`](lambdas/detection/) | Scheduled scan, anomaly detection, Gemini-generated alert explanations | — |
| Read API | [`lambdas/api/`](lambdas/api/) | Exposes `/events/volume` and `/alerts` to the dashboard | — |
| Simulator | [`simulator/`](simulator/) | Background traffic + scenario triggers with retry, circuit breaker, dead-letter, JSON logs, profiles | [`simulator/README.md`](simulator/README.md) |
| Dashboard | [`dashboard/`](dashboard/) | Next.js UI for live volume + alerts | — |
| Event schema | [`docs/event-schema.md`](docs/event-schema.md) | Wire-level contract shared by all subsystems | — |

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
| Backend Engineer | Darkhan & Kanav | `/lambdas/ingest`, `/lambdas/api` |
| Detection + AI Engineer | Gospelhope | `/lambdas/detection` |
| Simulator + Frontend | Mehek | `/simulator`, `/dashboard` |
| Documentation + Demo | Kanav | `/docs` |

## Branching & contributing

- Never push to `main` directly.
- Branch naming: `feature/<area>-<description>`, `fix/<area>-<description>`, `bugfix/<area>-<description>`, `docs/<description>`.
- Open PRs into `main`, get one teammate to review, merge.
- Pull latest `main` into your branch daily to avoid merge hell.

See [`docs/contributing.md`](docs/contributing.md) for full workflow.

## Timeline

- [x] **May 1–2**: Setup (AWS, repo, event schema)
- [x] **May 3–4**: Ingest pipeline
- [x] **May 5–6**: Detection + Gemini integration
- [x] **May 5**: Simulator with background traffic + scenario triggers
- [ ] **May 7–8**: Dashboard
- [ ] **May 9**: Polish + docs
- [ ] **May 10**: Submit (May 11–12 buffer)

## Deployment

TBD — will be filled in by Infra Lead once Terraform is set up.

## Local development

TBD — will be filled in as components are built.

## License

[MIT](LICENSE).