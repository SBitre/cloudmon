"""Tests for simulator logging configuration and JSON formatter."""

from __future__ import annotations

import json
import logging

import pytest

from simulator.infra.logging import JsonLogFormatter, configure_logging


def test_json_log_formatter_outputs_expected_keys() -> None:
    """Formatter should serialize level/logger/message/timestamp fields."""
    formatter = JsonLogFormatter()
    record = logging.LogRecord(
        name="simulator.test",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="hello %s",
        args=("world",),
        exc_info=None,
    )
    rendered = formatter.format(record)
    payload = json.loads(rendered)

    assert payload["level"] == "INFO"
    assert payload["logger"] == "simulator.test"
    assert payload["message"] == "hello world"
    assert payload["timestamp"].endswith("Z")


def test_configure_logging_plain_and_json_modes() -> None:
    """Both plain and JSON modes should configure root handlers."""
    configure_logging("plain")
    root_logger = logging.getLogger()
    assert len(root_logger.handlers) == 1
    assert isinstance(root_logger.handlers[0].formatter, logging.Formatter)

    configure_logging("json")
    root_logger = logging.getLogger()
    assert isinstance(root_logger.handlers[0].formatter, JsonLogFormatter)


def test_configure_logging_rejects_invalid_format() -> None:
    """Invalid log format values should fail fast."""
    with pytest.raises(ValueError):
        configure_logging("xml")
