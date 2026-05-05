"""Trigger a concentrated API error spike from one service."""

from __future__ import annotations

import argparse

from simulator.core.event_factory import EventFactory
from simulator.core.profile_config import apply_profile_overrides, load_profile
from simulator.scenarios.common import ScenarioConfig, ScenarioRunner, configure_logging


def parse_args() -> argparse.Namespace:
    """Parse CLI parameters for API error spike scenario."""
    parser = argparse.ArgumentParser(description="Run API error spike scenario.")
    parser.add_argument("--profile", type=str, default=None, help="Optional JSON/YAML profile file.")
    parser.add_argument("--count", type=int, default=120, help="Total api_error events to send (default: 120).")
    parser.add_argument("--duration", type=float, default=20.0, help="Scenario duration in seconds (default: 20).")
    parser.add_argument(
        "--service",
        type=str,
        default="checkout-service",
        help="Service that emits all errors (default: checkout-service).",
    )
    parser.add_argument("--timeout", type=float, default=5.0, help="HTTP timeout in seconds.")
    parser.add_argument("--max-retries", type=int, default=2, help="Retry attempts for transient ingest failures.")
    parser.add_argument(
        "--initial-backoff",
        type=float,
        default=0.2,
        help="Initial retry backoff in seconds.",
    )
    parser.add_argument(
        "--max-backoff",
        type=float,
        default=2.0,
        help="Maximum retry backoff in seconds.",
    )
    parser.add_argument(
        "--circuit-failure-threshold",
        type=int,
        default=5,
        help="Consecutive failure count to open circuit breaker.",
    )
    parser.add_argument(
        "--circuit-recovery-timeout",
        type=float,
        default=30.0,
        help="Circuit-breaker cooldown in seconds.",
    )
    parser.add_argument(
        "--dead-letter-path",
        type=str,
        default=None,
        help="Optional JSONL file path to store failed events.",
    )
    parser.add_argument(
        "--log-format",
        type=str,
        choices=("plain", "json"),
        default="plain",
        help="Log output format: plain or json.",
    )
    parser.add_argument("--seed", type=int, default=None, help="Optional random seed for deterministic payloads.")
    args = parser.parse_args()
    if args.profile:
        profile = load_profile(args.profile)
        args = apply_profile_overrides(
            args,
            profile,
            keys=(
                "count",
                "duration",
                "service",
                "timeout",
                "max_retries",
                "initial_backoff",
                "max_backoff",
                "circuit_failure_threshold",
                "circuit_recovery_timeout",
                "dead_letter_path",
                "log_format",
                "seed",
            ),
        )
    return args


def build_api_error_event(index: int, factory: EventFactory, service: str) -> dict[str, object]:
    """
    Build one API error event for a single target service.

    Args:
        index: 0-based event index used to vary endpoint and metadata.
        factory: Shared event factory.
        service: Service name emitting all scenario events.
    """
    endpoints = ("/api/checkout", "/api/orders", "/api/cart")
    endpoint = endpoints[index % len(endpoints)]
    status_code = 500 if index % 4 else 503
    return factory.create_event(
        event_type="api_error",
        service=service,
        severity="error",
        endpoint=endpoint,
        status_code=status_code,
        error_message="Synthetic error spike for incident response drill",
    )


def main() -> None:
    """Run the API error spike scenario end-to-end."""
    args = parse_args()
    configure_logging(args.log_format)
    runner = ScenarioRunner(
        config=ScenarioConfig(
            name="error_spike",
            total_events=args.count,
            duration_seconds=args.duration,
            request_timeout_seconds=args.timeout,
            max_retries=args.max_retries,
            initial_backoff_seconds=args.initial_backoff,
            max_backoff_seconds=args.max_backoff,
            circuit_failure_threshold=args.circuit_failure_threshold,
            circuit_recovery_timeout_seconds=args.circuit_recovery_timeout,
            dead_letter_path=args.dead_letter_path,
            random_seed=args.seed,
        ),
        event_builder=lambda index, factory: build_api_error_event(index, factory, args.service),
    )
    runner.run()


if __name__ == "__main__":
    main()
