"""
Detection Lambda handler.

Runs on a schedule (EventBridge), queries recent events from DynamoDB,
applies anomaly detection rules, and writes alerts to the alerts table.

NOTE: detect_anomalies() was written before the event schema was finalized
and uses camelCase field names. It will be refactored (see issue:
"Refactor detection logic to match event schema") to use snake_case fields,
add Gemini integration for explanations, and produce schema-compliant alerts.
Until then, this Lambda runs successfully but produces no alerts because
the field mismatch causes all events to be filtered out.
"""
from google import genai
import uuid
from collections import defaultdict
import json
import os
import logging
from datetime import datetime, timedelta, timezone
import boto3
from boto3.dynamodb.conditions import Key

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource(
    "dynamodb",
    region_name=os.environ.get("AWS_REGION", "us-east-1")
)
EVENTS_TABLE_NAME = os.environ.get("EVENTS_TABLE_NAME", "cloudmon-events")
ALERTS_TABLE_NAME = os.environ.get("ALERTS_TABLE_NAME", "cloudmon-alerts")

events_table = dynamodb.Table(EVENTS_TABLE_NAME)
alerts_table = dynamodb.Table(ALERTS_TABLE_NAME)

MONITORED_SERVICES = ["login-service", "checkout-service", "payment-service", "api-gateway"]
LOOKBACK_MINUTES = 5


FAILED_LOGIN_THRESHOLD = 10
API_ERROR_THRESHOLD = 10
PAYMENT_FAILURE_THRESHOLD = 5

def generate_ai_explanation(alert):
    api_key = os.environ.get("GEMINI_API_KEY")

    if not api_key:
        logger.warning("GEMINI_API_KEY not set, using fallback explanation")
        return {
            "explanation": alert["explanation"],
            "recommended_actions": alert["recommended_actions"]
        }

    try:
        client = genai.Client(api_key=api_key)

        prompt = f"""
        You are an incident response assistant.

        Explain this cloud monitoring anomaly in simple English.

        Anomaly type: {alert.get("anomaly_type")}
        Service: {alert.get("service")}
        Severity: {alert.get("severity")}
        Triggering event count: {len(alert.get("triggering_events", []))}

        Return JSON only with this structure:
        {{
          "explanation": "short explanation",
          "recommended_actions": ["action 1", "action 2", "action 3"]
        }}
        """

        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=prompt
        )

        return json.loads(response.text)

    except Exception as e:
        logger.error("Gemini explanation failed: %s", str(e))
        return {
            "explanation": alert["explanation"],
            "recommended_actions": alert["recommended_actions"]
        }

def detect_anomalies(events):
    alerts = []

    failed_logins_by_ip = defaultdict(list)
    api_errors_by_service = defaultdict(list)
    payment_failures_by_service = defaultdict(list)

    for event in events:
        event_type = event.get("event_type")
        service = event.get("service", "unknown-service")
        ip_address = event.get("ip_address", "unknown-ip")

        if event_type == "failed_login":
            failed_logins_by_ip[ip_address].append(event)

        if event_type == "api_error":
            api_errors_by_service[service].append(event)

        if event_type == "payment_failure":
            payment_failures_by_service[service].append(event)

    for ip_address, triggering_events in failed_logins_by_ip.items():
        if len(triggering_events) >= FAILED_LOGIN_THRESHOLD:
            alerts.append({
                "alert_id": str(uuid.uuid4()),
                "service": triggering_events[0].get("service", "login-service"),
                "anomaly_type": "failed_login_burst",
                "severity": "high",
                "explanation": f"{len(triggering_events)} failed login attempts detected from IP {ip_address}.",
                "recommended_actions": [
                    "Review authentication logs for brute force activity.",
                    "Consider temporarily blocking or rate-limiting the IP address."
                ],
                "triggering_events": triggering_events
            })

    for service, triggering_events in api_errors_by_service.items():
        if len(triggering_events) >= API_ERROR_THRESHOLD:
            alerts.append({
                "alert_id": str(uuid.uuid4()),
                "service": service,
                "anomaly_type": "api_error_spike",
                "severity": "medium",
                "explanation": f"{len(triggering_events)} API error events detected for {service}.",
                "recommended_actions": [
                    "Check recent deployments or service health.",
                    "Review CloudWatch logs for stack traces or failing dependencies."
                ],
                "triggering_events": triggering_events
            })

    for service, triggering_events in payment_failures_by_service.items():
        if len(triggering_events) >= PAYMENT_FAILURE_THRESHOLD:
            alerts.append({
                "alert_id": str(uuid.uuid4()),
                "service": service,
                "anomaly_type": "payment_failure_burst",
                "severity": "high",
                "explanation": f"{len(triggering_events)} payment failures detected for {service}.",
                "recommended_actions": [
                    "Check payment provider status.",
                    "Review checkout/payment service logs."
                ],
                "triggering_events": triggering_events
            })

    for alert in alerts:
        ai_result = generate_ai_explanation(alert)

        alert["explanation"] = ai_result.get(
            "explanation",
            alert["explanation"]
        )

        alert["recommended_actions"] = ai_result.get(
            "recommended_actions",
            alert["recommended_actions"]
        )

    return alerts


def query_recent_events(service, lookback_minutes):
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=lookback_minutes)).isoformat().replace("+00:00", "Z")
    response = events_table.query(
        KeyConditionExpression=Key("service").eq(service) & Key("timestamp").gte(cutoff)
    )
    return response.get("Items", [])


def lambda_handler(event, context):
    """
    EventBridge invokes this on a schedule (no payload).
    For each monitored service, query recent events and run detection.
    """
    logger.info("Detection run started, lookback=%d min", LOOKBACK_MINUTES)

    total_events = 0
    total_alerts = 0

    for service in MONITORED_SERVICES:
        try:
            events = query_recent_events(service, LOOKBACK_MINUTES)
            total_events += len(events)
            logger.info("Service %s: %d events in last %d min", service, len(events), LOOKBACK_MINUTES)

            alerts = detect_anomalies(events)

            for alert in alerts:
                logger.warning("Alert detected for %s: %s", service, alert)
                total_alerts += 1

        except Exception as e:
            logger.error("Error processing service %s: %s", service, str(e))

    logger.info("Detection run complete: %d events scanned, %d alerts triggered", total_events, total_alerts)

    return {
        "statusCode": 200,
        "body": json.dumps({
            "events_scanned": total_events,
            "alerts_triggered": total_alerts,
        })
    }


if __name__ == "__main__":
    test_events = [
        {
            "event_type": "failed_login",
            "service": "login-service",
            "ip_address": "192.168.1.10",
            "timestamp": "2026-05-02T00:00:00Z"
        }
        for _ in range(12)
    ]

    print(detect_anomalies(test_events))