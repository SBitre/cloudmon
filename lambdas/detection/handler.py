import json


def detect_anomalies(events):
    alerts = []

    failed_logins = [e for e in events if e.get("eventType") == "failed_login"]

    if len(failed_logins) > 10:
        alerts.append({
            "type": "FAILED_LOGIN_SPIKE",
            "message": "High number of failed logins detected"
        })

    return alerts


def lambda_handler(event, context):
    events = event.get("events", [])
    alerts = detect_anomalies(events)

    return {
        "statusCode": 200,
        "body": json.dumps({
            "alerts": alerts
        })
    }


if __name__ == "__main__":
    test_events = [{"eventType": "failed_login"} for _ in range(12)]
    print(detect_anomalies(test_events))