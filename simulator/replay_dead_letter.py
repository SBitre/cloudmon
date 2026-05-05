"""Compatibility wrapper for dead-letter replay CLI."""

from simulator.cli.replay import _extract_event, _require_ingest_url, main, parse_args, replay_events

__all__ = [
    "parse_args",
    "_require_ingest_url",
    "_extract_event",
    "replay_events",
    "main",
]


if __name__ == "__main__":
    main()
