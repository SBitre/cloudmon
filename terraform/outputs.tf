output "events_table_name" {
  value       = module.storage.events_table_name
  description = "DynamoDB events table name"
}

output "events_table_arn" {
  value       = module.storage.events_table_arn
  description = "DynamoDB events table ARN"
}

output "alerts_table_name" {
  value       = module.storage.alerts_table_name
  description = "DynamoDB alerts table name"
}

output "alerts_table_arn" {
  value       = module.storage.alerts_table_arn
  description = "DynamoDB alerts table ARN"
}

output "ingest_api_endpoint" {
  value       = module.ingest.api_endpoint
  description = "Ingest API base URL"
}

output "ingest_events_post_url" {
  value       = module.ingest.events_post_url
  description = "Full URL for POSTing events"
}

output "ingest_lambda_log_group" {
  value       = module.ingest.lambda_log_group
  description = "CloudWatch log group for the ingest Lambda"
}

output "detection_lambda_name" {
  value       = module.detection.lambda_function_name
  description = "Detection Lambda function name"
}

output "detection_log_group" {
  value       = module.detection.lambda_log_group
  description = "Detection Lambda CloudWatch log group"
}

output "detection_schedule_rule" {
  value       = module.detection.schedule_rule_name
  description = "EventBridge rule name for detection schedule"
}

output "read_api_endpoint" {
  value       = module.read_api.api_endpoint
  description = "Read API base URL"
}

output "read_api_alerts_url" {
  value       = module.read_api.alerts_url
  description = "URL for GET /alerts"
}

output "read_api_events_volume_url" {
  value       = module.read_api.events_volume_url
  description = "URL for GET /events/volume"
}

output "read_api_log_group" {
  value       = module.read_api.lambda_log_group
  description = "CloudWatch log group for read API"
}