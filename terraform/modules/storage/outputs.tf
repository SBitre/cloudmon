output "events_table_name" {
  value       = aws_dynamodb_table.events.name
  description = "Name of the events DynamoDB table"
}

output "events_table_arn" {
  value       = aws_dynamodb_table.events.arn
  description = "ARN of the events DynamoDB table (for IAM policies)"
}

output "alerts_table_name" {
  value       = aws_dynamodb_table.alerts.name
  description = "Name of the alerts DynamoDB table"
}

output "alerts_table_arn" {
  value       = aws_dynamodb_table.alerts.arn
  description = "ARN of the alerts DynamoDB table"
}