"""Tests for scenario-specific script modules."""

from __future__ import annotations

import argparse
import json

import pytest

from simulator.core.event_factory import EventFactory
from simulator.scenarios import credential_stuffing, error_spike, payment_failure_burst


def test_credential_stuffing_parse_args_defaults(monkeypatch) -> None:
    """Credential stuffing parser should expose expected defaults."""
    monkeypatch.setattr("sys.argv", ["credential_stuffing"])
    args = credential_stuffing.parse_args()
    assert args.profile is None
    assert args.count == 200
    assert args.duration == 30.0
    assert args.ip_prefix == "198.51.100"
    assert args.single_ip is None
    assert args.timeout == 5.0
    assert args.max_retries == 2
    assert args.initial_backoff == 0.2
    assert args.max_backoff == 2.0
    assert args.circuit_failure_threshold == 5
    assert args.circuit_recovery_timeout == 30.0
    assert args.dead_letter_path is None
    assert args.log_format == "plain"
    assert args.seed is None


def test_credential_stuffing_builder_uses_sequential_ips() -> None:
    """Sequential host octets should wrap at 254 then restart."""
    factory = EventFactory(random_seed=1)
    first = credential_stuffing.build_failed_login_event(0, factory, "198.51.100")
    wrapped = credential_stuffing.build_failed_login_event(254, factory, "198.51.100")
    assert first["ip_address"] == "198.51.100.1"
    assert wrapped["ip_address"] == "198.51.100.1"
    assert first["service"] == "login-service"
    assert first["event_type"] == "failed_login"


def test_credential_stuffing_builder_single_ip_overrides_prefix() -> None:
    """When single_ip is set, every event uses that exact address regardless of index."""
    factory = EventFactory(random_seed=1)
    pinned_ip = "203.0.113.42"
    first = credential_stuffing.build_failed_login_event(0, factory, "198.51.100", pinned_ip)
    later = credential_stuffing.build_failed_login_event(99, factory, "198.51.100", pinned_ip)
    assert first["ip_address"] == pinned_ip
    assert later["ip_address"] == pinned_ip
    assert first["service"] == "login-service"
    assert first["event_type"] == "failed_login"


def test_credential_stuffing_parse_args_accepts_single_ip(monkeypatch) -> None:
    """--single-ip should be parsed and validated as IPv4."""
    monkeypatch.setattr("sys.argv", ["credential_stuffing", "--single-ip", "198.51.100.42"])
    args = credential_stuffing.parse_args()
    assert args.single_ip == "198.51.100.42"


def test_credential_stuffing_parse_args_rejects_invalid_single_ip(monkeypatch) -> None:
    """Invalid IPv4 input via --single-ip should fail argparse."""
    monkeypatch.setattr("sys.argv", ["credential_stuffing", "--single-ip", "not-an-ip"])
    with pytest.raises(SystemExit):
        credential_stuffing.parse_args()


def test_credential_stuffing_validate_ipv4_rejects_ipv6() -> None:
    """The shared validator must reject IPv6 literals."""
    with pytest.raises(argparse.ArgumentTypeError):
        credential_stuffing._validate_ipv4("::1")


def test_credential_stuffing_parse_args_profile_override(monkeypatch, tmp_path) -> None:
    """Profile values should override default parser settings."""
    profile_path = tmp_path / "credential-profile.json"
    profile_path.write_text(json.dumps({"count": 15, "log_format": "json"}), encoding="utf-8")
    monkeypatch.setattr("sys.argv", ["credential_stuffing", "--profile", str(profile_path)])
    args = credential_stuffing.parse_args()
    assert args.count == 15
    assert args.log_format == "json"


