# ============================================================================
# S3 bucket for dashboard static files
# ============================================================================

resource "aws_s3_bucket" "dashboard" {
  bucket = "${var.project_name}-dashboard"

  tags = {
    Project = var.project_name
    Purpose = "Dashboard static hosting"
  }
}

# Block all public access — bucket is private, only CloudFront can read it
resource "aws_s3_bucket_public_access_block" "dashboard" {
  bucket = aws_s3_bucket.dashboard.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Versioning helps if we accidentally overwrite something
resource "aws_s3_bucket_versioning" "dashboard" {
  bucket = aws_s3_bucket.dashboard.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Server-side encryption (AES-256, AWS-managed keys)
resource "aws_s3_bucket_server_side_encryption_configuration" "dashboard" {
  bucket = aws_s3_bucket.dashboard.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# ============================================================================
# CloudFront Origin Access Control (OAC) — modern replacement for OAI
# Lets CloudFront read from the private S3 bucket without making it public
# ============================================================================

resource "aws_cloudfront_origin_access_control" "dashboard" {
  name                              = "${var.project_name}-dashboard-oac"
  description                       = "OAC for ${var.project_name} dashboard S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ============================================================================
# CloudFront distribution — global CDN with HTTPS in front of S3
# ============================================================================

resource "aws_cloudfront_distribution" "dashboard" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  comment             = "${var.project_name} dashboard distribution"
  price_class         = "PriceClass_100" # US, Canada, Europe — cheapest tier

  origin {
    domain_name              = aws_s3_bucket.dashboard.bucket_regional_domain_name
    origin_id                = "s3-${aws_s3_bucket.dashboard.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.dashboard.id
  }

  default_cache_behavior {
    target_origin_id       = "s3-${aws_s3_bucket.dashboard.id}"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    # Use the AWS-managed CachingOptimized policy
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  # SPA-style 404 handling: redirect 404s to index.html with a 200 status
  # Next.js routing handles the rest client-side
  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Project = var.project_name
    Purpose = "Dashboard CDN"
  }
}

# ============================================================================
# S3 bucket policy — allow only this CloudFront distribution to read
# ============================================================================

data "aws_iam_policy_document" "dashboard_bucket" {
  statement {
    sid     = "AllowCloudFrontServicePrincipalRead"
    effect  = "Allow"
    actions = ["s3:GetObject"]

    resources = ["${aws_s3_bucket.dashboard.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.dashboard.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "dashboard" {
  bucket = aws_s3_bucket.dashboard.id
  policy = data.aws_iam_policy_document.dashboard_bucket.json
}