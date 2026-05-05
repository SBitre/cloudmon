"""Tests for background simulator orchestration."""

from __future__ import annotations

import argparse
import json
import signal

import pytest

from simulator.cli import background as simulator_module


class _FakeFactory:
    """Factory stub that counts produced events."""

    def __init__(self) -> None:
        self.calls = 0

    def create_random_event(self) -> dict[str, object]:
        self.calls += 1
        return {"event_id": f"id-{self.calls}"}


class _FakeClient:
    """Client stub with deterministic send outcomes."""

    def __init__(self, outcomes: list[bool]) -> None:
        self._outcomes = outcomes
        self.calls: list[dict[str, object]] = []

    def send_event(self, event: dict[str, object]) -> bool:
        self.calls.append(event)
        if not self._outcomes:
            return True
        return self._outcomes.pop(0)

    @property
    def last_failure_reason(self) -> str | None:
        return "send_failed"


def test_background_simulator_rejects_non_positive_rate() -> None:
    """Constructor validates positive rate and stats interval."""
    with pytest.raises(ValueError):
        simulator_module.BackgroundSimulator(_FakeFactory(), _FakeClient([]), events_per_second=0)
    with pytest.raises(ValueError):
        simulator_module.BackgroundSimulator(_FakeFactory(), _FakeClient([]), stats_interval_seconds=0)


def test_background_simulator_runs_until_duration(monkeypatch) -> None:
    """Duration should stop loop after threshold without explicit stop signal."""
    factory = _FakeFactory()
    client = _FakeClient([True, False, True, True])
    simulator = simulator_module.BackgroundSimulator(factory, client, events_per_second=2.0)

    monotonic_values = iter([0.0, 0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 1.2])
    sleep_calls: list[float] = []
    monkeypatch.setattr(simulator_module.time, "monotonic", lambda: next(monotonic_values))
    monkeypatch.setattr(simulator_module.time, "sleep", lambda seconds: sleep_calls.append(seconds))

    simulator.run(duration_seconds=1.0)

    assert factory.calls == 4
    assert len(client.calls) == 4
    assert sleep_calls == [0.5, 0.5, 0.5, 0.5]


def test_background_simulator_logs_periodic_stats(monkeypatch) -> None:
    """Long-running loops should emit periodic operational progress logs."""
    factory = _FakeFactory()
    client = _FakeClient([True, True, True])
    simulator = simulator_module.BackgroundSimulator(factory, client, events_per_second=2.0, stats_interval_seconds=0.3)

    monotonic_values = iter([0.0, 0.0, 0.35, 0.36, 0.7, 1.2])
    monkeypatch.setattr(simulator_module.time, "monotonic", lambda: next(monotonic_values))
    monkeypatch.setattr(simulator_module.time, "sleep", lambda _seconds: None)

    info_logs: list[str] = []
    monkeypatch.setattr(simulator._logger, "info", lambda message, *_args: info_logs.append(message))

    simulator.run(duration_seconds=1.0)

    assert any("Simulator progress" in message for message in info_logs)


def test_background_simulator_stops_via_stop_event(monkeypatch) -> None:
    """Loop should stop gracefully when stop is requested externally."""
    factory = _FakeFactory()
    client = _FakeClient([True, True, True])
    simulator = simulator_module.BackgroundSimulator(factory, client, events_per_second=4.0)

    sleep_counter = {"calls": 0}

    def fake_sleep(_: float) -> None:
        sleep_counter["calls"] += 1
        if sleep_counter["calls"] == 2:
            simulator.stop()

    monkeypatch.setattr(simulator_module.time, "sleep", fake_sleep)
    simulator.run(duration_seconds=None)

    assert sleep_counter["calls"] == 2
    assert factory.calls == 2
    assert len(client.calls) == 2


