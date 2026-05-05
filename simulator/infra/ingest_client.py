"""HTTP client abstraction for posting simulator events to ingest API."""

from __future__ import annotations

from dataclasses import dataclass
import logging
import time
from typing import Any

import requests

EventPayload = dict[str, Any]


@dataclass(frozen=True)
class RetryConfig:
    """Retry/backoff settings for resilient event delivery."""

    max_retries: int = 2
    initial_backoff_seconds: float = 0.2
    max_backoff_seconds: float = 2.0

    def validate(self) -> None:
        """Validate retry configuration values."""
        if self.max_retries < 0:
            raise ValueError("max_retries must be >= 0")
        if self.initial_backoff_seconds <= 0:
            raise ValueError("initial_backoff_seconds must be > 0")
        if self.max_backoff_seconds <= 0:
            raise ValueError("max_backoff_seconds must be > 0")
        if self.max_backoff_seconds < self.initial_backoff_seconds:
            raise ValueError("max_backoff_seconds must be >= initial_backoff_seconds")


@dataclass(frozen=True)
class CircuitBreakerConfig:
    """Threshold and recovery settings for circuit breaker protection."""

    failure_threshold: int = 5
    recovery_timeout_seconds: float = 30.0

    def validate(self) -> None:
        """Validate circuit-breaker configuration values."""
        if self.failure_threshold <= 0:
            raise ValueError("failure_threshold must be > 0")
        if self.recovery_timeout_seconds <= 0:
            raise ValueError("recovery_timeout_seconds must be > 0")


class IngestClient:
    """Send events to the configured CloudMon ingest endpoint."""

    RETRYABLE_STATUS_CODES = frozenset({429, 500, 502, 503, 504})

    def __init__(
        self,
        ingest_url: str,
        *,
        timeout_seconds: float = 5.0,
        retry_config: RetryConfig | None = None,
        circuit_breaker_config: CircuitBreakerConfig | None = None,
    ) -> None:
        """
        Initialize an ingest HTTP client.

        Args:
            ingest_url: HTTP endpoint for event ingestion.
            timeout_seconds: Per-request timeout to avoid hanging sends.
            retry_config: Retry and backoff behavior for transient failures.
            circuit_breaker_config: Threshold/cooldown to prevent hammering down endpoints.
        """
        if timeout_seconds <= 0:
            raise ValueError("timeout_seconds must be > 0")

        effective_retry_config = retry_config or RetryConfig()
        effective_retry_config.validate()
        effective_circuit_breaker = circuit_breaker_config or CircuitBreakerConfig()
        effective_circuit_breaker.validate()

        self._ingest_url = ingest_url
        self._timeout_seconds = timeout_seconds
        self._retry_config = effective_retry_config
        self._circuit_breaker_config = effective_circuit_breaker
        self._session = requests.Session()
        self._logger = logging.getLogger(self.__class__.__name__)
        self._consecutive_failures = 0
        self._circuit_opened_at_monotonic: float | None = None
        self._last_failure_reason: str | None = None

    @property
    def last_failure_reason(self) -> str | None:
        """Return the most recent send failure reason."""
        return self._last_failure_reason

    def send_event(self, event: EventPayload) -> bool:
        """
        Send one event to ingest API.

        Args:
            event: Event payload in snake_case schema format.

        Returns:
            True when request returns 2xx, otherwise False.
        """
        event_id = event.get("event_id")
        now = time.monotonic()
        if self._is_circuit_open(now):
            self._last_failure_reason = "circuit_open"
            self._logger.warning(
                "Circuit open, skipping request event_id=%s consecutive_failures=%d",
                event_id,
                self._consecutive_failures,
            )
            return False

        for attempt in range(self._retry_config.max_retries + 1):  # pragma: no branch
            try:
                response = self._session.post(self._ingest_url, json=event, timeout=self._timeout_seconds)
                if 200 <= response.status_code < 300:
                    self._record_success()
                    return True

                is_retryable = response.status_code in self.RETRYABLE_STATUS_CODES
                self._logger.warning(
                    "Ingest rejected event_id=%s status=%s retryable=%s attempt=%d body=%s",
                    event_id,
                    response.status_code,
                    is_retryable,
                    attempt + 1,
                    response.text,
                )
                if not is_retryable or attempt >= self._retry_config.max_retries:
                    self._record_failure(reason=f"http_{response.status_code}")
                    return False

            except requests.RequestException as exc:
                self._logger.warning(
                    "Ingest request failed event_id=%s attempt=%d/%d error=%s",
                    event_id,
                    attempt + 1,
                    self._retry_config.max_retries + 1,
                    exc,
                )
                if attempt >= self._retry_config.max_retries:
                    self._record_failure(reason="request_exception")
                    return False

            time.sleep(self._calculate_backoff(attempt))

    def _calculate_backoff(self, attempt: int) -> float:
        """Compute exponential backoff interval for retry attempt index."""
        interval = self._retry_config.initial_backoff_seconds * (2**attempt)
        return min(interval, self._retry_config.max_backoff_seconds)

    def _is_circuit_open(self, now_monotonic: float) -> bool:
        """Check whether circuit breaker is currently open."""
        if self._circuit_opened_at_monotonic is None:
            return False

        elapsed = now_monotonic - self._circuit_opened_at_monotonic
        if elapsed >= self._circuit_breaker_config.recovery_timeout_seconds:
            self._logger.info("Circuit breaker cooldown elapsed, moving to half-open")
            self._circuit_opened_at_monotonic = None
            return False
        return True

    def _record_success(self) -> None:
        """Reset failure counters after a successful send."""
        self._consecutive_failures = 0
        self._circuit_opened_at_monotonic = None
        self._last_failure_reason = None

    def _record_failure(self, *, reason: str) -> None:
        """Track failed send and open circuit when threshold is reached."""
        self._last_failure_reason = reason
        self._consecutive_failures += 1
        if self._consecutive_failures >= self._circuit_breaker_config.failure_threshold:
            self._circuit_opened_at_monotonic = time.monotonic()
            self._logger.warning(
                "Circuit opened after failures=%d reason=%s",
                self._consecutive_failures,
                reason,
            )
