"""
Placeholder ingest Lambda handler.

This will be replaced by Darkhan's real implementation.
For now, it accepts any POST request, logs it, and returns 200.
The purpose is to prove the API Gateway -> Lambda -> CloudWatch wiring works
and to give the simulator developer a real endpoint to test against.
"""
import json
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def lambda_handler(event, context):
    """
    AWS Lambda entry point. Receives an API Gateway HTTP API event,
    logs it, and returns 200.
    """
    logger.info("Received event: %s", json.dumps(event))

    # API Gateway HTTP API wraps the request body in event["body"] as a string
    body = event.get("body", "")

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({
            "message": "ok (placeholder handler)",
            "received_body": body,
        }),
    }