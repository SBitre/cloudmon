# CloudMon Simulator

CloudMon simulator is the traffic generator and scenario driver for this project.  
It creates realistic cloud-monitoring events, sends them to the ingest API, supports resilient delivery behavior (retry/backoff + circuit breaker), persists failed sends to dead-letter files, and can replay dead-letter events later.

---

## What this module is for

Use `simulator/` when you need to:

- generate continuous background traffic for end-to-end testing
- trigger deterministic anomaly scenarios for demos
- validate detection and alerting behavior under burst conditions
- run repeatable load profiles in local/staging environments
- recover failed events by replaying dead-letter files

This module is designed for operational safety and reproducibility, not just one-off demo scripts.

---

## Features

- Realistic weighted background event mix:
  - `successful_login` (60%)
  - `failed_login` (10%)
  - `api_call` (20%)
  - `api_error` (5%)
  - `payment_success` (4%)
  - `payment_failed` (1%)
- Scenario scripts for focused incidents:
  - credential stuffing
  - API error spike
  - payment failure burst
- Delivery hardening:
  - timeout
  - retry with exponential backoff
  - circuit breaker with cooldown
- Dead-letter persistence to JSONL
- Dead-letter replay command with rate limiting and dry-run mode
- Plain or JSON structured logs
- JSON/YAML profile files for repeatable runs

---

## Project layout

Primary modules:

- `simulator/core/`: domain logic
  - `event_factory.py`: event generation
  - `profile_config.py`: JSON/YAML profile loading and overrides
- `simulator/infra/`: infrastructure adapters
  - `ingest_client.py`: HTTP delivery + retry + circuit breaker
  - `dead_letter.py`: dead-letter JSONL writer
  - `logging.py`: plain/JSON logging setup
- `simulator/cli/`: command implementations
  - `background.py`: background traffic command
  - `replay.py`: dead-letter replay command
- `simulator/scenarios/`: scenario-specific CLIs + shared scenario runner
  - `common.py`: shared scenario execution logic
  - `credential_stuffing.py`, `error_spike.py`, `payment_failure_burst.py`
- `simulator/profiles/`: sample profile files

CLI wrappers are kept at `simulator/simulator.py` and `simulator/replay_dead_letter.py` so the original command surface remains stable.

---

## Prerequisites

- Python 3.10+
- `INGEST_URL` environment variable pointing to deployed ingest endpoint

Set ingest URL:

```bash
export INGEST_URL="https://<api-id>.execute-api.<region>.amazonaws.com/events"
```

---

## Installation

From repository root:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r simulator/requirements.txt
```

For local development + tests:

```bash
pip install -r simulator/requirements-dev.txt
```

---

## Background simulator

Run continuous background traffic:

```bash
python -m simulator.simulator
```

Example with common production-style options:

```bash
python -m simulator.simulator \
  --rate 8 \
  --duration 120 \
  --timeout 4 \
  --max-retries 4 \
  --initial-backoff 0.25 \
  --max-backoff 3.0 \
  --circuit-failure-threshold 5 \
  --circuit-recovery-timeout 30 \
  --dead-letter-path simulator/out/dead-letter-background.jsonl \
  --stats-interval 10 \
  --log-format json
