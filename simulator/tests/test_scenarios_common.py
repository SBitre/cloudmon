"""Tests for shared scenario execution utilities."""

from __future__ import annotations

import json
import pytest

from simulator.scenarios import common as _common


class _FakeFactory:
    """Minimal factory placeholder used by scenario runner."""

    def __init__(self, random_seed: int | None = None) -> None:
        self.seed = random_seed


class _FakeClient:
    """Fake ingest client that returns queued outcomes."""

    def __init__(
        self,
        ingest_url: str,
        timeout_seconds: float,
        retry_config: object,
        circuit_breaker_config: object,
    ) -> None:
        self.ingest_url = ingest_url
        self.timeout_seconds = timeout_seconds
        self.retry_config = retry_config
        self.circuit_breaker_config = circuit_breaker_config
        self.calls: list[dict[str, object]] = []
        self.outcomes: list[bool] = [True, False, True]

    def send_event(self, event: dict[str, object]) -> bool:
        self.calls.append(event)
        return self.outcomes[len(self.calls) - 1]

    @property
    def last_failure_reason(self) -> str | None:
        return "send_failed"


def test_scenario_runner_validates_positive_config(monkeypatch) -> None:
    """Constructor should reject non-positive totals and durations."""
    monkeypatch.setattr(_common, "_require_ingest_url", lambda: "https://example.com/events")
    monkeypatch.setattr(_common, "EventFactory", _FakeFactory)
    monkeypatch.setattr(_common, "IngestClient", _FakeClient)

    with pytest.raises(ValueError, match="total_events"):
        _common.ScenarioRunner(
            _common.ScenarioConfig("bad", total_events=0, duration_seconds=10.0, request_timeout_seconds=1.0),
            lambda _index, _factory: {},
        )

    with pytest.raises(ValueError, match="duration_seconds"):
        _common.ScenarioRunner(
            _common.ScenarioConfig("bad", total_events=1, duration_seconds=0.0, request_timeout_seconds=1.0),
            lambda _index, _factory: {},
        )

    with pytest.raises(ValueError, match="request_timeout_seconds"):
        _common.ScenarioRunner(
            _common.ScenarioConfig("bad", total_events=1, duration_seconds=5.0, request_timeout_seconds=0.0),
            lambda _index, _factory: {},
        )


def test_scenario_runner_run_sends_all_events(monkeypatch) -> None:
    """Runner should invoke builder for each index and honor sleep cadence."""
    monkeypatch.setattr(_common, "_require_ingest_url", lambda: "https://example.com/events")
    monkeypatch.setattr(_common, "EventFactory", _FakeFactory)
    monkeypatch.setattr(_common, "IngestClient", _FakeClient)

    builder_calls: list[int] = []
    sleep_calls: list[float] = []

    def builder(index: int, factory: _FakeFactory) -> dict[str, object]:
        builder_calls.append(index)
        return {"event_id": f"evt-{index}", "seed": factory.seed}

    monkeypatch.setattr(_common.time, "sleep", lambda seconds: sleep_calls.append(seconds))

    runner = _common.ScenarioRunner(
        _common.ScenarioConfig(
            name="test",
            total_events=3,
            duration_seconds=3.0,
            request_timeout_seconds=2.0,
            random_seed=17,
        ),
        builder,
    )
    runner.run()

    assert builder_calls == [0, 1, 2]
    assert sleep_calls == [1.0, 1.0, 1.0]
    assert runner._client.ingest_url == "https://example.com/events"
    assert runner._client.timeout_seconds == 2.0
    assert runner._client.retry_config.max_retries == 2
    assert runner._client.circuit_breaker_config.failure_threshold == 5


def test_scenario_runner_writes_dead_letter_when_enabled(monkeypatch, tmp_path) -> None:
    """Scenario failures should be persisted when dead-letter path is configured."""
    monkeypatch.setattr(_common, "_require_ingest_url", lambda: "https://example.com/events")
    monkeypatch.setattr(_common, "EventFactory", _FakeFactory)
    monkeypatch.setattr(_common, "IngestClient", _FakeClient)
    monkeypatch.setattr(_common.time, "sleep", lambda _seconds: None)

    dead_letter_path = tmp_path / "scenario-dlq.jsonl"
    runner = _common.ScenarioRunner(
        _common.ScenarioConfig(
            name="test",
            total_events=3,
            duration_seconds=3.0,
            request_timeout_seconds=2.0,
            dead_letter_path=str(dead_letter_path),
        ),
        lambda index, _factory: {"event_id": f"evt-{index}"},
    )
    runner.run()

    lines = dead_letter_path.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 1
    payload = json.loads(lines[0])
    assert payload["reason"] == "send_failed"
    assert payload["event"]["event_id"] == "evt-1"


def test_require_ingest_url_success_and_failure(monkeypatch) -> None:
    """Environment helper should validate required endpoint."""
    monkeypatch.setenv("INGEST_URL", "https://example.com/events")
    assert _common._require_ingest_url() == "https://example.com/events"

    monkeypatch.delenv("INGEST_URL", raising=False)
    with pytest.raises(RuntimeError, match="INGEST_URL"):
        _common._require_ingest_url()


def test_configure_logging_calls_basic_config(monkeypatch) -> None:
    """Logging helper should delegate to root logging utility."""
    called: list[str] = []
    monkeypatch.setattr(_common, "configure_root_logging", lambda log_format: called.append(log_format))

    _common.configure_logging()
    _common.configure_logging("json")

    assert called == ["plain", "json"]
