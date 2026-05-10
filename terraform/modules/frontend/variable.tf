variable "project_name" {
  type        = string
  description = "Prefix for all resource names (e.g., 'cloudmon')"
}

variable "aws_region" {
  type        = string
  description = "AWS region for resources that support regional configuration"
  default     = "us-east-1"
}