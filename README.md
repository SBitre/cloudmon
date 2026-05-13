# CloudMon

**Real-time cloud event monitoring with AI-powered anomaly detection, built end-to-end on AWS.**

CloudMon ingests application events through a public HTTPS endpoint, detects anomalies using rule-based logic, generates natural-language explanations with Google Gemini, and surfaces alerts on a live dashboard — all within approximately 60 seconds of the underlying events.

🔗 **Live demo:** https://d35zff9b9ct6eh.cloudfront.net
📂 **Repository:** https://github.com/SBitre/cloudmon

---

## Table of Contents

- [What CloudMon Does](#what-cloudmon-does)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Deployment](#deployment)
- [Running the Simulator](#running-the-simulator)
- [Project Structure](#project-structure)
- [Engineering Practices](#engineering-practices)
- [Tear Down](#tear-down)
- [Team](#team)
- [License](#license)

---

## What CloudMon Does

Modern production systems generate thousands of operational alerts per week. Most are noise; truly important ones get lost. Even when an important alert fires, it's just a number on a dashboard — somebody has to figure out what it means and what to do about it.

CloudMon addresses this by combining:
- **Rule-based detection** for predictable, debuggable anomaly identification
- **AI-generated explanations** for rich, contextual narratives with actionable next steps

The result: every alert arrives pre-explained, ready for an on-call engineer to act on.

### Example Alert

```json
{
  "service": "login-service",
  "anomaly_type": "failed_login_burst",
  "severity": "critical",
  "explanation": "We've detected a sudden surge in failed login attempts on
    the login-service from IP 198.51.100.42. This pattern strongly suggests
    a brute-force or credential stuffing attack targeting user accounts.",
  "recommended_actions": [
    "Immediately investigate the source IP and review authentication logs",
    "Consider temporarily rate-limiting or blocking the suspicious IP",
    "Verify multi-factor authentication enforcement for affected accounts",
    "Notify the security team for incident response"
  ]
}
```

---

## Architecture
Simulator (Python)
│
│ POST /events (HTTPS)
▼
API Gateway (HTTP API v2)
│
▼
Ingest Lambda
│ put_item
▼
DynamoDB: cloudmon-events ◄────────┐
│                          │
│ queried every 1 min      │ queried by /events/volume
▼                          │
EventBridge schedule (cron)        │
│                          │
▼                          │
Detection Lambda                   │
│ rules engine             │
▼                          │
Google Gemini 2.5 Flash            │
│ structured JSON          │
▼                          │
DynamoDB: cloudmon-alerts          │
│                          │
│ queried by /alerts       │
▼                          │
Read API Lambda ◄──────────────────┘
│
▼
API Gateway (HTTP API v2)
│
▼
Next.js Dashboard (S3 + CloudFront)
│
▼
User's browser

### Key Design Choices

- **Hybrid AI architecture:** Detection is rule-based and deterministic. AI is used only for explanation, never for decision-making. If Gemini fails, the system falls back to templated explanations and alerts still fire.
- **Single-cloud deployment:** Backend and frontend both hosted on AWS for unified IAM, monitoring, and billing.
- **Infrastructure as Code:** Every AWS resource is defined in Terraform with remote state in S3 and DynamoDB-backed locking.
- **Least-privilege IAM:** Each Lambda has its own role with only the permissions it specifically needs.

---

## Tech Stack

### Backend (AWS)
- **AWS Lambda** (Python 3.12) — 3 functions: ingest, detection, read API
- **DynamoDB** (PAY_PER_REQUEST) — 2 tables: events, alerts
- **API Gateway** (HTTP API v2) — public HTTPS endpoints
- **EventBridge** — scheduled detection trigger (1-minute cadence)
- **CloudWatch Logs** — centralized logging
- **IAM** — least-privilege per-Lambda roles

### Frontend
- **Next.js 15** (App Router, static export) with TypeScript strict mode
- **Tailwind CSS v4** for styling
- **SWR** for data fetching with auto-refresh
- **Recharts** for visualizations
- **Zod** for runtime schema validation
- **next-themes** for light/dark/system themes
- **S3 + CloudFront** for hosting (with Origin Access Control)

### AI Layer
- **Google Gemini 2.5 Flash** via `google-genai` SDK
- Structured-output mode (`response_mime_type: application/json`) for deterministic parsing
- Falls back to templated explanations on failure

### Infrastructure
- **Terraform 1.x** — 5 modules: storage, ingest, detection, read_api, frontend
- **S3** — remote state bucket
- **DynamoDB** — state lock table

### Development
- **pytest + moto** — backend unit tests with AWS mocking
- **GitHub** — source control, PR review, project board

---

## Prerequisites

Before you begin, ensure you have:

- **AWS account** with admin or equivalent permissions
- **AWS CLI** installed and configured (`aws configure`)
- **Terraform** 1.5 or later ([install guide](https://developer.hashicorp.com/terraform/install))
- **Python** 3.12 or later
- **Node.js** 18 or later, with **npm**
- **Git** for cloning the repository
- **Google Gemini API key** — free tier works for development ([get one here](https://aistudio.google.com/app/apikey))

### AWS Permissions Needed

The IAM user or role you use for deployment needs permissions for:
- Lambda (create, update, delete functions)
- DynamoDB (create, update, delete tables)
- API Gateway (create, update, delete APIs)
- EventBridge (create, update, delete rules)
- S3 (create, update, delete buckets)
- CloudFront (create, update, delete distributions)
- IAM (create, update, delete roles and policies)
- CloudWatch (create log groups)

The simplest path is an IAM user with the `AdministratorAccess` policy, scoped to a non-production AWS account.

---

## Setup

### 1. Clone the Repository

```bash
git clone https://github.com/SBitre/cloudmon.git
cd cloudmon
```

### 2. Configure Terraform Variables

Copy the example variables file and fill in your values:

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Open `terraform.tfvars` in your editor and set:

```hcl
gemini_api_key = "AIzaSy..."  # Your Gemini API key
```

⚠️ **Never commit `terraform.tfvars`** — it's in `.gitignore` for a reason. It contains secrets.

### 3. Configure Remote State (Optional but Recommended)

If you want to use S3-backed remote state with locking (for team collaboration), create the state bucket and lock table first:

```bash
# Create state bucket (replace with your unique name)
aws s3api create-bucket \
  --bucket cloudmon-tfstate-yourname \
  --region us-east-1

# Enable versioning on the state bucket
aws s3api put-bucket-versioning \
  --bucket cloudmon-tfstate-yourname \
  --versioning-configuration Status=Enabled

# Create lock table
aws dynamodb create-table \
  --table-name cloudmon-tfstate-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

Then update `terraform/backend.tf` with your bucket name. For local-only development, you can skip this step — Terraform will use local state by default.

---

## Deployment

### 1. Initialize Terraform

```bash
cd terraform
terraform init
```

This downloads the AWS provider and (if configured) connects to remote state.

### 2. Review the Plan

```bash
terraform plan
```

This shows everything Terraform will create. Review it carefully. Expected resources include:
- 2 DynamoDB tables (events, alerts)
- 3 Lambda functions (ingest, detection, read API)
- 2 API Gateways (ingest, read API)
- 1 EventBridge rule
- 1 S3 bucket (dashboard)
- 1 CloudFront distribution
- 3 IAM roles + policies
- 3 CloudWatch log groups

Total ~25 resources.

### 3. Apply

```bash
terraform apply
```

Type `yes` when prompted. Deployment takes approximately 5-7 minutes (CloudFront distribution is the slowest).

### 4. Capture Outputs

After apply completes, capture the output URLs:

```bash
terraform output
```

Save these — you'll need them for the simulator and dashboard:

- `ingest_events_post_url` — for the simulator
- `read_api_alerts_url` — for the dashboard
- `read_api_events_volume_url` — for the dashboard
- `dashboard_url` — the public CloudFront URL

### 5. Build and Deploy the Dashboard

```bash
cd ../dashboard
npm install
```

Create `.env.local` with the API URLs from terraform output:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_ALERTS_API_URL=https://your-read-api-url.execute-api.us-east-1.amazonaws.com/alerts
NEXT_PUBLIC_EVENTS_VOLUME_API_URL=https://your-read-api-url.execute-api.us-east-1.amazonaws.com/events/volume
NEXT_PUBLIC_INGEST_API_URL=https://your-ingest-api-url.execute-api.us-east-1.amazonaws.com/events
```

Build the static site:

```bash
npm run build
```

Upload to S3:

```bash
aws s3 sync out/ s3://cloudmon-dashboard --delete
```

Invalidate the CloudFront cache so changes appear immediately:

```bash
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

Get your distribution ID from `terraform output cloudfront_distribution_id`.

Visit the `dashboard_url` from terraform output to see the live dashboard.

---

## Running the Simulator

The simulator generates synthetic events that match the project's schema, modeling realistic application traffic and attack scenarios.

### Setup Python Environment

```bash
cd ..  # back to repo root
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Set the Ingest Endpoint

```bash
export INGEST_URL="https://your-ingest-api-url.execute-api.us-east-1.amazonaws.com/events"
```

(On Windows PowerShell: `$env:INGEST_URL = "https://..."`)

### Available Scenarios

#### Credential Stuffing Attack

Simulates a brute-force login attack from a single IP:

```bash
python -m simulator.scenarios.credential_stuffing \
  --count 25 \
  --single-ip 198.51.100.42 \
  --duration 8
```

Triggers a `failed_login_burst` alert within ~60 seconds.

#### API Error Spike

Simulates a service experiencing elevated error rates:

```bash
python -m simulator.scenarios.error_spike \
  --service checkout-service \
  --count 25 \
  --duration 5
```

Triggers an `api_error_spike` alert within ~60 seconds.

#### Payment Failure Burst

Simulates payment processing failures:

```bash
python -m simulator.scenarios.payment_failure_burst \
  --count 15 \
  --duration 5
```

Triggers a `payment_failure_burst` alert within ~60 seconds.

#### Continuous Background Traffic

Generates a realistic mixed-event stream that exercises the full pipeline without necessarily triggering alerts:

```bash
python -m simulator.runner --duration 600
```

(Runs for 10 minutes by default; adjust `--duration` as needed.)

### Verifying Events Arrived

After firing a scenario, you can verify events landed:

```bash
curl https://your-read-api-url.execute-api.us-east-1.amazonaws.com/events/volume \
  | python -m json.tool
```

And alerts (after waiting ~60 seconds):

```bash
curl https://your-read-api-url.execute-api.us-east-1.amazonaws.com/alerts \
  | python -m json.tool | head -50
```

---

## Project Structure
cloudmon/
├── README.md                     # This file
├── .gitignore                    # Excludes secrets, state, build artifacts
├── requirements.txt              # Python dependencies for simulator
│
├── terraform/                    # Infrastructure as Code
│   ├── main.tf                   # Top-level configuration
│   ├── variables.tf              # Input variables
│   ├── outputs.tf                # Outputs (URLs, IDs)
│   ├── backend.tf                # Remote state config
│   ├── terraform.tfvars.example  # Template for secrets (committed)
│   ├── terraform.tfvars          # Real secrets (NOT committed)
│   └── modules/
│       ├── storage/              # DynamoDB tables
│       ├── ingest/               # Ingest Lambda + API Gateway
│       ├── detection/            # Detection Lambda + EventBridge
│       ├── read_api/             # Read API Lambda + API Gateway
│       └── frontend/             # S3 + CloudFront + OAC
│
├── lambdas/                      # Lambda function source code
│   ├── ingest/
│   │   ├── handler.py            # Ingest Lambda code
│   │   └── requirements.txt      # Lambda-specific dependencies
│   ├── detection/
│   │   ├── handler.py            # Detection rules + Gemini integration
│   │   └── requirements.txt
│   └── api/
│       ├── handler.py            # Read API endpoints
│       └── requirements.txt
│
├── simulator/                    # Python event simulator
│   ├── init.py
│   ├── runner.py                 # Main runner
│   ├── factory.py                # Event generation
│   ├── http_client.py            # HTTP with retry/circuit breaker
│   ├── scenarios/                # Pre-built attack scenarios
│   │   ├── credential_stuffing.py
│   │   ├── error_spike.py
│   │   └── payment_failure_burst.py
│   └── tests/                    # 73 unit tests at 100% branch coverage
│
├── dashboard/                    # Next.js frontend
│   ├── package.json
│   ├── next.config.ts            # Static export configuration
│   ├── tsconfig.json
│   ├── .env.example              # Template for env vars
│   ├── app/                      # Next.js App Router pages
│   ├── components/               # React components
│   └── lib/                      # Utilities, API client, Zod schemas
│
└── docs/                         # Documentation
├── event-schema.md           # Canonical event schema
├── architecture-diagram.png  # Visual architecture
└── screenshots/              # Dashboard and console screenshots

---

## Engineering Practices

This project was built with several deliberate engineering practices:

### Schema-First Development

The event schema (`docs/event-schema.md`) was written before any code. All components — simulator, ingest Lambda, detection Lambda, dashboard — derive their behavior from this single source of truth. This caught at least one critical bug (camelCase vs snake_case field naming) during PR review.

### Infrastructure as Code

Every AWS resource is defined in Terraform. There are no manually-created resources. The entire stack is `terraform destroy`-able and `terraform apply`-able, making it reproducible across environments.

### Least-Privilege IAM

Each Lambda has its own IAM role with explicit permissions for only the DynamoDB tables and operations it specifically needs. The ingest Lambda can `PutItem` on the events table but cannot read it. The read API can read but cannot write. No wildcards.

### PR Review Workflow

All work happened on feature branches, opened as pull requests, with at least one substantive review before merge. Multiple real bugs were caught in PR review:
- Schema field naming mismatch
- Hallucinated Gemini model name (`gemini-3-flash-preview`)
- Missing IAM permissions for new DynamoDB operations

### Testing

The simulator package has **73 unit tests at 100% branch coverage**, using moto to mock AWS without hitting real services. Tests run in ~2 seconds with no AWS credentials required.

### Runtime Validation

The dashboard uses **Zod** to validate every API response at runtime, so malformed payloads are caught at the network boundary and converted to structured errors. A bug in the backend cannot crash the UI.

---

## Tear Down

To remove everything from AWS and stop all charges:

```bash
# 1. Empty the dashboard S3 bucket first (Terraform cannot destroy non-empty buckets)
aws s3 rm s3://cloudmon-dashboard --recursive

# 2. Destroy all Terraform-managed resources
cd terraform
terraform destroy
```

Type `yes` when prompted. Tear-down takes approximately 5-7 minutes (CloudFront is slowest).

If you set up the state bucket and lock table manually, you'll need to delete those separately:

```bash
aws s3 rb s3://cloudmon-tfstate-yourname --force
aws dynamodb delete-table --table-name cloudmon-tfstate-lock --region us-east-1
```

---

## Team

| Member | Role | Contribution |
|---|---|---|
| **Sahil Pitre** | Infrastructure Lead | 5 Terraform modules, IAM, deployment, IaC patterns |
| **Darkhan Akmyrza** | Backend (Ingest + Read API) | Lambdas, validation, Decimal serialization fix |
| **Gospelhope** | Detection + AI Integration | Rule engine, Gemini integration, deduplication |
| **Mehek Khan** | Simulator + Dashboard | 73-test simulator, full Next.js dashboard |
| **Kanav** | AWS Account | Provisioned deployment environment |

---

## Acknowledgments

- **Course:** Cloud Analytics, Spring 2026
- **AI tools disclosure:** AI coding assistants were used during development for code completion and documentation drafting. All output was reviewed and verified by team members before integration. Architecture diagrams were generated with AI based on team-specified system design.

---

## License

This project was built for academic purposes as part of a graduate Cloud Analytics course. Code is provided as-is for educational reference. Not licensed for production use without modification and proper security review.

---

## Questions or Issues

Please open a GitHub issue: https://github.com/SBitre/cloudmon/issues
