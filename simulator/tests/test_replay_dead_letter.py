"""Tests for dead-letter replay command and helpers."""
# pyright: reportMissingImports=false

from __future__ import annotations

import argparse
import json
import runpy

import pytest

from simulator.cli import replay as replay_module


class _FakeIngestClient:
    """Simple fake ingest client with queued outcomes."""

    def __init__(self, outcomes: list[bool]) -> None:
        self._outcomes = outcomes
        self.calls: list[dict[str, object]] = []

    def send_event(self, event: dict[str, object]) -> bool:
        self.calls.append(event)
        return self._outcomes.pop(0)


def test_parse_args_defaults_and_custom(monkeypatch, tmp_path) -> None:
    """Parser should expose defaults and parse explicit overrides."""
    dead_letter_path = tmp_path / "dlq.jsonl"
    dead_letter_path.write_text("", encoding="utf-8")

    monkeypatch.setattr("sys.argv", ["replay", "--dead-letter-path", str(dead_letter_path)])
    args = replay_module.parse_args()
    assert args.rate == pytest.approx(5.0)
    assert args.limit is None
    assert args.dry_run is False
    assert args.log_format == "plain"

    monkeypatch.setattr(
        "sys.argv",
        [
            "replay",
            "--dead-letter-path",
            str(dead_letter_path),
            "--rate",
            "9",
            "--limit",
            "5",
            "--dry-run",
            "--log-format",
            "json",
        ],
    )
    args = replay_module.parse_args()
    assert args.rate == pytest.approx(9.0)
    assert args.limit == 5
    assert args.dry_run is True
    assert args.log_format == "json"


def test_parse_args_profile_override(monkeypatch, tmp_path) -> None:
    """Profile settings should override parser defaults."""
    dead_letter_path = tmp_path / "dlq.jsonl"
    dead_letter_path.write_text("", encoding="utf-8")
    profile_path = tmp_path / "profile.json"
    profile_path.write_text(
        json.dumps({"rate": 11, "limit": 2, "dry_run": True, "log_format": "json"}),
        encoding="utf-8",
    )

    monkeypatch.setattr(
        "sys.argv",
        [
            "replay",
            "--dead-letter-path",
            str(dead_letter_path),
            "--profile",
            str(profile_path),
        ],
    )
    args = replay_module.parse_args()
    assert args.rate == 11
    assert args.limit == 2
    assert args.dry_run is True
    assert args.log_format == "json"


def test_require_ingest_url(monkeypatch) -> None:
    """Ingest URL helper should read env and error when missing."""
    monkeypatch.setenv("INGEST_URL", "https://example.com/events")
    assert replay_module._require_ingest_url() == "https://example.com/events"
    monkeypatch.delenv("INGEST_URL", raising=False)
    with pytest.raises(RuntimeError, match="INGEST_URL"):
        replay_module._require_ingest_url()


def test_extract_event_handles_valid_and_malformed_lines() -> None:
    """Event extraction should skip invalid dead-letter payloads."""
    assert replay_module._extract_event('{"event":{"event_id":"x"}}') == {"event_id": "x"}
    assert replay_module._extract_event('{"reason":"x"}') is None
    assert replay_module._extract_event("not-json") is None
    assert replay_module._extract_event("[]") is None


