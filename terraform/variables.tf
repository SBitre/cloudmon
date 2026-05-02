variable "aws_region" {
  type         = string
  default      = "us-east-1"
  description  = "AWS region for all resources"
}

variable "project_name" {
    type        = string
    default     = "cloudmon"
    description = "Prefix for all resource names"
  
}