def test_credential_stuffing_profile_can_set_single_ip(monkeypatch, tmp_path) -> None:
    """Profiles should be able to set --single-ip and the value is re-validated."""
    profile_path = tmp_path / "centralized-profile.json"
    profile_path.write_text(json.dumps({"single_ip": "192.0.2.7"}), encoding="utf-8")
    monkeypatch.setattr("sys.argv", ["credential_stuffing", "--profile", str(profile_path)])
    args = credential_stuffing.parse_args()
    assert args.single_ip == "192.0.2.7"


def test_credential_stuffing_profile_invalid_single_ip_rejected(monkeypatch, tmp_path) -> None:
    """An invalid single_ip from a profile should fail validation post-merge."""
    profile_path = tmp_path / "broken-profile.json"
    profile_path.write_text(json.dumps({"single_ip": "999.999.999.999"}), encoding="utf-8")
    monkeypatch.setattr("sys.argv", ["credential_stuffing", "--profile", str(profile_path)])
    with pytest.raises(argparse.ArgumentTypeError):
        credential_stuffing.parse_args()


def test_error_spike_parse_args_defaults(monkeypatch) -> None:
    """Error spike parser should expose expected defaults."""
    monkeypatch.setattr("sys.argv", ["error_spike"])
    args = error_spike.parse_args()
    assert args.profile is None
    assert args.count == 120
    assert args.duration == 20.0
    assert args.service == "checkout-service"
    assert args.timeout == 5.0
    assert args.max_retries == 2
    assert args.initial_backoff == 0.2
    assert args.max_backoff == 2.0
    assert args.circuit_failure_threshold == 5
    assert args.circuit_recovery_timeout == 30.0
    assert args.dead_letter_path is None
    assert args.log_format == "plain"
    assert args.seed is None


def test_error_spike_builder_varies_endpoint_and_status() -> None:
    """Error spike builder should rotate endpoints and status codes."""
    factory = EventFactory(random_seed=2)
    event0 = error_spike.build_api_error_event(0, factory, "checkout-service")
    event1 = error_spike.build_api_error_event(1, factory, "checkout-service")
    event2 = error_spike.build_api_error_event(2, factory, "checkout-service")

    assert event0["endpoint"] == "/api/checkout"
    assert event1["endpoint"] == "/api/orders"
    assert event2["endpoint"] == "/api/cart"
    assert event0["status_code"] == 503
    assert event1["status_code"] == 500
    assert event0["service"] == "checkout-service"
    assert event0["event_type"] == "api_error"


def test_error_spike_parse_args_profile_override(monkeypatch, tmp_path) -> None:
    """Profile values should override API error parser defaults."""
    profile_path = tmp_path / "error-profile.json"
    profile_path.write_text(json.dumps({"count": 77, "service": "api-gateway"}), encoding="utf-8")
    monkeypatch.setattr("sys.argv", ["error_spike", "--profile", str(profile_path)])
    args = error_spike.parse_args()
    assert args.count == 77
    assert args.service == "api-gateway"


def test_payment_failure_parse_args_defaults(monkeypatch) -> None:
    """Payment failure parser should expose expected defaults."""
    monkeypatch.setattr("sys.argv", ["payment_failure_burst"])
    args = payment_failure_burst.parse_args()
    assert args.profile is None
    assert args.count == 80
    assert args.duration == 20.0
    assert args.service == "payment-service"
    assert args.timeout == 5.0
    assert args.max_retries == 2
    assert args.initial_backoff == 0.2
    assert args.max_backoff == 2.0
    assert args.circuit_failure_threshold == 5
    assert args.circuit_recovery_timeout == 30.0
    assert args.dead_letter_path is None
    assert args.log_format == "plain"
    assert args.seed is None


