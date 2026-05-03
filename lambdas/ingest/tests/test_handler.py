import json
import os
import pytest
import boto3
from moto import mock_aws

# Constants for testing
TABLE_NAME = "cloudmon-events"

@pytest.fixture
def aws_credentials():
    """
    Mocked AWS Credentials for moto.
    """
    os.environ["AWS_ACCESS_KEY_ID"] = "testing"
    os.environ["AWS_SECRET_ACCESS_KEY"] = "testing"
    os.environ["AWS_SECURITY_TOKEN"] = "testing"
    os.environ["AWS_SESSION_TOKEN"] = "testing"
    os.environ["AWS_DEFAULT_REGION"] = "us-east-1"
    os.environ["EVENTS_TABLE_NAME"] = TABLE_NAME

@pytest.fixture
def dynamodb_mock(aws_credentials):
    """
    Sets up a mocked DynamoDB environment with the correct schema.
    """
    with mock_aws():
        db = boto3.resource("dynamodb", region_name="us-east-1")
        db.create_table(
            TableName=TABLE_NAME,
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

def test_handler_success(dynamodb_mock):
    """
    Scenario: Valid event provided.
    Expected: 201 Created and data persisted.
    """
    from lambdas.ingest.handler import lambda_handler

    valid_payload = {
        "event_id": "uuid-12345",
        "timestamp": "2026-05-02T10:00:00Z",
        "service": "auth-service",
        "event_type": "failed_login",
        "severity": "warning"
    }
    event = {"body": json.dumps(valid_payload)}
    
    response = lambda_handler(event, None)
    assert response["statusCode"] == 201
    
    table = dynamodb_mock.Table(TABLE_NAME)
    item = table.get_item(Key={
        "service": "auth-service", 
        "timestamp": "2026-05-02T10:00:00Z"
    })
    assert "Item" in item

def test_handler_missing_required_field(aws_credentials):
    """
    Scenario: Missing mandatory field.
    Expected: 400 Bad Request with specific error message.
    """
    from lambdas.ingest.handler import lambda_handler

    invalid_payload = {
        "event_id": "123",
        "timestamp": "2026-05-02T10:00:00Z",
        "service": "auth-service",
        "severity": "info"
    }
    event = {"body": json.dumps(invalid_payload)}
    
    response = lambda_handler(event, None)
    assert response["statusCode"] == 400
    # Matching the actual error message from handler.py
    assert "is required and cannot be empty" in json.loads(response["body"])["error"]

def test_handler_invalid_severity(aws_credentials):
    """
    Scenario: Severity level is not supported.
    Expected: 400 Bad Request.
    """
    from lambdas.ingest.handler import lambda_handler

    payload = {
        "event_id": "123",
        "timestamp": "2026-05-02T10:00:00Z",
        "service": "auth",
        "event_type": "login",
        "severity": "NOT_REAL_LEVEL"
    }
    event = {"body": json.dumps(payload)}
    
    response = lambda_handler(event, None)
    assert response["statusCode"] == 400
    assert "Invalid severity" in json.loads(response["body"])["error"]

def test_handler_malformed_json(aws_credentials):
    """
    Scenario: Body is not a valid JSON.
    Expected: 400 Bad Request.
    """
    from lambdas.ingest.handler import lambda_handler

    event = {"body": "{ 'bad': 'json'"}
    
    response = lambda_handler(event, None)
    assert response["statusCode"] == 400
    assert "Malformed JSON" in json.loads(response["body"])["error"]

@mock_aws
def test_handler_database_error(aws_credentials):
    """
    Scenario: Database table is missing.
    Expected: 500 Internal Server Error.
    """
    from lambdas.ingest.handler import lambda_handler
    
    os.environ["EVENTS_TABLE_NAME"] = "non-existent-table"
    
    payload = {
        "event_id": "123",
        "timestamp": "2026-05-02T10:00:00Z",
        "service": "auth",
        "event_type": "login",
        "severity": "info"
    }
    event = {"body": json.dumps(payload)}
    
    response = lambda_handler(event, None)
    assert response["statusCode"] == 500
    assert "Internal server error" in json.loads(response["body"])["error"]