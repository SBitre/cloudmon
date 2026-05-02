# -----------------------------------------------------------------------------
# Package Lambda source code into a zip
# -----------------------------------------------------------------------------
data "archive_file" "ingest_zip" {
  type        = "zip"
  source_dir  = var.lambda_source_dir
  output_path = "${path.module}/ingest.zip"
}

# -----------------------------------------------------------------------------
# IAM role the Lambda assumes when it executes
# -----------------------------------------------------------------------------
resource "aws_iam_role" "ingest_lambda" {
  name = "${var.project_name}-ingest-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

# Allow Lambda to write logs to CloudWatch
resource "aws_iam_role_policy_attachment" "ingest_lambda_basic" {
  role       = aws_iam_role.ingest_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Allow Lambda to write items into the events DynamoDB table (and ONLY that table)
resource "aws_iam_role_policy" "ingest_dynamodb_write" {
  name = "${var.project_name}-ingest-dynamodb-write"
  role = aws_iam_role.ingest_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:PutItem",
      ]
      Resource = var.events_table_arn
    }]
  })
}

# -----------------------------------------------------------------------------
# CloudWatch log group (created explicitly so we control retention)
# -----------------------------------------------------------------------------
resource "aws_cloudwatch_log_group" "ingest_lambda" {
  name              = "/aws/lambda/${var.project_name}-ingest"
  retention_in_days = 7
}

# -----------------------------------------------------------------------------
# Lambda function
# -----------------------------------------------------------------------------
resource "aws_lambda_function" "ingest" {
  function_name = "${var.project_name}-ingest"
  role          = aws_iam_role.ingest_lambda.arn

  filename         = data.archive_file.ingest_zip.output_path
  source_code_hash = data.archive_file.ingest_zip.output_base64sha256

  handler = "handler.lambda_handler"
  runtime = "python3.12"

  timeout     = 10
  memory_size = 256

  environment {
    variables = {
      EVENTS_TABLE_NAME = var.events_table_name
      LOG_LEVEL         = "INFO"
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.ingest_lambda_basic,
    aws_cloudwatch_log_group.ingest_lambda,
  ]
}

# -----------------------------------------------------------------------------
# API Gateway HTTP API (cheaper, simpler than REST API)
# -----------------------------------------------------------------------------
resource "aws_apigatewayv2_api" "ingest" {
  name          = "${var.project_name}-ingest-api"
  protocol_type = "HTTP"
  description   = "Public ingest endpoint for cloudmon events"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["POST", "OPTIONS"]
    allow_headers = ["Content-Type"]
  }
}

# Default stage that auto-deploys (so changes go live without manual steps)
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.ingest.id
  name        = "$default"
  auto_deploy = true
}

# Lambda integration
resource "aws_apigatewayv2_integration" "ingest_lambda" {
  api_id                 = aws_apigatewayv2_api.ingest.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.ingest.invoke_arn
  payload_format_version = "2.0"
}

# Route: POST /events -> Lambda
resource "aws_apigatewayv2_route" "post_events" {
  api_id    = aws_apigatewayv2_api.ingest.id
  route_key = "POST /events"
  target    = "integrations/${aws_apigatewayv2_integration.ingest_lambda.id}"
}

# Permission for API Gateway to invoke the Lambda
resource "aws_lambda_permission" "apigw_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ingest.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.ingest.execution_arn}/*/*"
}