```

### Background simulator flags

- `--profile`: optional JSON/YAML profile file
- `--rate`: events/sec target send rate (default `5.0`)
- `--duration`: optional run length in seconds (default continuous)
- `--seed`: deterministic random stream seed
- `--timeout`: per-request timeout seconds (default `5.0`)
- `--max-retries`: retry attempts for transient failures (default `2`)
- `--initial-backoff`: initial retry backoff seconds (default `0.2`)
- `--max-backoff`: max retry backoff seconds (default `2.0`)
- `--circuit-failure-threshold`: consecutive failed sends before circuit opens (default `5`)
- `--circuit-recovery-timeout`: cooldown before circuit allows send attempts again (default `30.0`)
- `--dead-letter-path`: optional JSONL output path for failed events
- `--stats-interval`: periodic progress log interval seconds (default `30.0`)
- `--log-format`: `plain` or `json` (default `plain`)

---

## Scenario scripts

All scenarios share the same reliability/logging infrastructure as background simulator.

### 1) Credential stuffing

Default behavior (**distributed mode**): 200 `failed_login` events in 30 seconds, spread across sequential IPs (`198.51.100.1`, `198.51.100.2`, …), target `login-service`. Models a botnet-style attack where many IPs each try a small number of logins.

```bash
python -m simulator.scenarios.credential_stuffing
```

**Centralized mode** (`--single-ip <ipv4>`): every event uses the same source IP. Models a single attacker hammering one account pool — this is the pattern that triggers the `failed_login_burst` detection rule (≥10 failures from one IP in the lookback window).

```bash
python -m simulator.scenarios.credential_stuffing --count 50 --duration 10 --single-ip 198.51.100.42
```

Use distributed mode to demonstrate the limits of the current rule (slow + spread-out attacks slip through), and centralized mode to demonstrate the rule firing end-to-end with a Gemini explanation.

### 2) API error spike

Default behavior: burst of `api_error` events from one service.

```bash
python -m simulator.scenarios.error_spike --service checkout-service --count 120 --duration 20
```

### 3) Payment failure burst

Default behavior: burst of `payment_failed` events from one service.

```bash
python -m simulator.scenarios.payment_failure_burst --service payment-service --count 80 --duration 20
```

### Scenario flags (all scenario commands)

- `--profile`
- `--count`
- `--duration`
- `--timeout`
- `--max-retries`
- `--initial-backoff`
- `--max-backoff`
- `--circuit-failure-threshold`
- `--circuit-recovery-timeout`
- `--dead-letter-path`
- `--log-format`
- `--seed`

Scenario-specific extra flags:

- `credential_stuffing`: `--ip-prefix`, `--single-ip`
- `error_spike`: `--service`
- `payment_failure_burst`: `--service`

---

## Profile files (JSON/YAML)

Profiles let you store run configs in source control and execute reproducibly.

Run with profile:

```bash
python -m simulator.simulator --profile simulator/profiles/background-demo.json
python -m simulator.scenarios.error_spike --profile simulator/profiles/error-spike-demo.yaml
```

Precedence rule:

- CLI defaults load first
- profile values override defaults
- explicit CLI flags are parsed before profile load in this implementation, so profile values are final

Recommended profile keys for background simulator:

- `rate`, `duration`, `seed`
- `timeout`
- `max_retries`, `initial_backoff`, `max_backoff`
- `circuit_failure_threshold`, `circuit_recovery_timeout`
- `dead_letter_path`
- `stats_interval`
- `log_format`

Recommended profile keys for scenarios:

- `count`, `duration`, `seed`
- scenario-specific key (`service` or `ip_prefix`)
- reliability/logging keys listed above

---

## Dead-letter format

When `--dead-letter-path` is set, each failed send appends one JSON line:

```json
{
  "recorded_at": "2026-05-04T23:40:00Z",
  "reason": "http_503",
  "event": {
    "...": "original event payload"
  }
}
```

`reason` can include:

- `http_<status>` for terminal HTTP failures
- `request_exception` for transport-level failures
- `circuit_open` when send was skipped due to open circuit
- `send_failed` as generic fallback

---

## Replay dead-letter events

Replay failed events back to ingest:

```bash
python -m simulator.replay_dead_letter --dead-letter-path simulator/out/dead-letter.jsonl
```

Dry-run validation without sending:

```bash
python -m simulator.replay_dead_letter \
  --dead-letter-path simulator/out/dead-letter.jsonl \
  --dry-run \
  --log-format json
```

Replay with throughput controls:

```bash
python -m simulator.replay_dead_letter \
  --dead-letter-path simulator/out/dead-letter.jsonl \
  --rate 10 \
  --limit 500
```

Replay flags:

- `--dead-letter-path` (required)
- `--profile`
- `--rate`
- `--limit`
- `--timeout`
- `--max-retries`
- `--initial-backoff`
- `--max-backoff`
- `--circuit-failure-threshold`
- `--circuit-recovery-timeout`
- `--log-format`
- `--dry-run`

---

## Logging modes

- `plain`: human-readable logs for local terminal sessions
- `json`: one JSON object per log line for ingestion into log pipelines

JSON logs include:

- UTC timestamp
- level
- logger name
- message

---

## Data contract guarantees

This module intentionally aligns with `docs/event-schema.md`:

- all event keys are `snake_case`
- `event_id` is UUID
- `timestamp` is ISO 8601 UTC (`Z` suffix)
- optional fields are filled by event-type context (endpoint, user_id, metadata, etc.)

---

## Testing and quality gate

Run all simulator tests:

```bash
python -m pytest simulator/tests -q
```

Current quality gate in this folder enforces:

- 100% branch coverage on simulator source modules
- comprehensive unit tests across generator, client, scenario orchestration, logging, profiles, dead-letter writing, and replay flow

---

## Troubleshooting

- `INGEST_URL environment variable is required`:
  - export `INGEST_URL` before running non-dry-run commands
- Many dead-letter entries with `circuit_open`:
  - ingest likely still unhealthy; either wait cooldown or tune circuit settings
- Replay shows malformed lines:
  - dead-letter file may contain non-JSON/non-event lines; use `--dry-run` to audit first
- Too aggressive traffic:
  - lower `--rate`, increase `--timeout`, and tune retries/backoff
- Need reproducible outputs:
  - pass `--seed` and use profile files committed in repo

---

## Quick recipes

- Fast local smoke test:
  - `python -m simulator.simulator --duration 10 --rate 2`
- JSON telemetry with safe persistence:
  - `python -m simulator.simulator --log-format json --dead-letter-path simulator/out/dlq.jsonl`
- Incident demo flow:
  - run background simulator
  - run `error_spike` scenario
  - inspect alerts/dashboard
  - replay dead-letter if needed
