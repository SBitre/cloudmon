"""Logging helpers for plain-text and JSON structured simulator logs."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import logging


class JsonLogFormatter(logging.Formatter):
    """Format log records as one JSON object per line."""

    def format(self, record: logging.LogRecord) -> str:
        """Serialize a log record in structured JSON form."""
        payload = {
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        return json.dumps(payload, separators=(",", ":"))


def configure_logging(log_format: str = "plain") -> None:
    """
    Configure root logging for simulator commands.

    Args:
        log_format: Either `plain` or `json`.
    """
    if log_format not in {"plain", "json"}:
        raise ValueError("log_format must be one of: plain, json")

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.setLevel(logging.INFO)

    handler = logging.StreamHandler()
    if log_format == "json":
        handler.setFormatter(JsonLogFormatter())
    else:
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s - %(message)s"))
    root_logger.addHandler(handler)
