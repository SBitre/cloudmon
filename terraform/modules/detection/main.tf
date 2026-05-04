data "archive_file" "detection_zip" {
  type        = "zip"
  source_dir  = var.lambda_source_dir
  output_path = "${path.module}/detection.zip"
}

resource "aws_iam_role" "detection_lambda" {
  name = "${var.project_name}-detection-lambda-role"

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

resource "aws_iam_role_policy_attachment" "detection_lambda_basic" {
  role       = aws_iam_role.detection_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "detection_dynamodb" {
  name = "${var.project_name}-detection-dynamodb"
  role = aws_iam_role.detection_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:GetItem",
        ]
        Resource = var.events_table_arn
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
        ]
        Resource = var.alerts_table_arn
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "detection_lambda" {
  name              = "/aws/lambda/${var.project_name}-detection"
  retention_in_days = 7
}

resource "aws_lambda_function" "detection" {
  function_name = "${var.project_name}-detection"
  role          = aws_iam_role.detection_lambda.arn

  filename         = data.archive_file.detection_zip.output_path
  source_code_hash = data.archive_file.detection_zip.output_base64sha256

  handler = "handler.lambda_handler"
  runtime = "python3.12"

  timeout     = 90
  memory_size = 512

  environment {
    variables = {
      EVENTS_TABLE_NAME = var.events_table_name
      ALERTS_TABLE_NAME = var.alerts_table_name
      LOG_LEVEL         = "INFO"
      GEMINI_API_KEY    = var.gemini_api_key
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.detection_lambda_basic,
    aws_cloudwatch_log_group.detection_lambda,
  ]
}

resource "aws_cloudwatch_event_rule" "detection_schedule" {
  name                = "${var.project_name}-detection-schedule"
  description         = "Trigger detection Lambda on a schedule"
  schedule_expression = var.schedule_expression
}

resource "aws_cloudwatch_event_target" "detection_lambda_target" {
  rule      = aws_cloudwatch_event_rule.detection_schedule.name
  target_id = "DetectionLambda"
  arn       = aws_lambda_function.detection.arn
}

resource "aws_lambda_permission" "eventbridge_invoke" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.detection.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.detection_schedule.arn
}