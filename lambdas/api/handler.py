import json
import logging
import os
import boto3
from decimal import Decimal
from boto3.dynamodb.conditions import Key, Attr
from datetime import datetime, timedelta, timezone

# Initialize logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize DynamoDB
dynamodb = boto3.resource('dynamodb')
ALERTS_TABLE = os.environ.get("ALERTS_TABLE_NAME", "cloudmon-alerts")
EVENTS_TABLE = os.environ.get("EVENTS_TABLE_NAME", "cloudmon-events")

def decimal_default(obj):
    """
    JSON encoder for DynamoDB Decimal values.
    Converts Decimals to int or float so json.dumps doesn't crash.
    """
    if isinstance(obj, Decimal):
        if obj % 1 == 0:
            return int(obj)
        return float(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

def make_response(status_code, body):
    """Helper to build API Gateway responses with CORS and Decimal support."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
        # Added decimal_default to handle numeric fields from DynamoDB
        "body": json.dumps(body, default=decimal_default),
    }

def get_alerts(query_params):
    """Query real alerts from DynamoDB."""
    limit = int(query_params.get("limit", 50))
    table = dynamodb.Table(ALERTS_TABLE)
    
    try:
        response = table.scan(Limit=limit)
        items = response.get('Items', [])
        
        # Sort by timestamp descending (newest first)
        items.sort(key=lambda x: x['timestamp'], reverse=True)
        
        return make_response(200, {"alerts": items, "count": len(items)})
    except Exception as e:
        logger.error(f"DynamoDB Error in get_alerts: {str(e)}")
        raise e

def get_event_volume(query_params):
    """Fetch real events and aggregate them into 1-minute buckets."""
    window_param = query_params.get("window", "30m")
    minutes = int(window_param.rstrip("m"))
    
    now = datetime.now(timezone.utc)
    cutoff_time = (now - timedelta(minutes=minutes)).isoformat().replace("+00:00", "Z")
    
    table = dynamodb.Table(EVENTS_TABLE)
    
    try:
        response = table.scan(
            FilterExpression=Attr('timestamp').gte(cutoff_time)
        )
        events = response.get('Items', [])
        
        buckets_map = {}
        
        # Pre-fill buckets with 0
        for i in range(minutes, -1, -1):
            t = (now - timedelta(minutes=i)).strftime("%Y-%m-%dT%H:%M")
            buckets_map[t] = 0

        for event in events:
            minute_key = event['timestamp'][:16]
            if minute_key in buckets_map:
                buckets_map[minute_key] += 1
            else:
                buckets_map[minute_key] = 1

        formatted_buckets = [
            {"minute": f"{m}:00Z", "count": c} 
            for m, c in sorted(buckets_map.items())
        ]
        
        return make_response(200, {
            "buckets": formatted_buckets, 
            "window": window_param,
            "total_events": len(events)
        })
    except Exception as e:
        logger.error(f"DynamoDB Error in get_event_volume: {str(e)}")
        raise e

def lambda_handler(event, context):
    """Route incoming HTTP API requests."""
    logger.info("Received event: %s", json.dumps(event))
    
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