def test_background_simulator_writes_dead_letter_on_failure(monkeypatch) -> None:
    """Failed sends should be persisted when dead-letter writer is configured."""
    factory = _FakeFactory()
    client = _FakeClient([False])
    writes: list[dict[str, object]] = []

    class FakeDeadLetterWriter:
        def write(self, event: dict[str, object], *, reason: str) -> None:
            writes.append({"event": event, "reason": reason})

    simulator = simulator_module.BackgroundSimulator(
        factory,
        client,
        events_per_second=1.0,
        dead_letter_writer=FakeDeadLetterWriter(),
    )
    monotonic_values = iter([0.0, 0.0, 0.2, 1.1, 2.0])
    monkeypatch.setattr(simulator_module.time, "monotonic", lambda: next(monotonic_values))
    monkeypatch.setattr(simulator_module.time, "sleep", lambda _seconds: None)

    simulator.run(duration_seconds=1.0)

    assert len(writes) == 1
    assert writes[0]["reason"] == "send_failed"
    assert writes[0]["event"]["event_id"] == "id-1"


def test_parse_args_defaults(monkeypatch) -> None:
    """CLI parser should expose documented defaults."""
    monkeypatch.setattr("sys.argv", ["simulator"])
    args = simulator_module.parse_args()

    assert args.profile is None
    assert args.rate == 5.0
    assert args.duration is None
    assert args.seed is None
    assert args.timeout == 5.0
    assert args.max_retries == 2
    assert args.initial_backoff == 0.2
    assert args.max_backoff == 2.0
    assert args.stats_interval == 30.0
    assert args.circuit_failure_threshold == 5
    assert args.circuit_recovery_timeout == 30.0
    assert args.dead_letter_path is None
    assert args.log_format == "plain"


def test_parse_args_custom_values(monkeypatch) -> None:
    """CLI parser should parse custom runtime values."""
    monkeypatch.setattr(
        "sys.argv",
        [
            "simulator",
            "--rate",
            "9.5",
            "--duration",
            "22",
            "--seed",
            "13",
            "--timeout",
            "1.5",
            "--max-retries",
            "4",
            "--initial-backoff",
            "0.4",
            "--max-backoff",
            "3.5",
            "--stats-interval",
            "12",
            "--circuit-failure-threshold",
            "6",
            "--circuit-recovery-timeout",
            "20",
            "--dead-letter-path",
            "simulator/out/dead-letter.jsonl",
            "--log-format",
            "json",
        ],
    )
    args = simulator_module.parse_args()

    assert args.rate == 9.5
    assert args.duration == 22.0
    assert args.seed == 13
    assert args.timeout == 1.5
    assert args.max_retries == 4
    assert args.initial_backoff == 0.4
    assert args.max_backoff == 3.5
    assert args.stats_interval == 12.0
    assert args.circuit_failure_threshold == 6
    assert args.circuit_recovery_timeout == 20.0
    assert args.dead_letter_path == "simulator/out/dead-letter.jsonl"
    assert args.log_format == "json"


