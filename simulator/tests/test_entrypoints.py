"""Entry-point execution tests for `python -m ...` paths."""

from __future__ import annotations

import runpy

from simulator.scenarios import common as _common


class _FastFakeClient:
    """Avoid real network traffic when testing scenario entrypoints."""

    def __init__(
        self,
        ingest_url: str,
        timeout_seconds: float,
        retry_config: object | None = None,
        circuit_breaker_config: object | None = None,
    ) -> None:
        self.ingest_url = ingest_url
        self.timeout_seconds = timeout_seconds
        self.retry_config = retry_config
        self.circuit_breaker_config = circuit_breaker_config

    def send_event(self, event: dict[str, object]) -> bool:
        return bool(event)


class _FastFakeFactory:
    """Factory used by scenario entrypoint smoke tests."""

    def __init__(self, random_seed: int | None = None) -> None:
        self.random_seed = random_seed

    def create_event(self, event_type: str, **kwargs: object) -> dict[str, object]:
        return {"event_type": event_type, **kwargs}


def test_simulator_module_entrypoint_executes(monkeypatch) -> None:
    """`python -m simulator.simulator` should hit module guard safely."""
    monkeypatch.setenv("INGEST_URL", "https://example.com/events")
    monkeypatch.setattr("sys.argv", ["simulator", "--duration", "0", "--rate", "1"])
    runpy.run_module("simulator.simulator", run_name="__main__")


def test_background_cli_module_entrypoint_executes(monkeypatch) -> None:
    """`python -m simulator.cli.background` should hit module guard safely."""
    monkeypatch.setenv("INGEST_URL", "https://example.com/events")
    monkeypatch.setattr("sys.argv", ["background", "--duration", "0", "--rate", "1"])
    runpy.run_module("simulator.cli.background", run_name="__main__")


def test_replay_cli_module_entrypoint_executes(monkeypatch, tmp_path) -> None:
    """`python -m simulator.cli.replay` should hit module guard safely."""
    dead_letter_path = tmp_path / "dlq.jsonl"
    dead_letter_path.write_text('{"event":{"event_id":"a"}}\n', encoding="utf-8")
    monkeypatch.setattr(
        "sys.argv",
        ["replay", "--dead-letter-path", str(dead_letter_path), "--dry-run", "--rate", "1"],
    )
    runpy.run_module("simulator.cli.replay", run_name="__main__")


def test_credential_stuffing_module_entrypoint_executes(monkeypatch) -> None:
    """Credential stuffing module should execute with one fast event."""
    monkeypatch.setenv("INGEST_URL", "https://example.com/events")
    monkeypatch.setattr(_common, "IngestClient", _FastFakeClient)
    monkeypatch.setattr(_common, "EventFactory", _FastFakeFactory)
    monkeypatch.setattr(_common.time, "sleep", lambda _seconds: None)
    monkeypatch.setattr(
        "sys.argv",
        ["credential_stuffing", "--count", "1", "--duration", "0.1", "--ip-prefix", "198.51.100"],
    )
    runpy.run_module("simulator.scenarios.credential_stuffing", run_name="__main__")


def test_error_spike_module_entrypoint_executes(monkeypatch) -> None:
    """Error spike module should execute with one fast event."""
    monkeypatch.setenv("INGEST_URL", "https://example.com/events")
    monkeypatch.setattr(_common, "IngestClient", _FastFakeClient)
    monkeypatch.setattr(_common, "EventFactory", _FastFakeFactory)
    monkeypatch.setattr(_common.time, "sleep", lambda _seconds: None)
    monkeypatch.setattr("sys.argv", ["error_spike", "--count", "1", "--duration", "0.1", "--service", "checkout-service"])
    runpy.run_module("simulator.scenarios.error_spike", run_name="__main__")


def test_payment_failure_module_entrypoint_executes(monkeypatch) -> None:
    """Payment failure module should execute with one fast event."""
    monkeypatch.setenv("INGEST_URL", "https://example.com/events")
    monkeypatch.setattr(_common, "IngestClient", _FastFakeClient)
    monkeypatch.setattr(_common, "EventFactory", _FastFakeFactory)
    monkeypatch.setattr(_common.time, "sleep", lambda _seconds: None)
    monkeypatch.setattr(
        "sys.argv",
        ["payment_failure_burst", "--count", "1", "--duration", "0.1", "--service", "payment-service"],
    )
    runpy.run_module("simulator.scenarios.payment_failure_burst", run_name="__main__")
