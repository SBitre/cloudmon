output "api_endpoint" {
  value       = aws_apigatewayv2_api.ingest.api_endpoint
  description = "Base URL of the ingest API (append /events for the POST route)"
}

output "events_post_url" {
  value       = "${aws_apigatewayv2_api.ingest.api_endpoint}/events"
  description = "Full URL for posting events"
}

output "lambda_function_name" {
  value       = aws_lambda_function.ingest.function_name
  description = "Name of the ingest Lambda function"
}

output "lambda_log_group" {
  value       = aws_cloudwatch_log_group.ingest_lambda.name
  description = "CloudWatch log group for the ingest Lambda"
}