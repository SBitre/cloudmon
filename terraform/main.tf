provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "cloudmon"
      ManagedBy = "terraform"
    }
  }
  
}

module "storage" {
  source = "./modules/storage"

  project_name = var.project_name
}