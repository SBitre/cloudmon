variable "project_name" {
  type        = string
  description = "Prefix for all resource names (e.g. 'cloudmon')"
}

variable "events_table_name" {
  type        = string
  description = "Name of the DynamoDB events table the Lambda writes to" 
}

variable "events_table_arn" {
  type        = string
  description = "ARN of the DynamboDB events table (used in IAM policy)" 
}

variable "lambda_source_dir" {
  type        = string
  description = "Local path to the Lambda source code directory"
  default     = "../lambdas/ingest"
}