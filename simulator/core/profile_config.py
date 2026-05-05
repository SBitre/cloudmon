"""Profile file loading utilities for repeatable simulator runs."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def load_profile(profile_path: str) -> dict[str, Any]:
    """
    Load a simulator profile from JSON or YAML file.

    Args:
        profile_path: Path to `.json`, `.yaml`, or `.yml` profile.
    """
    path = Path(profile_path)
    suffix = path.suffix.lower()
    raw_content = path.read_text(encoding="utf-8")

    if suffix == ".json":
        parsed = json.loads(raw_content)
    elif suffix in {".yaml", ".yml"}:
        try:
            import yaml  # type: ignore[import-not-found]
        except ImportError as exc:  # pragma: no cover - validated via tests by monkeypatching
            raise RuntimeError("PyYAML is required to load YAML profiles") from exc
        parsed = yaml.safe_load(raw_content)
    else:
        raise ValueError("Profile file must end with .json, .yaml, or .yml")

    if not isinstance(parsed, dict):
        raise ValueError("Profile content must be a mapping/object")
    return parsed


def apply_profile_overrides(
    args: argparse.Namespace,
    profile: dict[str, Any],
    *,
    keys: tuple[str, ...],
) -> argparse.Namespace:
    """Apply selected profile keys onto parsed CLI arguments."""
    for key in keys:
        if key in profile:
            setattr(args, key, profile[key])
    return args
