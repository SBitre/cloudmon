"""Background traffic simulator CLI implementation."""

from __future__ import annotations

import argparse
import os
import signal
import threading
import time
from typing import Callable

from simulator.core.event_factory import EventFactory
from simulator.core.profile_config import apply_profile_overrides, load_profile
from simulator.infra.dead_letter import DeadLetterWriter
from simulator.infra.ingest_client import CircuitBreakerConfig, IngestClient, RetryConfig
from simulator.infra.logging import configure_logging
import logging


class BackgroundSimulator:
    """Generate and post continuous background traffic at a configurable rate."""

    def __init__(
        self,
        event_factory: EventFactory,
        ingest_client: IngestClient,
        *,
        events_per_second: float = 5.0,
        stats_interval_seconds: float = 30.0,
        dead_letter_writer: DeadLetterWriter | None = None,
    ) -> None:
        """
        Initialize a long-running simulator service.

        Args:
            event_factory: Strategy object that creates schema-compliant payloads.
            ingest_client: Abstraction responsible for HTTP delivery.
            events_per_second: Target send rate for background traffic.
            stats_interval_seconds: How often to log periodic runtime counters.
            dead_letter_writer: Optional dead-letter persistence for failed sends.
        """
        if events_per_second <= 0:
            raise ValueError("events_per_second must be positive")
        if stats_interval_seconds <= 0:
            raise ValueError("stats_interval_seconds must be positive")

        self._event_factory = event_factory
        self._ingest_client = ingest_client
        self._events_per_second = events_per_second
        self._stats_interval_seconds = stats_interval_seconds
        self._dead_letter_writer = dead_letter_writer
        self._stop_event = threading.Event()
        self._logger = logging.getLogger(self.__class__.__name__)

    def run(self, *, duration_seconds: float | None = None) -> None:
        """
        Run the simulator loop until stopped or duration elapses.

        Args:
            duration_seconds: Optional max runtime; when omitted, run forever.
        """
        sleep_interval = 1.0 / self._events_per_second
        started_at = time.monotonic()
        next_stats_log_at = started_at + self._stats_interval_seconds
        sent_count = 0
        success_count = 0

        self._logger.info(
            "Starting simulator events_per_second=%.2f duration_seconds=%s",
            self._events_per_second,
            duration_seconds,
        )

        while not self._stop_event.is_set():
            if duration_seconds is not None and (time.monotonic() - started_at) >= duration_seconds:
                break

            event = self._event_factory.create_random_event()
            sent_count += 1
            send_ok = self._ingest_client.send_event(event)
            if send_ok:
                success_count += 1
            elif self._dead_letter_writer is not None:
                self._dead_letter_writer.write(
                    event,
                    reason=self._ingest_client.last_failure_reason or "send_failed",
                )

            now = time.monotonic()
            if now >= next_stats_log_at:
                self._logger.info(
                    "Simulator progress sent=%d successful=%d failed=%d",
                    sent_count,
                    success_count,
                    sent_count - success_count,
                )
                next_stats_log_at = now + self._stats_interval_seconds

            time.sleep(sleep_interval)

        self._logger.info(
            "Simulator stopped sent=%d successful=%d failed=%d",
            sent_count,
            success_count,
            sent_count - success_count,
        )

    def stop(self) -> None:
        """Signal the simulator to stop gracefully."""
        self._stop_event.set()


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments for simulator runtime configuration."""
    parser = argparse.ArgumentParser(description="Run CloudMon background traffic simulator.")
    parser.add_argument(
        "--profile",
        type=str,
        default=None,
        help="Optional JSON/YAML profile file with CLI-equivalent settings.",
    )
    parser.add_argument(
        "--rate",
        type=float,
        default=5.0,
        help="Events per second to send (default: 5.0).",
    )
    parser.add_argument(
        "--duration",
        type=float,
        default=None,
        help="Optional runtime duration in seconds; omitted means run continuously.",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Optional random seed for reproducible event streams.",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=5.0,
        help="Per-request timeout in seconds (default: 5.0).",
    )
    parser.add_argument(
        "--max-retries",
        type=int,
        default=2,
        help="Retry attempts for transient ingest failures (default: 2).",
    )
    parser.add_argument(
        "--initial-backoff",
        type=float,
        default=0.2,
        help="Initial retry backoff in seconds (default: 0.2).",
    )
    parser.add_argument(
        "--max-backoff",
        type=float,
        default=2.0,
        help="Maximum retry backoff in seconds (default: 2.0).",
    )
    parser.add_argument(
        "--stats-interval",
        type=float,
        default=30.0,
        help="Periodic progress log interval in seconds (default: 30.0).",
    )
    parser.add_argument(
        "--circuit-failure-threshold",
        type=int,
        default=5,
        help="Consecutive failure count to open circuit breaker (default: 5).",
    )
    parser.add_argument(
        "--circuit-recovery-timeout",
        type=float,
        default=30.0,
        help="Circuit-breaker cooldown in seconds before retrying (default: 30).",
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
    args = parser.parse_args()

    if args.profile:
        profile = load_profile(args.profile)
        args = apply_profile_overrides(
            args,
            profile,
            keys=(
                "rate",
                "duration",
                "seed",
                "timeout",
                "max_retries",
                "initial_backoff",
                "max_backoff",
                "stats_interval",
                "circuit_failure_threshold",
                "circuit_recovery_timeout",
                "dead_letter_path",
                "log_format",
            ),
        )
    return args


def _require_ingest_url() -> str:
    """Read and validate ingest endpoint from `INGEST_URL` environment variable."""
    ingest_url = os.environ.get("INGEST_URL", "").strip()
    if not ingest_url:
        raise RuntimeError("INGEST_URL environment variable is required")
    return ingest_url


def _install_signal_handlers(stop_callback: Callable[[], None]) -> None:
    """Register SIGINT/SIGTERM handlers so simulator exits cleanly."""

    def _handle_signal(_signum: int, _frame: object) -> None:
        logging.getLogger(__name__).info("Shutdown signal received; stopping simulator")
        stop_callback()

    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)


def main() -> None:
    """CLI entrypoint for background event simulation."""
    args = parse_args()
    configure_logging(args.log_format)
    ingest_url = _require_ingest_url()
    dead_letter_writer = DeadLetterWriter(args.dead_letter_path) if args.dead_letter_path else None

    simulator = BackgroundSimulator(
        event_factory=EventFactory(random_seed=args.seed),
        ingest_client=IngestClient(
            ingest_url=ingest_url,
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
        ),
        events_per_second=args.rate,
        stats_interval_seconds=args.stats_interval,
        dead_letter_writer=dead_letter_writer,
    )
    _install_signal_handlers(simulator.stop)
    simulator.run(duration_seconds=args.duration)


if __name__ == "__main__":
    main()
