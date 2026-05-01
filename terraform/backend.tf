terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"   
    }
  }

  backend "s3" {
    bucket         = "cloudmon-tfstate-groupfour"
    key            = "infra/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "cloudmon-tfstate-lock"
    encrypt        = true
  }
}