def test_replay_events_dry_run_and_limit(monkeypatch, tmp_path) -> None:
    """Dry run should validate and count without sending events."""
    dead_letter_path = tmp_path / "dlq.jsonl"
    dead_letter_path.write_text(
        "\n".join(
            [
                '{"event":{"event_id":"a"}}',
                '{"event":{"event_id":"b"}}',
                "malformed-line",
                '{"event":{"event_id":"c"}}',
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(replay_module.time, "sleep", lambda _seconds: None)

    stats = replay_module.replay_events(
        str(dead_letter_path),
        rate=5.0,
        limit=2,
        ingest_client=None,
        dry_run=True,
    )
    assert stats["lines_read"] == 2
    assert stats["events_attempted"] == 2
    assert stats["events_replayed"] == 2
    assert stats["events_failed"] == 0
    assert stats["events_malformed"] == 0


def test_replay_events_skips_blank_lines(monkeypatch, tmp_path) -> None:
    """Blank lines should be ignored without affecting counters."""
    dead_letter_path = tmp_path / "dlq.jsonl"
    dead_letter_path.write_text('\n{"event":{"event_id":"a"}}\n\n', encoding="utf-8")
    monkeypatch.setattr(replay_module.time, "sleep", lambda _seconds: None)

    stats = replay_module.replay_events(
        str(dead_letter_path),
        rate=5.0,
        limit=None,
        ingest_client=None,
        dry_run=True,
    )
    assert stats["lines_read"] == 1
    assert stats["events_attempted"] == 1
    assert stats["events_replayed"] == 1


def test_replay_events_counts_failures_and_malformed(monkeypatch, tmp_path) -> None:
    """Replay should track success/failure/malformed counters."""
    dead_letter_path = tmp_path / "dlq.jsonl"
    dead_letter_path.write_text(
        "\n".join(
            [
                '{"event":{"event_id":"a"}}',
                '{"event":{"event_id":"b"}}',
                "malformed-line",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    fake_client = _FakeIngestClient([True, False])
    sleep_calls: list[float] = []
    monkeypatch.setattr(replay_module.time, "sleep", lambda seconds: sleep_calls.append(seconds))

    stats = replay_module.replay_events(
        str(dead_letter_path),
        rate=4.0,
        limit=None,
        ingest_client=fake_client,
        dry_run=False,
    )
    assert stats["lines_read"] == 3
    assert stats["events_attempted"] == 2
    assert stats["events_replayed"] == 1
    assert stats["events_failed"] == 1
    assert stats["events_malformed"] == 1
    assert sleep_calls == [0.25, 0.25]


def test_replay_events_validates_rate_limit_and_client_requirement(tmp_path) -> None:
    """Invalid rate/limit and missing client should raise errors."""
    dead_letter_path = tmp_path / "dlq.jsonl"
    dead_letter_path.write_text('{"event":{"event_id":"a"}}\n', encoding="utf-8")

    with pytest.raises(ValueError, match="rate"):
        replay_module.replay_events(str(dead_letter_path), rate=0, limit=None, ingest_client=None, dry_run=True)
    with pytest.raises(ValueError, match="limit"):
        replay_module.replay_events(str(dead_letter_path), rate=1, limit=0, ingest_client=None, dry_run=True)
    with pytest.raises(RuntimeError, match="ingest_client"):
        replay_module.replay_events(str(dead_letter_path), rate=1, limit=None, ingest_client=None, dry_run=False)


def test_main_wires_dependencies_and_logs(monkeypatch, tmp_path) -> None:
    """Main should configure logging, build client, and call replay."""
    dead_letter_path = tmp_path / "dlq.jsonl"
    dead_letter_path.write_text("", encoding="utf-8")
    parsed = argparse.Namespace(
        dead_letter_path=str(dead_letter_path),
        profile=None,
        rate=7.0,
        limit=3,
        timeout=2.0,
        max_retries=4,
        initial_backoff=0.4,
        max_backoff=3.0,
        circuit_failure_threshold=6,
        circuit_recovery_timeout=15.0,
        log_format="json",
        dry_run=False,
    )
    calls: dict[str, object] = {}

    class FakeIngestClient:
        def __init__(self, **kwargs: object) -> None:
            calls["ingest_kwargs"] = kwargs

    monkeypatch.setattr(replay_module, "parse_args", lambda: parsed)
    monkeypatch.setattr(replay_module, "configure_logging", lambda fmt: calls.__setitem__("log_format", fmt))
    monkeypatch.setattr(replay_module, "_require_ingest_url", lambda: "https://example.com/events")
    monkeypatch.setattr(replay_module, "IngestClient", FakeIngestClient)
    monkeypatch.setattr(
        replay_module,
        "replay_events",
        lambda *args, **kwargs: calls.__setitem__("replay_call", {"args": args, "kwargs": kwargs})
        or {
            "lines_read": 1,
            "events_attempted": 1,
            "events_replayed": 1,
            "events_failed": 0,
            "events_malformed": 0,
        },
    )

    replay_module.main()
    assert calls["log_format"] == "json"
    assert calls["ingest_kwargs"]["ingest_url"] == "https://example.com/events"
    assert calls["ingest_kwargs"]["retry_config"].max_retries == 4
    assert calls["ingest_kwargs"]["circuit_breaker_config"].failure_threshold == 6
    assert calls["replay_call"]["kwargs"]["rate"] == pytest.approx(7.0)
    assert calls["replay_call"]["kwargs"]["limit"] == 3
    assert calls["replay_call"]["kwargs"]["dry_run"] is False


def test_main_dry_run_skips_ingest_client(monkeypatch, tmp_path) -> None:
    """Dry-run mode should replay without constructing HTTP client."""
    dead_letter_path = tmp_path / "dlq.jsonl"
    dead_letter_path.write_text("", encoding="utf-8")
    parsed = argparse.Namespace(
        dead_letter_path=str(dead_letter_path),
        profile=None,
        rate=5.0,
        limit=None,
        timeout=5.0,
        max_retries=2,
        initial_backoff=0.2,
        max_backoff=2.0,
        circuit_failure_threshold=5,
        circuit_recovery_timeout=30.0,
        log_format="plain",
        dry_run=True,
    )
    calls: dict[str, object] = {}

    monkeypatch.setattr(replay_module, "parse_args", lambda: parsed)
    monkeypatch.setattr(replay_module, "configure_logging", lambda fmt: calls.__setitem__("log_format", fmt))
    monkeypatch.setattr(
        replay_module,
        "replay_events",
        lambda *args, **kwargs: calls.__setitem__("replay_kwargs", kwargs)
        or {
            "lines_read": 0,
            "events_attempted": 0,
            "events_replayed": 0,
            "events_failed": 0,
            "events_malformed": 0,
        },
    )

    replay_module.main()
    assert calls["log_format"] == "plain"
    assert calls["replay_kwargs"]["ingest_client"] is None
    assert calls["replay_kwargs"]["dry_run"] is True


def test_module_entrypoint_executes(monkeypatch, tmp_path) -> None:
    """`python -m simulator.replay_dead_letter` should execute module guard safely."""
    dead_letter_path = tmp_path / "dlq.jsonl"
    dead_letter_path.write_text('{"event":{"event_id":"a"}}\n', encoding="utf-8")
    monkeypatch.setattr(
        "sys.argv",
        ["replay", "--dead-letter-path", str(dead_letter_path), "--dry-run", "--rate", "1"],
    )
    runpy.run_module("simulator.replay_dead_letter", run_name="__main__")