def test_parse_args_applies_profile_overrides(monkeypatch, tmp_path) -> None:
    """Profile settings should override parsed CLI defaults."""
    profile_path = tmp_path / "profile.json"
    profile_path.write_text(
        json.dumps(
            {
                "rate": 11.0,
                "max_retries": 4,
                "log_format": "json",
                "dead_letter_path": "simulator/out/dlq.jsonl",
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr("sys.argv", ["simulator", "--profile", str(profile_path)])
    args = simulator_module.parse_args()
    assert args.rate == 11.0
    assert args.max_retries == 4
    assert args.log_format == "json"
    assert args.dead_letter_path == "simulator/out/dlq.jsonl"


def test_require_ingest_url_success_and_failure(monkeypatch) -> None:
    """Environment helper should return URL or raise when missing."""
    monkeypatch.setenv("INGEST_URL", "https://example.com/events")
    assert simulator_module._require_ingest_url() == "https://example.com/events"

    monkeypatch.delenv("INGEST_URL", raising=False)
    with pytest.raises(RuntimeError, match="INGEST_URL"):
        simulator_module._require_ingest_url()


def test_install_signal_handlers_registers_both_signals(monkeypatch) -> None:
    """Signal installer should bind SIGINT and SIGTERM and invoke callback."""
    registered: dict[signal.Signals, object] = {}
    callbacks = {"count": 0}

    def fake_signal(sig: signal.Signals, handler: object) -> None:
        registered[sig] = handler

    monkeypatch.setattr(simulator_module.signal, "signal", fake_signal)

    simulator_module._install_signal_handlers(lambda: callbacks.__setitem__("count", callbacks["count"] + 1))

    assert signal.SIGINT in registered
    assert signal.SIGTERM in registered
    registered[signal.SIGINT](signal.SIGINT, None)
    assert callbacks["count"] == 1


def test_main_wires_dependencies_and_runs(monkeypatch) -> None:
    """Main should construct simulator with parsed args and run it."""
    parsed = argparse.Namespace(
        rate=3.0,
        duration=15.0,
        seed=11,
        timeout=1.25,
        max_retries=4,
        initial_backoff=0.4,
        max_backoff=2.5,
        stats_interval=9.0,
        circuit_failure_threshold=7,
        circuit_recovery_timeout=18.0,
        dead_letter_path="simulator/out/dead-letter.jsonl",
        log_format="json",
    )
    calls: dict[str, object] = {}

    class FakeBackgroundSimulator:
        def __init__(
            self,
            event_factory: object,
            ingest_client: object,
            events_per_second: float,
            stats_interval_seconds: float,
            dead_letter_writer: object | None = None,
        ) -> None:
            calls["event_factory"] = event_factory
            calls["ingest_client"] = ingest_client
            calls["events_per_second"] = events_per_second
            calls["stats_interval_seconds"] = stats_interval_seconds
            calls["dead_letter_writer"] = dead_letter_writer
            calls["stop_called"] = 0
            calls["run_duration"] = None

        def stop(self) -> None:
            calls["stop_called"] = calls["stop_called"] + 1

        def run(self, *, duration_seconds: float | None) -> None:
            calls["run_duration"] = duration_seconds

    class FakeEventFactory:
        def __init__(self, random_seed: int | None = None) -> None:
            self.seed = random_seed

    class FakeIngestClient:
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

    installed_stop_callbacks: list[object] = []
    configured_log_formats: list[str] = []
    dead_letter_paths: list[str] = []

    class FakeDeadLetterWriter:
        def __init__(self, file_path: str) -> None:
            dead_letter_paths.append(file_path)

    monkeypatch.setattr(simulator_module, "parse_args", lambda: parsed)
    monkeypatch.setattr(simulator_module, "_require_ingest_url", lambda: "https://example.com/events")
    monkeypatch.setattr(simulator_module, "BackgroundSimulator", FakeBackgroundSimulator)
    monkeypatch.setattr(simulator_module, "EventFactory", FakeEventFactory)
    monkeypatch.setattr(simulator_module, "IngestClient", FakeIngestClient)
    monkeypatch.setattr(simulator_module, "configure_logging", lambda fmt: configured_log_formats.append(fmt))
    monkeypatch.setattr(simulator_module, "DeadLetterWriter", FakeDeadLetterWriter)
    monkeypatch.setattr(simulator_module, "_install_signal_handlers", lambda callback: installed_stop_callbacks.append(callback))

    simulator_module.main()

    assert calls["events_per_second"] == 3.0
    assert calls["stats_interval_seconds"] == 9.0
    assert calls["run_duration"] == 15.0
    assert len(installed_stop_callbacks) == 1
    assert calls["event_factory"].seed == 11
    assert calls["ingest_client"].ingest_url == "https://example.com/events"
    assert calls["ingest_client"].timeout_seconds == 1.25
    assert calls["ingest_client"].retry_config.max_retries == 4
    assert calls["ingest_client"].retry_config.initial_backoff_seconds == 0.4
    assert calls["ingest_client"].retry_config.max_backoff_seconds == 2.5
    assert calls["ingest_client"].circuit_breaker_config.failure_threshold == 7
    assert calls["ingest_client"].circuit_breaker_config.recovery_timeout_seconds == 18.0
    assert calls["dead_letter_writer"] is not None
    assert configured_log_formats == ["json"]
    assert dead_letter_paths == ["simulator/out/dead-letter.jsonl"]
