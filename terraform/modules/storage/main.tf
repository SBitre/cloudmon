resource "aws_dynamodb_table" "events" {
  name         = "${var.project_name}-events"
  billing_mode = "PAY_PER_REQUEST"

  hash_key  = "service"
  range_key = "timestamp"

  attribute {
    name = "service"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  point_in_time_recovery {
    enabled = false
  }

  tags = {
    Name      = "${var.project_name}-events"
    Component = "storage"
  }
}

resource "aws_dynamodb_table" "alerts" {
  name         = "${var.project_name}-alerts"
  billing_mode = "PAY_PER_REQUEST"

  hash_key  = "alert_id"
  range_key = "timestamp"

  attribute {
    name = "alert_id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  point_in_time_recovery {
    enabled = false
  }

  tags = {
    Name      = "${var.project_name}-alerts"
    Component = "storage"
  }
}