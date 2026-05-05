"""Trigger a credential stuffing burst for detection testing."""

from __future__ import annotations

import argparse

from simulator.core.event_factory import EventFactory
from simulator.core.profile_config import apply_profile_overrides, load_profile
from simulator.scenarios.common import ScenarioConfig, ScenarioRunner, configure_logging


def parse_args() -> argparse.Namespace:
    """Parse CLI parameters for credential stuffing scenario."""
    parser = argparse.ArgumentParser(description="Run credential stuffing scenario.")
    parser.add_argument("--profile", type=str, default=None, help="Optional JSON/YAML profile file.")
    parser.add_argument("--count", type=int, default=200, help="Total failed_login events (default: 200).")
    parser.add_argument("--duration", type=float, default=30.0, help="Scenario duration in seconds (default: 30).")
    parser.add_argument(
        "--ip-prefix",
        type=str,
        default="198.51.100",
        help="First three octets used for sequential source IPs.",
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
                "ip_prefix",
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


def build_failed_login_event(index: int, factory: EventFactory, ip_prefix: str) -> dict[str, object]:
    """
    Build one failed_login event targeting login-service from sequential IPs.

    Args:
        index: 0-based event index.
        factory: Shared event factory.
        ip_prefix: Prefix for generated sequential source addresses.
    """
    host = (index % 254) + 1
    ip_address = f"{ip_prefix}.{host}"
    return factory.create_event(
        event_type="failed_login",
        service="login-service",
        severity="warning",
        ip_address=ip_address,
    )


def main() -> None:
    """Run the credential stuffing scenario end-to-end."""
    args = parse_args()
    configure_logging(args.log_format)
    runner = ScenarioRunner(
        config=ScenarioConfig(
            name="credential_stuffing",
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
        event_builder=lambda index, factory: build_failed_login_event(index, factory, args.ip_prefix),
    )
    runner.run()


if __name__ == "__main__":
    main()
