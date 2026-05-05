"""Compatibility wrapper for background simulator CLI."""

from simulator.cli.background import BackgroundSimulator, _install_signal_handlers, _require_ingest_url, main, parse_args

__all__ = [
    "BackgroundSimulator",
    "parse_args",
    "_require_ingest_url",
    "_install_signal_handlers",
    "main",
]


if __name__ == "__main__":
    main()
