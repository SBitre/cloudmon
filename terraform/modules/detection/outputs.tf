output "lambda_function_name" {
  value       = aws_lambda_function.detection.function_name
  description = "Name of the detection Lambda function"
}

output "lambda_log_group" {
  value       = aws_cloudwatch_log_group.detection_lambda.name
  description = "CloudWatch log group for the detection Lambda"
}

output "schedule_rule_name" {
  value       = aws_cloudwatch_event_rule.detection_schedule.name
  description = "Name of the EventBridge schedule rule"
}