"""Shared scenario execution primitives to keep scripts DRY."""

from __future__ import annotations

from dataclasses import dataclass
import logging
import os
import time
from typing import Callable

from simulator.core.event_factory import EventFactory
from simulator.infra.dead_letter import DeadLetterWriter
from simulator.infra.ingest_client import CircuitBreakerConfig, IngestClient, RetryConfig
from simulator.infra.logging import configure_logging as configure_root_logging


EventBuilder = Callable[[int, EventFactory], dict[str, object]]


@dataclass(frozen=True)
class ScenarioConfig:
    """Immutable runtime settings for one anomaly scenario execution."""

    name: str
    total_events: int
    duration_seconds: float
    request_timeout_seconds: float
    max_retries: int = 2
    initial_backoff_seconds: float = 0.2
    max_backoff_seconds: float = 2.0
    circuit_failure_threshold: int = 5
    circuit_recovery_timeout_seconds: float = 30.0
    dead_letter_path: str | None = None
    random_seed: int | None = None


class ScenarioRunner:
    """Run a scenario by posting generated events at a fixed throughput."""

    def __init__(self, config: ScenarioConfig, event_builder: EventBuilder) -> None:
        """
        Create a runner for a specific scenario.

        Args:
            config: Scenario runtime settings.
            event_builder: Function building each event by sequence index.
        """
        if config.total_events <= 0:
            raise ValueError("total_events must be positive")
        if config.duration_seconds <= 0:
            raise ValueError("duration_seconds must be positive")
        if config.request_timeout_seconds <= 0:
            raise ValueError("request_timeout_seconds must be positive")

        self._config = config
        self._event_builder = event_builder
        self._logger = logging.getLogger(f"{self.__class__.__name__}.{config.name}")
        self._dead_letter_writer = DeadLetterWriter(config.dead_letter_path) if config.dead_letter_path else None

        ingest_url = _require_ingest_url()
        self._factory = EventFactory(random_seed=config.random_seed)
        self._client = IngestClient(
            ingest_url=ingest_url,
            timeout_seconds=config.request_timeout_seconds,
            retry_config=RetryConfig(
                max_retries=config.max_retries,
                initial_backoff_seconds=config.initial_backoff_seconds,
                max_backoff_seconds=config.max_backoff_seconds,
            ),
            circuit_breaker_config=CircuitBreakerConfig(
                failure_threshold=config.circuit_failure_threshold,
                recovery_timeout_seconds=config.circuit_recovery_timeout_seconds,
            ),
        )

    def run(self) -> None:
        """Execute the configured scenario and log delivery summary."""
        interval_seconds = self._config.duration_seconds / self._config.total_events
        sent = 0
        successes = 0

        self._logger.info(
            "Starting scenario name=%s total_events=%d duration_seconds=%.2f interval_seconds=%.3f",
            self._config.name,
            self._config.total_events,
            self._config.duration_seconds,
            interval_seconds,
        )

        for index in range(self._config.total_events):
            event = self._event_builder(index, self._factory)
            sent += 1
            send_ok = self._client.send_event(event)
            if send_ok:
                successes += 1
            elif self._dead_letter_writer is not None:
                self._dead_letter_writer.write(
                    event,
                    reason=self._client.last_failure_reason or "send_failed",
                )

            # Sleep with millisecond precision while avoiding tiny negative values.
            time.sleep(max(0.0, interval_seconds))

        failures = sent - successes
        success_rate = (successes / sent) * 100.0
        self._logger.info(
            "Scenario complete name=%s sent=%d success=%d failed=%d success_rate=%.2f%%",
            self._config.name,
            sent,
            successes,
            failures,
            success_rate,
        )


def configure_logging(log_format: str = "plain") -> None:
    """Initialize consistent logging format for standalone scenario scripts."""
    configure_root_logging(log_format=log_format)


def _require_ingest_url() -> str:
    """Read and validate ingest endpoint from `INGEST_URL` environment variable."""
    ingest_url = os.environ.get("INGEST_URL", "").strip()
    if not ingest_url:
        raise RuntimeError("INGEST_URL environment variable is required")
    return ingest_url
