"""
Placeholder read API Lambda handler.

This will be replaced by Darkhan's real implementation.
For now, it returns mock data so the dashboard developer can build against
a real endpoint immediately, without waiting for the database query logic.

Routes handled:
  GET /alerts            -> list of recent alerts
  GET /events/volume     -> event count grouped by minute

When the real handler lands, it will query DynamoDB instead of returning
hardcoded mock data. The response shape stays the same, so the dashboard
won't need changes.
"""
import json
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def make_response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
        "body": json.dumps(body),
    }


def get_alerts(query_params):
    """Mock: return a fake list of recent alerts."""
    limit = int(query_params.get("limit", 50))
    
    # Mock data — replace with DynamoDB scan/query when real handler lands
    mock_alerts = [
        {
            "alert_id": "mock-alert-001",
            "timestamp": (datetime.now(timezone.utc) - timedelta(minutes=2)).isoformat().replace("+00:00", "Z"),
            "service": "login-service",
            "anomaly_type": "FAILED_LOGIN_SPIKE",
            "severity": "warning",
            "explanation": "Mock data — placeholder API. Real explanations will come from Gemini once detection refactor + Gemini integration land.",
            "recommended_actions": [
                "This is mock data",
                "Real alerts will appear once detection refactor is merged",
            ],
            "triggering_events": [],
        },
        {
            "alert_id": "mock-alert-002",
            "timestamp": (datetime.now(timezone.utc) - timedelta(minutes=8)).isoformat().replace("+00:00", "Z"),
            "service": "payment-service",
            "anomaly_type": "PAYMENT_FAILURE_BURST",
            "severity": "error",
            "explanation": "Mock alert — confirms dashboard rendering works for the 'error' severity color.",
            "recommended_actions": ["Mock"],
            "triggering_events": [],
        },
    ][:limit]
    
    return make_response(200, {"alerts": mock_alerts, "count": len(mock_alerts)})


def get_event_volume(query_params):
    """Mock: return fake event counts grouped by minute."""
    window = query_params.get("window", "30m")
    minutes = int(window.rstrip("m"))
    
    now = datetime.now(timezone.utc)
    buckets = []
    for i in range(minutes, 0, -1):
        bucket_time = (now - timedelta(minutes=i)).replace(second=0, microsecond=0)
        # Mock: oscillating count between 3-12 to make a visible chart
        count = 5 + (i % 7)
        buckets.append({
            "minute": bucket_time.isoformat().replace("+00:00", "Z"),
            "count": count,
        })
    
    return make_response(200, {"buckets": buckets, "window": window})


def lambda_handler(event, context):
    """Route incoming HTTP API requests to the right handler."""
    logger.info("Received event: %s", json.dumps(event))
    
    # API Gateway HTTP API v2.0 payload format
    route_key = event.get("routeKey", "")
    query_params = event.get("queryStringParameters") or {}
    
    try:
        if route_key == "GET /alerts":
            return get_alerts(query_params)
        elif route_key == "GET /events/volume":
            return get_event_volume(query_params)
        else:
            return make_response(404, {"error": f"Route not found: {route_key}"})
    
    except Exception as e:
        logger.error("Error handling request: %s", str(e))
        return make_response(500, {"error": "Internal server error"})