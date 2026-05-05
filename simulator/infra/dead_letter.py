"""Dead-letter persistence for undelivered simulator events."""

from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
import threading
from typing import Any

EventPayload = dict[str, Any]


class DeadLetterWriter:
    """Append failed events to newline-delimited JSON dead-letter files."""

    def __init__(self, file_path: str) -> None:
        """Initialize dead-letter writer for the provided path."""
        self._path = Path(file_path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()

    def write(self, event: EventPayload, *, reason: str) -> None:
        """Persist a failed event and metadata as one JSONL entry."""
        payload = {
            "recorded_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "reason": reason,
            "event": event,
        }
        serialized = json.dumps(payload, separators=(",", ":"))
        with self._lock:
            with self._path.open("a", encoding="utf-8") as handle:
                handle.write(serialized + "\n")