def test_payment_failure_builder_rotates_metadata() -> None:
    """Payment failure builder should cycle payment methods and attempts."""
    factory = EventFactory(random_seed=3)
    event0 = payment_failure_burst.build_payment_failed_event(0, factory, "payment-service")
    event1 = payment_failure_burst.build_payment_failed_event(1, factory, "payment-service")
    event2 = payment_failure_burst.build_payment_failed_event(2, factory, "payment-service")

    assert event0["metadata"]["payment_method"] == "card"
    assert event1["metadata"]["payment_method"] == "wallet"
    assert event2["metadata"]["payment_method"] == "bank_transfer"
    assert event0["metadata"]["attempt"] == 1
    assert event2["metadata"]["attempt"] == 3
    assert event0["service"] == "payment-service"
    assert event0["event_type"] == "payment_failed"


def test_payment_failure_parse_args_profile_override(monkeypatch, tmp_path) -> None:
    """Profile values should override payment-failure parser defaults."""
    profile_path = tmp_path / "payment-profile.json"
    profile_path.write_text(json.dumps({"count": 55, "service": "checkout-service"}), encoding="utf-8")
    monkeypatch.setattr("sys.argv", ["payment_failure_burst", "--profile", str(profile_path)])
    args = payment_failure_burst.parse_args()
    assert args.count == 55
    assert args.service == "checkout-service"


def test_scenario_main_functions_construct_runner_and_execute(monkeypatch) -> None:
    """Each scenario main should configure logging and execute runner once."""
    runs: list[dict[str, object]] = []

    class FakeRunner:
        def __init__(self, config: object, event_builder: object) -> None:
            runs.append({"config": config, "event_builder": event_builder, "executed": False})

        def run(self) -> None:
            runs[-1]["executed"] = True

    monkeypatch.setattr(credential_stuffing, "configure_logging", lambda fmt: runs.append({"script": "credential", "fmt": fmt}))
    monkeypatch.setattr(credential_stuffing, "ScenarioRunner", FakeRunner)
    monkeypatch.setattr(
        credential_stuffing,
        "parse_args",
        lambda: argparse.Namespace(
            count=10,
            duration=5.0,
            ip_prefix="198.51.100",
            timeout=1.0,
            max_retries=3,
            initial_backoff=0.3,
            max_backoff=2.0,
            circuit_failure_threshold=6,
            circuit_recovery_timeout=20.0,
            dead_letter_path="simulator/out/cs.jsonl",
            log_format="json",
            seed=42,
        ),
    )
    credential_stuffing.main()

    monkeypatch.setattr(error_spike, "configure_logging", lambda fmt: runs.append({"script": "error", "fmt": fmt}))
    monkeypatch.setattr(error_spike, "ScenarioRunner", FakeRunner)
    monkeypatch.setattr(
        error_spike,
        "parse_args",
        lambda: argparse.Namespace(
            count=11,
            duration=6.0,
            service="checkout-service",
            timeout=2.0,
            max_retries=3,
            initial_backoff=0.3,
            max_backoff=2.0,
            circuit_failure_threshold=6,
            circuit_recovery_timeout=20.0,
            dead_letter_path="simulator/out/error.jsonl",
            log_format="json",
            seed=7,
        ),
    )
    error_spike.main()

    monkeypatch.setattr(payment_failure_burst, "configure_logging", lambda fmt: runs.append({"script": "payment", "fmt": fmt}))
    monkeypatch.setattr(payment_failure_burst, "ScenarioRunner", FakeRunner)
    monkeypatch.setattr(
        payment_failure_burst,
        "parse_args",
        lambda: argparse.Namespace(
            count=12,
            duration=7.0,
            service="payment-service",
            timeout=3.0,
            max_retries=3,
            initial_backoff=0.3,
            max_backoff=2.0,
            circuit_failure_threshold=6,
            circuit_recovery_timeout=20.0,
            dead_letter_path="simulator/out/payment.jsonl",
            log_format="json",
            seed=8,
        ),
    )
    payment_failure_burst.main()

    executed_runs = [entry for entry in runs if entry.get("executed") is True]
    assert len(executed_runs) == 3
    assert [entry["fmt"] for entry in runs if "fmt" in entry] == ["json", "json", "json"]
