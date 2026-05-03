variable "project_name" {
  type        = string
  description = "Prefix for all resource names" 
}

variable "events_table_name" {
  type        = string
  description = "Name of the events DynamoDB table" 
}

variable "events_table_arn" {
  type        = string
  description = "ARN of the events DynamoDB table"
}

variable "alerts_table_name" {
  type        = string
  description = "Name of the alerts DynamoDB table"
}

variable "alerts_table_arn" {
  type        = string
  description = "ARN of the alerts DynamoDB table"
}

variable "lambda_source_dir" {
  type        = string
  description = "Local path to the read API Lambda source directory"
  default     = "../lambdas/api"
}