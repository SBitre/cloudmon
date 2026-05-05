"""Tests for ingest HTTP client behavior."""

from __future__ import annotations

import requests
import pytest

from simulator.infra.ingest_client import CircuitBreakerConfig, IngestClient, RetryConfig


class _FakeResponse:
    """Simple response stub for status/text checks."""

    def __init__(self, status_code: int, text: str = "") -> None:
        self.status_code = status_code
        self.text = text


class _FakeSession:
    """Session stub that can return response or raise exceptions."""

    def __init__(self, behaviors: list[object]) -> None:
        self.behaviors = list(behaviors)
        self.calls: list[tuple[str, dict[str, object], float]] = []

    def post(self, url: str, json: dict[str, object], timeout: float) -> _FakeResponse:
        self.calls.append((url, json, timeout))
        behavior = self.behaviors.pop(0)
        if isinstance(behavior, Exception):
            raise behavior
        return behavior


def test_send_event_returns_true_for_2xx(monkeypatch) -> None:
    """Client should treat 2xx as successful delivery."""
    session = _FakeSession([_FakeResponse(201, "created")])
    monkeypatch.setattr(requests, "Session", lambda: session)

    client = IngestClient("https://example.com/events", timeout_seconds=2.5)
    ok = client.send_event({"event_id": "abc"})

    assert ok is True
    assert session.calls == [("https://example.com/events", {"event_id": "abc"}, 2.5)]


def test_send_event_returns_false_for_non_retryable_status(monkeypatch) -> None:
    """Client should fail immediately on non-retryable status codes."""
    session = _FakeSession([_FakeResponse(400, "bad request")])
    monkeypatch.setattr(requests, "Session", lambda: session)
    monkeypatch.setattr("simulator.infra.ingest_client.time.sleep", lambda _seconds: None)

    client = IngestClient("https://example.com/events")
    ok = client.send_event({"event_id": "abc"})

    assert ok is False
    assert len(session.calls) == 1


def test_send_event_retries_retryable_status_then_succeeds(monkeypatch) -> None:
    """Retryable HTTP statuses should trigger backoff retries."""
    session = _FakeSession([_FakeResponse(503, "unavailable"), _FakeResponse(200, "ok")])
    monkeypatch.setattr(requests, "Session", lambda: session)
    sleep_calls: list[float] = []
    monkeypatch.setattr("simulator.infra.ingest_client.time.sleep", lambda seconds: sleep_calls.append(seconds))

    client = IngestClient(
        "https://example.com/events",
        retry_config=RetryConfig(max_retries=2, initial_backoff_seconds=0.5, max_backoff_seconds=1.0),
    )
    ok = client.send_event({"event_id": "abc"})

    assert ok is True
    assert len(session.calls) == 2
    assert sleep_calls == [0.5]


def test_send_event_returns_false_after_retry_exhaustion(monkeypatch) -> None:
    """Client should return False when transient failures never recover."""
    session = _FakeSession([_FakeResponse(503, "down"), _FakeResponse(503, "still down"), _FakeResponse(503, "down")])
    monkeypatch.setattr(requests, "Session", lambda: session)
    sleep_calls: list[float] = []
    monkeypatch.setattr("simulator.infra.ingest_client.time.sleep", lambda seconds: sleep_calls.append(seconds))

    client = IngestClient(
        "https://example.com/events",
        retry_config=RetryConfig(max_retries=2, initial_backoff_seconds=0.1, max_backoff_seconds=0.2),
    )
    ok = client.send_event({"event_id": "abc"})

    assert ok is False
    assert len(session.calls) == 3
    assert sleep_calls == [0.1, 0.2]


def test_send_event_retries_transport_errors_then_succeeds(monkeypatch) -> None:
    """Transport exceptions should be retried until success or exhaustion."""
    session = _FakeSession([requests.RequestException("boom"), _FakeResponse(202, "accepted")])
    monkeypatch.setattr(requests, "Session", lambda: session)
    monkeypatch.setattr("simulator.infra.ingest_client.time.sleep", lambda _seconds: None)

    client = IngestClient("https://example.com/events", retry_config=RetryConfig(max_retries=1))
    ok = client.send_event({"event_id": "abc"})

    assert ok is True
    assert len(session.calls) == 2


