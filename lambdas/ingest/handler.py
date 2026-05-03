import json
import boto3
import os
import logging
from datetime import datetime

# Initialize logging for CloudWatch
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize DynamoDB Resource outside the handler
dynamodb = boto3.resource('dynamodb')
TABLE_NAME = os.environ.get("EVENTS_TABLE_NAME", "cloudmon-events")
table = dynamodb.Table(TABLE_NAME)

def lambda_handler(event, context):
    """
    Ingest API Lambda Handler.
    Validates incoming event data and persists it to DynamoDB.
    """
    logger.info(f"Received event: {json.dumps(event)}")
    
    try:
        # 1. Extract the request body
        if not event.get("body"):
            return create_response(400, {"error": "Request body is empty"})
            
        body = json.loads(event["body"])
        
        # 2. Schema Validation (Required Fields)
        required_fields = ["event_id", "timestamp", "service", "event_type", "severity"]
        for field in required_fields:
            if field not in body or body[field] == "":
                logger.warning(f"Validation failed: field '{field}' is required")
                return create_response(400, {"error": f"Field '{field}' is required and cannot be empty"})
        
        # 3. Severity Level Validation
        valid_severities = ["info", "warning", "error", "critical"]
        if body["severity"] not in valid_severities:
            logger.warning(f"Validation failed: invalid severity level '{body['severity']}'")
            return create_response(400, {"error": f"Invalid severity. Allowed: {valid_severities}"})

        # 4. Timestamp ISO 8601 Validation
        try:
            datetime.fromisoformat(body["timestamp"].replace('Z', '+00:00'))
        except ValueError:
            logger.warning(f"Validation failed: invalid timestamp '{body['timestamp']}'")
            return create_response(400, {"error": "Timestamp must be in valid ISO 8601 format"})

        # 5. Write to DynamoDB
        table.put_item(Item=body)
        logger.info(f"Successfully recorded event {body['event_id']}")

        return create_response(201, {
            "event_id": body["event_id"],
            "status": "success"
        })

    except json.JSONDecodeError:
        logger.error("JSON Decode Error: Malformed body")
        return create_response(400, {"error": "Malformed JSON input"})
    except Exception as e:
        logger.error(f"Critical Internal Error: {str(e)}")
        return create_response(500, {"error": "Internal server error during DB write"})

def create_response(status_code, body):
    """
    Helper to generate a response with CORS headers.
    """
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        },
        "body": json.dumps(body)
    }