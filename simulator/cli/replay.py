"""Dead-letter replay CLI implementation."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import time
from typing import Any

from simulator.core.profile_config import apply_profile_overrides, load_profile
from simulator.infra.ingest_client import CircuitBreakerConfig, IngestClient, RetryConfig
from simulator.infra.logging import configure_logging
import logging

EventPayload = dict[str, Any]


def parse_args() -> argparse.Namespace:
    """Parse CLI arguments for dead-letter replay execution."""
    parser = argparse.ArgumentParser(description="Replay failed simulator events from dead-letter JSONL file.")
    parser.add_argument("--dead-letter-path", type=str, required=True, help="Path to dead-letter JSONL file.")
    parser.add_argument("--profile", type=str, default=None, help="Optional JSON/YAML profile file.")
    parser.add_argument("--rate", type=float, default=5.0, help="Replay sends per second (default: 5).")
    parser.add_argument("--limit", type=int, default=None, help="Optional max events to replay from file.")
    parser.add_argument("--timeout", type=float, default=5.0, help="Per-request timeout in seconds.")
    parser.add_argument("--max-retries", type=int, default=2, help="Retry attempts for transient failures.")
    parser.add_argument("--initial-backoff", type=float, default=0.2, help="Initial retry backoff in seconds.")
    parser.add_argument("--max-backoff", type=float, default=2.0, help="Maximum retry backoff in seconds.")
    parser.add_argument("--circuit-failure-threshold", type=int, default=5, help="Failure count to open circuit.")
    parser.add_argument("--circuit-recovery-timeout", type=float, default=30.0, help="Circuit cooldown in seconds.")
    parser.add_argument("--log-format", type=str, choices=("plain", "json"), default="plain", help="Log format.")
    parser.add_argument("--dry-run", action="store_true", help="Validate and count replay entries without sending.")
    args = parser.parse_args()

    if args.profile:
        profile = load_profile(args.profile)
        args = apply_profile_overrides(
            args,
            profile,
            keys=(
                "dead_letter_path",
                "rate",
                "limit",
                "timeout",
                "max_retries",
                "initial_backoff",
                "max_backoff",
                "circuit_failure_threshold",
                "circuit_recovery_timeout",
                "log_format",
                "dry_run",
            ),
        )
    return args


def _require_ingest_url() -> str:
    """Read and validate ingest endpoint from `INGEST_URL` environment variable."""
    ingest_url = os.environ.get("INGEST_URL", "").strip()
    if not ingest_url:
        raise RuntimeError("INGEST_URL environment variable is required")
    return ingest_url


def _extract_event(line: str) -> EventPayload | None:
    """Parse one dead-letter line and extract the nested event payload."""
    try:
        parsed = json.loads(line)
    except json.JSONDecodeError:
        return None
    if not isinstance(parsed, dict):
        return None
    event = parsed.get("event")
    if not isinstance(event, dict):
        return None
    return event


def replay_events(
    dead_letter_path: str,
    *,
    rate: float,
    limit: int | None,
    ingest_client: IngestClient | None,
    dry_run: bool,
) -> dict[str, int]:
    """Replay dead-letter entries and return replay summary statistics."""
    if rate <= 0:
        raise ValueError("rate must be positive")
    if limit is not None and limit <= 0:
        raise ValueError("limit must be positive when provided")

    logger = logging.getLogger("DeadLetterReplay")
    sleep_interval = 1.0 / rate

    stats = {
        "lines_read": 0,
        "events_attempted": 0,
        "events_replayed": 0,
        "events_failed": 0,
        "events_malformed": 0,
    }

    path = Path(dead_letter_path)
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            if limit is not None and stats["events_attempted"] >= limit:
                break

            stats["lines_read"] += 1
            event = _extract_event(line)
            if event is None:
                stats["events_malformed"] += 1
                logger.warning("Skipping malformed dead-letter line index=%d", stats["lines_read"])
                continue

            stats["events_attempted"] += 1
            if dry_run:
                stats["events_replayed"] += 1
                continue

            if ingest_client is None:
                raise RuntimeError("ingest_client is required when dry_run is False")

            if ingest_client.send_event(event):
                stats["events_replayed"] += 1
            else:
                stats["events_failed"] += 1

            time.sleep(sleep_interval)

    return stats


def main() -> None:
    """CLI entrypoint for dead-letter replay command."""
    args = parse_args()
    configure_logging(args.log_format)

    ingest_client: IngestClient | None = None
    if not args.dry_run:
        ingest_client = IngestClient(
            ingest_url=_require_ingest_url(),
            timeout_seconds=args.timeout,
            retry_config=RetryConfig(
                max_retries=args.max_retries,
                initial_backoff_seconds=args.initial_backoff,
                max_backoff_seconds=args.max_backoff,
            ),
            circuit_breaker_config=CircuitBreakerConfig(
                failure_threshold=args.circuit_failure_threshold,
                recovery_timeout_seconds=args.circuit_recovery_timeout,
            ),
        )

    stats = replay_events(
        args.dead_letter_path,
        rate=args.rate,
        limit=args.limit,
        ingest_client=ingest_client,
        dry_run=args.dry_run,
    )
    logging.getLogger("DeadLetterReplay").info(
        "Replay complete lines_read=%d attempted=%d replayed=%d failed=%d malformed=%d dry_run=%s",
        stats["lines_read"],
        stats["events_attempted"],
        stats["events_replayed"],
        stats["events_failed"],
        stats["events_malformed"],
        args.dry_run,
    )


if __name__ == "__main__":
    main()