def test_send_event_returns_false_after_transport_retry_exhaustion(monkeypatch) -> None:
    """Client should fail once exception retries are exhausted."""
    session = _FakeSession([requests.RequestException("boom"), requests.RequestException("still boom")])
    monkeypatch.setattr(requests, "Session", lambda: session)
    monkeypatch.setattr("simulator.infra.ingest_client.time.sleep", lambda _seconds: None)

    client = IngestClient("https://example.com/events", retry_config=RetryConfig(max_retries=1))
    ok = client.send_event({"event_id": "abc"})

    assert ok is False
    assert len(session.calls) == 2


def test_retry_config_validation_and_timeout_validation() -> None:
    """Invalid retry/timeout settings should raise clear errors."""
    with pytest.raises(ValueError):
        RetryConfig(max_retries=-1).validate()
    with pytest.raises(ValueError):
        RetryConfig(initial_backoff_seconds=0).validate()
    with pytest.raises(ValueError):
        RetryConfig(max_backoff_seconds=0).validate()
    with pytest.raises(ValueError):
        RetryConfig(initial_backoff_seconds=1.0, max_backoff_seconds=0.5).validate()
    with pytest.raises(ValueError):
        IngestClient("https://example.com/events", timeout_seconds=0)


def test_circuit_breaker_config_validation() -> None:
    """Invalid circuit-breaker settings should fail fast."""
    with pytest.raises(ValueError):
        CircuitBreakerConfig(failure_threshold=0).validate()
    with pytest.raises(ValueError):
        CircuitBreakerConfig(recovery_timeout_seconds=0).validate()


def test_circuit_breaker_opens_and_recovers(monkeypatch) -> None:
    """Circuit should open after threshold and recover after cooldown."""
    session = _FakeSession(
        [
            _FakeResponse(503, "down"),
            _FakeResponse(503, "still down"),
            _FakeResponse(200, "ok after cooldown"),
        ]
    )
    monkeypatch.setattr(requests, "Session", lambda: session)
    monkeypatch.setattr("simulator.infra.ingest_client.time.sleep", lambda _seconds: None)
    monotonic_values = iter([0.0, 0.1, 0.2, 0.3, 2.0])
    monkeypatch.setattr("simulator.infra.ingest_client.time.monotonic", lambda: next(monotonic_values))

    client = IngestClient(
        "https://example.com/events",
        retry_config=RetryConfig(max_retries=0),
        circuit_breaker_config=CircuitBreakerConfig(failure_threshold=2, recovery_timeout_seconds=1.0),
    )

    assert client.send_event({"event_id": "a"}) is False
    assert client.last_failure_reason == "http_503"
    assert client.send_event({"event_id": "b"}) is False
    assert client.send_event({"event_id": "c"}) is False
    assert client.last_failure_reason == "circuit_open"
    assert client.send_event({"event_id": "d"}) is True
    assert client.last_failure_reason is None


def test_circuit_breaker_uses_request_exception_reason(monkeypatch) -> None:
    """Transport errors should populate request_exception failure reason."""
    session = _FakeSession([requests.RequestException("boom")])
    monkeypatch.setattr(requests, "Session", lambda: session)
    monkeypatch.setattr("simulator.infra.ingest_client.time.sleep", lambda _seconds: None)

    client = IngestClient("https://example.com/events", retry_config=RetryConfig(max_retries=0))
    assert client.send_event({"event_id": "x"}) is False
    assert client.last_failure_reason == "request_exception"


def test_calculate_backoff_caps_at_max() -> None:
    """Backoff helper should increase exponentially and cap at max."""
    client = IngestClient(
        "https://example.com/events",
        retry_config=RetryConfig(max_retries=5, initial_backoff_seconds=0.5, max_backoff_seconds=1.5),
    )
    assert client._calculate_backoff(0) == 0.5
    assert client._calculate_backoff(1) == 1.0
    assert client._calculate_backoff(2) == 1.5
