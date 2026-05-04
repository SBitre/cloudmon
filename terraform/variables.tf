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

variable "gemini_api_key" {
  type        = string
  description = "Google Gemini API key (passed to detection Lambda)"
  sensitive   = true
}