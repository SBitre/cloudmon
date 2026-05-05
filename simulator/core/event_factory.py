"""Event construction utilities for CloudMon simulator workloads."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import random
from typing import Any
import uuid

EventPayload = dict[str, Any]


def utc_now_iso8601() -> str:
    """Return the current UTC time in ISO 8601 format with `Z` suffix."""
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


@dataclass(frozen=True)
class EventDistribution:
    """Weighted distribution for random background traffic generation."""

    event_type: str
    weight: int


class EventFactory:
    """Create realistic event payloads that match `docs/event-schema.md`."""

    SERVICES = (
        "login-service",
        "checkout-service",
        "payment-service",
        "api-gateway",
    )

    ENDPOINTS = (
        "/api/login",
        "/api/orders",
        "/api/checkout",
        "/api/payments",
        "/api/profile",
        "/health",
    )

    DISTRIBUTION: tuple[EventDistribution, ...] = (
        EventDistribution("successful_login", 60),
        EventDistribution("failed_login", 10),
        EventDistribution("api_call", 20),
        EventDistribution("api_error", 5),
        EventDistribution("payment_success", 4),
        EventDistribution("payment_failed", 1),
    )

    def __init__(self, random_seed: int | None = None) -> None:
        """Initialize factory with optional deterministic random seed."""
        self._random = random.Random(random_seed)

    def create_random_event(self) -> EventPayload:
        """Create an event sampled from the configured realistic mix."""
        choices = [entry.event_type for entry in self.DISTRIBUTION]
        weights = [entry.weight for entry in self.DISTRIBUTION]
        event_type = self._random.choices(choices, weights=weights, k=1)[0]
        return self.create_event(event_type=event_type)

    def create_event(
        self,
        event_type: str,
        *,
        service: str | None = None,
        severity: str | None = None,
        ip_address: str | None = None,
        user_id: str | None = None,
        endpoint: str | None = None,
        status_code: int | None = None,
        error_message: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> EventPayload:
        """Create an event payload with schema-compliant base and optional fields."""
        selected_service = service or self._service_for_event_type(event_type)
        selected_severity = severity or self._severity_for_event_type(event_type)
        selected_endpoint = endpoint or self._random.choice(self.ENDPOINTS)

        event: EventPayload = {
            "event_id": str(uuid.uuid4()),
            "timestamp": utc_now_iso8601(),
            "service": selected_service,
            "event_type": event_type,
            "severity": selected_severity,
        }

        # Add realistic optional fields by event family.
        if event_type in {"successful_login", "failed_login"}:
            event["user_id"] = user_id or self._random_user_id()
            event["ip_address"] = ip_address or self._random_ip_address()

        if event_type in {"api_call", "api_error"}:
            event["endpoint"] = selected_endpoint
            event["ip_address"] = ip_address or self._random_ip_address()

        if event_type == "api_error":
            event["status_code"] = status_code or self._random.choice((400, 401, 403, 404, 500, 502, 503))
            event["error_message"] = error_message or self._random.choice(
                (
                    "Database connection timeout",
                    "Dependency service unavailable",
                    "Rate limit exceeded",
                    "Unhandled exception in request handler",
                )
            )

        if event_type in {"payment_success", "payment_failed"}:
            event["user_id"] = user_id or self._random_user_id()
            event["metadata"] = metadata or {
                "payment_method": self._random.choice(("card", "wallet", "bank_transfer")),
                "currency": self._random.choice(("USD", "EUR", "GBP")),
            }

        if event_type == "payment_failed":
            event.setdefault("error_message", error_message or "Payment provider authorization failed")

        return event

    def _service_for_event_type(self, event_type: str) -> str:
        """Choose a realistic service based on event family."""
        if event_type in {"successful_login", "failed_login"}:
            return "login-service"
        if event_type in {"payment_success", "payment_failed"}:
            return "payment-service"
        if event_type in {"api_call", "api_error"}:
            return self._random.choice(("checkout-service", "api-gateway"))
        return self._random.choice(self.SERVICES)

    @staticmethod
    def _severity_for_event_type(event_type: str) -> str:
        """Map event type to a sensible default severity."""
        severity_map = {
            "successful_login": "info",
            "failed_login": "warning",
            "api_call": "info",
            "api_error": "error",
            "payment_success": "info",
            "payment_failed": "critical",
            "traffic_spike": "warning",
        }
        return severity_map.get(event_type, "warning")

    def _random_user_id(self) -> str:
        """Return a pseudo-realistic user identifier."""
        return f"user_{self._random.randint(1000, 9999)}"

    def _random_ip_address(self) -> str:
        """Generate an IPv4 address from documentation-only ranges."""
        prefixes = ("203.0.113", "198.51.100", "192.0.2")
        return f"{self._random.choice(prefixes)}.{self._random.randint(1, 254)}"
