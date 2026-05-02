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