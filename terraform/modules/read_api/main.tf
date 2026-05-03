data "archive_file" "read_api_zip" {
  type        = "zip"
  source_dir  = var.lambda_source_dir
  output_path = "${path.module}/read_api.zip"
}

# -----------------------------------------------------------------------------
# IAM role
# -----------------------------------------------------------------------------
resource "aws_iam_role" "read_api_lambda" {
  name = "${var.project_name}-read-api-lambda-role"

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

resource "aws_iam_role_policy_attachment" "read_api_lambda_basic" {
  role       = aws_iam_role.read_api_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Read-only access to both tables. NO write permissions.
resource "aws_iam_role_policy" "read_api_dynamodb" {
  name = "${var.project_name}-read-api-dynamodb"
  role = aws_iam_role.read_api_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:GetItem",
      ]
      Resource = [
        var.events_table_arn,
        var.alerts_table_arn,
      ]
    }]
  })
}

# -----------------------------------------------------------------------------
# CloudWatch log group
# -----------------------------------------------------------------------------
resource "aws_cloudwatch_log_group" "read_api_lambda" {
  name              = "/aws/lambda/${var.project_name}-read-api"
  retention_in_days = 7
}

# -----------------------------------------------------------------------------
# Lambda function
# -----------------------------------------------------------------------------
resource "aws_lambda_function" "read_api" {
  function_name = "${var.project_name}-read-api"
  role          = aws_iam_role.read_api_lambda.arn

  filename         = data.archive_file.read_api_zip.output_path
  source_code_hash = data.archive_file.read_api_zip.output_base64sha256

  handler = "handler.lambda_handler"
  runtime = "python3.12"

  timeout     = 10
  memory_size = 256

  environment {
    variables = {
      EVENTS_TABLE_NAME = var.events_table_name
      ALERTS_TABLE_NAME = var.alerts_table_name
      LOG_LEVEL         = "INFO"
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.read_api_lambda_basic,
    aws_cloudwatch_log_group.read_api_lambda,
  ]
}

# -----------------------------------------------------------------------------
# API Gateway HTTP API
# -----------------------------------------------------------------------------
resource "aws_apigatewayv2_api" "read_api" {
  name          = "${var.project_name}-read-api"
  protocol_type = "HTTP"
  description   = "Read API for cloudmon dashboard"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "OPTIONS"]
    allow_headers = ["Content-Type"]
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.read_api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_apigatewayv2_integration" "read_api_lambda" {
  api_id                 = aws_apigatewayv2_api.read_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.read_api.invoke_arn
  payload_format_version = "2.0"
}

# Two routes: GET /alerts and GET /events/volume
resource "aws_apigatewayv2_route" "get_alerts" {
  api_id    = aws_apigatewayv2_api.read_api.id
  route_key = "GET /alerts"
  target    = "integrations/${aws_apigatewayv2_integration.read_api_lambda.id}"
}

resource "aws_apigatewayv2_route" "get_events_volume" {
  api_id    = aws_apigatewayv2_api.read_api.id
  route_key = "GET /events/volume"
  target    = "integrations/${aws_apigatewayv2_integration.read_api_lambda.id}"
}

resource "aws_lambda_permission" "apigw_invoke_read" {
  statement_id  = "AllowAPIGatewayInvokeRead"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.read_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.read_api.execution_arn}/*/*"
}