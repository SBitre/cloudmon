"""Tests for event construction helpers."""

from __future__ import annotations

from simulator.core.event_factory import EventFactory, utc_now_iso8601


def test_utc_now_iso8601_uses_utc_z_suffix() -> None:
    """Timestamp helper should always emit sortable UTC format."""
    timestamp = utc_now_iso8601()
    assert timestamp.endswith("Z")
    assert "T" in timestamp


def test_create_event_failed_login_includes_required_and_optional_fields() -> None:
    """Failed login events include identity and source fields."""
    factory = EventFactory(random_seed=1)
    event = factory.create_event("failed_login")

    assert event["event_type"] == "failed_login"
    assert event["service"] == "login-service"
    assert event["severity"] == "warning"
    assert event["user_id"].startswith("user_")
    assert event["ip_address"].count(".") == 3
    assert event["timestamp"].endswith("Z")
    assert event["event_id"]


def test_create_event_api_error_has_error_details() -> None:
    """API errors include endpoint, status code, and error message."""
    factory = EventFactory(random_seed=2)
    event = factory.create_event("api_error")

    assert event["event_type"] == "api_error"
    assert event["service"] in {"checkout-service", "api-gateway"}
    assert event["severity"] == "error"
    assert event["endpoint"].startswith("/")
    assert event["status_code"] in {400, 401, 403, 404, 500, 502, 503}
    assert isinstance(event["error_message"], str) and event["error_message"]
    assert event["ip_address"].count(".") == 3


def test_create_event_payment_success_and_failure_fields() -> None:
    """Payment events include metadata and defaults for failure path."""
    factory = EventFactory(random_seed=3)
    success_event = factory.create_event("payment_success")
    failed_event = factory.create_event("payment_failed")

    assert success_event["service"] == "payment-service"
    assert "error_message" not in success_event
    assert success_event["metadata"]["payment_method"] in {"card", "wallet", "bank_transfer"}

    assert failed_event["service"] == "payment-service"
    assert failed_event["severity"] == "critical"
    assert failed_event["error_message"] == "Payment provider authorization failed"
    assert failed_event["metadata"]["currency"] in {"USD", "EUR", "GBP"}


def test_create_event_respects_explicit_overrides_and_unknown_type_defaults() -> None:
    """Custom parameters should override inferred values for edge cases."""
    factory = EventFactory(random_seed=4)
    event = factory.create_event(
        "custom_event",
        service="custom-service",
        severity="critical",
        user_id="user_9999",
        ip_address="192.0.2.10",
        endpoint="/custom",
        status_code=418,
        error_message="Custom error",
        metadata={"key": "value"},
    )

    assert event["service"] == "custom-service"
    assert event["severity"] == "critical"
    assert event["event_type"] == "custom_event"
    assert "endpoint" not in event
    assert "status_code" not in event
    assert "error_message" not in event
    assert "metadata" not in event


def test_create_event_payment_failed_preserves_custom_error_message() -> None:
    """`setdefault` should not overwrite explicit payment failure reason."""
    factory = EventFactory(random_seed=5)
    event = factory.create_event("payment_failed", error_message="Provider outage")
    assert event["error_message"] == "Provider outage"


def test_create_random_event_uses_distribution_result() -> None:
    """Random event generation should delegate chosen type into create_event."""
    factory = EventFactory(random_seed=6)
    created_types: list[str] = []

    def fake_create_event(event_type: str, **_: object) -> dict[str, object]:
        created_types.append(event_type)
        return {"event_type": event_type}

    factory.create_event = fake_create_event  # type: ignore[method-assign]
    event = factory.create_random_event()

    assert event["event_type"] in {entry.event_type for entry in EventFactory.DISTRIBUTION}
    assert created_types == [event["event_type"]]


def test_service_selection_and_severity_mapping_cover_all_branches() -> None:
    """Private helpers should map each branch to expected values."""
    factory = EventFactory(random_seed=7)

    assert factory._service_for_event_type("successful_login") == "login-service"
    assert factory._service_for_event_type("payment_success") == "payment-service"
    assert factory._service_for_event_type("api_call") in {"checkout-service", "api-gateway"}
    assert factory._service_for_event_type("unknown") in set(factory.SERVICES)

    assert factory._severity_for_event_type("successful_login") == "info"
    assert factory._severity_for_event_type("failed_login") == "warning"
    assert factory._severity_for_event_type("api_error") == "error"
    assert factory._severity_for_event_type("payment_failed") == "critical"
    assert factory._severity_for_event_type("unexpected") == "warning"


def test_random_helpers_generate_reasonable_formats() -> None:
    """Low-level random helpers should produce expected formatting contracts."""
    factory = EventFactory(random_seed=8)

    user_id = factory._random_user_id()
    ip = factory._random_ip_address()

    assert user_id.startswith("user_")
    assert user_id.split("_")[1].isdigit()
    assert ip.count(".") == 3
