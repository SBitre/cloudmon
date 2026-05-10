output "dashboard_bucket_name" {
  value       = aws_s3_bucket.dashboard.id
  description = "Name of the S3 bucket holding dashboard static files (use for aws s3 sync)"
}

output "dashboard_bucket_arn" {
  value       = aws_s3_bucket.dashboard.arn
  description = "ARN of the dashboard S3 bucket"
}

output "dashboard_cloudfront_domain" {
  value       = aws_cloudfront_distribution.dashboard.domain_name
  description = "CloudFront domain name (e.g., d1234567890.cloudfront.net) — this is the public URL"
}

output "dashboard_cloudfront_url" {
  value       = "https://${aws_cloudfront_distribution.dashboard.domain_name}"
  description = "Full HTTPS URL to access the dashboard"
}

output "dashboard_cloudfront_distribution_id" {
  value       = aws_cloudfront_distribution.dashboard.id
  description = "CloudFront distribution ID — needed for cache invalidation after redeploys"
}