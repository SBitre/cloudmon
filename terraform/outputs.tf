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