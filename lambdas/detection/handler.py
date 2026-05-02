def detect_anomalies(events):
    alerts = []

    failed_logins = [e for e in events if e.get("eventType") == "failed_login"]

    if len(failed_logins) > 10:
        alerts.append({
            "type": "FAILED_LOGIN_SPIKE",
            "message": "High number of failed logins detected"
        })

    return alerts