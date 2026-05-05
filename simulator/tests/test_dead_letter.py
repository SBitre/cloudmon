"""Tests for dead-letter persistence helpers."""

from __future__ import annotations

import json

from simulator.infra.dead_letter import DeadLetterWriter


def test_dead_letter_writer_appends_jsonl_records(tmp_path) -> None:
    """Writer should create parent directories and append JSONL entries."""
    file_path = tmp_path / "out" / "dead-letter.jsonl"
    writer = DeadLetterWriter(str(file_path))

    writer.write({"event_id": "evt-1"}, reason="http_503")
    writer.write({"event_id": "evt-2"}, reason="circuit_open")

    lines = file_path.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 2

    first = json.loads(lines[0])
    second = json.loads(lines[1])
    assert first["reason"] == "http_503"
    assert first["event"]["event_id"] == "evt-1"
    assert second["reason"] == "circuit_open"
    assert second["event"]["event_id"] == "evt-2"
    assert first["recorded_at"].endswith("Z")
