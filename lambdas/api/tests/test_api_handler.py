import json
import os
import pytest
import boto3
from moto import mock_aws
from datetime import datetime, timedelta, timezone

# Constants for testing
ALERTS_TABLE = "cloudmon-alerts"
EVENTS_TABLE = "cloudmon-events"

@pytest.fixture
def aws_credentials():
    """Mocked AWS Credentials for moto."""
    os.environ["AWS_ACCESS_KEY_ID"] = "testing"
    os.environ["AWS_SECRET_ACCESS_KEY"] = "testing"
    os.environ["AWS_SECURITY_TOKEN"] = "testing"
    os.environ["AWS_SESSION_TOKEN"] = "testing"
    os.environ["AWS_DEFAULT_REGION"] = "us-east-1"
    os.environ["ALERTS_TABLE_NAME"] = ALERTS_TABLE
    os.environ["EVENTS_TABLE_NAME"] = EVENTS_TABLE

@pytest.fixture
def dynamodb_setup(aws_credentials):
    """Sets up mocked DynamoDB tables for Alerts and Events."""
    with mock_aws():
        db = boto3.resource("dynamodb", region_name="us-east-1")
        
        # Create Alerts Table
        db.create_table(
            TableName=ALERTS_TABLE,
            KeySchema=[{'AttributeName': 'alert_id', 'KeyType': 'HASH'}],
            AttributeDefinitions=[{'AttributeName': 'alert_id', 'AttributeType': 'S'}],
            ProvisionedThroughput={'ReadCapacityUnits': 1, 'WriteCapacityUnits': 1}
        )
        
        # Create Events Table
        db.create_table(
            TableName=EVENTS_TABLE,
            KeySchema=[
                {'AttributeName': 'service', 'KeyType': 'HASH'},
                {'AttributeName': 'timestamp', 'KeyType': 'RANGE'}
            ],
            AttributeDefinitions=[
                {'AttributeName': 'service', 'AttributeType': 'S'},
                {'AttributeName': 'timestamp', 'AttributeType': 'S'}
            ],
            ProvisionedThroughput={'ReadCapacityUnits': 1, 'WriteCapacityUnits': 1}
        )
        yield db

def test_get_alerts_success(dynamodb_setup):
    """
    Scenario: Fetching alerts when data exists.
    Expected: List of alerts returned, sorted by timestamp.
    """
    from lambdas.api.handler import lambda_handler
    
    table = dynamodb_setup.Table(ALERTS_TABLE)
    table.put_item(Item={
        "alert_id": "a1", 
        "timestamp": "2026-05-03T12:00:00Z", 
        "service": "auth-service",
        "severity": "error"
    })

    event = {
        "routeKey": "GET /alerts",
        "queryStringParameters": {"limit": "10"}
    }
    
    response = lambda_handler(event, None)
    body = json.loads(response["body"])
    
    assert response["statusCode"] == 200
    assert len(body["alerts"]) == 1
    assert body["alerts"][0]["alert_id"] == "a1"

def test_get_event_volume_aggregation(dynamodb_setup):
    """
    Scenario: Multiple events in the same minute.
    Expected: API groups them into a single bucket with correct count.
    """
    from lambdas.api.handler import lambda_handler
    
    table = dynamodb_setup.Table(EVENTS_TABLE)
    now = datetime.now(timezone.utc)
    # Target minute for aggregation
    target_time = now.strftime("%Y-%m-%dT%H:%M:30Z") 
    

    # Insert 3 events into the same minute, but with different seconds
    for i in range(3):
        # We vary the seconds (:01, :02, :03) so DynamoDB sees them as unique records
        unique_timestamp = now.strftime(f"%Y-%m-%dT%H:%M:0{i}Z") 
        table.put_item(Item={
            "service": "test-service",
            "timestamp": unique_timestamp,
            "event_id": f"event-{i}"
        })

    event = {
        "routeKey": "GET /events/volume",
        "queryStringParameters": {"window": "5m"}
    }
    
    response = lambda_handler(event, None)
    body = json.loads(response["body"])
    
    assert response["statusCode"] == 200
    # Find the bucket for our target minute
    target_key = target_time[:16]
    target_bucket = next((b for b in body["buckets"] if b["minute"].startswith(target_key)), None)
    
    assert target_bucket is not None
    assert target_bucket["count"] == 3

def test_route_not_found(aws_credentials):
    """
    Scenario: Request to an undefined route.
    Expected: 404 Not Found.
    """
    from lambdas.api.handler import lambda_handler
    event = {"routeKey": "GET /unknown"}
    response = lambda_handler(event, None)
    assert response["statusCode"] == 404