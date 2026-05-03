output "api_endpoint" {
  value       = aws_apigatewayv2_api.read_api.api_endpoint
  description = "Base URL of the read API"
}

output "alerts_url" {
  value       = "${aws_apigatewayv2_api.read_api.api_endpoint}/alerts"
  description = "Full URL for GET /alerts"
}

output "events_volume_url" {
  value       = "${aws_apigatewayv2_api.read_api.api_endpoint}/events/volume"
  description = "Full URL for GET /events/volume"
}

output "lambda_function_name" {
  value       = aws_lambda_function.read_api.function_name
  description = "Name of the read API Lambda function"
}

output "lambda_log_group" {
  value       = aws_cloudwatch_log_group.read_api_lambda.name
  description = "CloudWatch log group for the read API Lambda"
}