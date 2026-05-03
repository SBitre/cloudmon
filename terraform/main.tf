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

module "ingest" {
  source = "./modules/ingest"

  project_name      = var.project_name
  events_table_name = module.storage.events_table_name
  events_table_arn  = module.storage.events_table_arn
}

module "detection" {
  source = "./modules/detection"

  project_name      = var.project_name
  events_table_name = module.storage.events_table_name
  events_table_arn  = module.storage.events_table_arn
  alerts_table_name = module.storage.alerts_table_name
  alerts_table_arn  = module.storage.alerts_table_arn
}