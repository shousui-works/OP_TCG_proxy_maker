# カード画像用バケット（公開）
resource "google_storage_bucket" "card_images" {
  name          = "${var.project_id}-card-images"
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access = true
  public_access_prevention    = "inherited"

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD"]
    response_header = ["Content-Type", "Cache-Control"]
    max_age_seconds = 3600
  }

  versioning {
    enabled = false
  }
}

# カード画像の公開設定
resource "google_storage_bucket_iam_member" "card_images_public" {
  bucket = google_storage_bucket.card_images.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# データファイル用バケット（非公開）
resource "google_storage_bucket" "data_files" {
  name          = "${var.project_id}-data-files"
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  versioning {
    enabled = true
  }
}
