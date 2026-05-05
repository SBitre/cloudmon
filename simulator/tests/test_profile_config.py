"""Tests for simulator profile loading and argument overrides."""

from __future__ import annotations

import argparse
import json

import pytest

from simulator.core import profile_config


def test_load_profile_json(tmp_path) -> None:
    """JSON profile should deserialize to dict."""
    path = tmp_path / "profile.json"
    path.write_text(json.dumps({"rate": 5, "seed": 7}), encoding="utf-8")

    loaded = profile_config.load_profile(str(path))
    assert loaded == {"rate": 5, "seed": 7}


def test_load_profile_yaml(tmp_path) -> None:
    """YAML profile should deserialize to dict when PyYAML is available."""
    path = tmp_path / "profile.yaml"
    path.write_text("rate: 6\nseed: 9\n", encoding="utf-8")

    loaded = profile_config.load_profile(str(path))
    assert loaded == {"rate": 6, "seed": 9}


def test_load_profile_rejects_invalid_suffix(tmp_path) -> None:
    """Unsupported profile extensions should raise clear errors."""
    path = tmp_path / "profile.txt"
    path.write_text("{}", encoding="utf-8")
    with pytest.raises(ValueError, match="Profile file must end with"):
        profile_config.load_profile(str(path))


def test_load_profile_rejects_non_mapping(tmp_path) -> None:
    """Profile must be a mapping/object shape."""
    path = tmp_path / "profile.json"
    path.write_text("[]", encoding="utf-8")
    with pytest.raises(ValueError, match="mapping"):
        profile_config.load_profile(str(path))


def test_load_profile_yaml_import_error(monkeypatch, tmp_path) -> None:
    """YAML loading should raise meaningful error without PyYAML."""
    path = tmp_path / "profile.yaml"
    path.write_text("rate: 3\n", encoding="utf-8")
    original_import = __import__

    def fake_import(name, *args, **kwargs):  # type: ignore[no-untyped-def]
        if name == "yaml":
            raise ImportError("no yaml")
        return original_import(name, *args, **kwargs)

    monkeypatch.setattr("builtins.__import__", fake_import)
    with pytest.raises(RuntimeError, match="PyYAML"):
        profile_config.load_profile(str(path))


def test_apply_profile_overrides_updates_selected_keys() -> None:
    """Only selected keys should be applied to parsed args namespace."""
    args = argparse.Namespace(rate=5.0, seed=1, untouched=True)
    updated = profile_config.apply_profile_overrides(
        args,
        {"rate": 9.0, "seed": 42, "ignored": "x"},
        keys=("rate", "seed"),
    )

    assert updated.rate == 9.0
    assert updated.seed == 42
    assert updated.untouched is True
