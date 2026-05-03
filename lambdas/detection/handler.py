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
import json
import os
import logging
from datetime import datetime, timedelta, timezone
import boto3
from boto3.dynamodb.conditions import Key

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb")
EVENTS_TABLE_NAME = os.environ.get("EVENTS_TABLE_NAME", "cloudmon-events")
ALERTS_TABLE_NAME = os.environ.get("ALERTS_TABLE_NAME", "cloudmon-alerts")

events_table = dynamodb.Table(EVENTS_TABLE_NAME)
alerts_table = dynamodb.Table(ALERTS_TABLE_NAME)

MONITORED_SERVICES = ["login-service", "checkout-service", "payment-service", "api-gateway"]
LOOKBACK_MINUTES = 5


def detect_anomalies(events):
    """
    Original detection logic from gospelhope's PR.
    Will be replaced when the refactor lands (will use snake_case + Gemini).
    """
    alerts = []
    failed_logins = [e for e in events if e.get("eventType") == "failed_login"]
    if len(failed_logins) > 10:
        alerts.append({
            "type": "FAILED_LOGIN_SPIKE",
            "message": "High number of failed logins detected"
        })
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
    test_events = [{"eventType": "failed_login"} for _ in range(12)]
    print(detect_anomalies(test_events))