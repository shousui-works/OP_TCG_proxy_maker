output "backend_url" {
  description = "Backend Cloud Run URL"
  value       = google_cloud_run_v2_service.backend.uri
}

output "frontend_url" {
  description = "Frontend Cloud Run URL"
  value       = google_cloud_run_v2_service.frontend.uri
}

output "card_images_bucket" {
  description = "Card images bucket name"
  value       = google_storage_bucket.card_images.name
}

output "card_images_public_url" {
  description = "Card images public URL"
  value       = "https://storage.googleapis.com/${google_storage_bucket.card_images.name}"
}

output "data_files_bucket" {
  description = "Data files bucket name"
  value       = google_storage_bucket.data_files.name
}

output "artifact_registry_url" {
  description = "Artifact Registry URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker_repo.repository_id}"
}

output "backend_service_account" {
  description = "Backend service account email"
  value       = google_service_account.cloud_run_backend.email
}

output "github_actions_service_account" {
  description = "GitHub Actions service account email"
  value       = google_service_account.github_actions.email
}
