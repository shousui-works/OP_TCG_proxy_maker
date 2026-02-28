# Cloud Run Backend用サービスアカウント
resource "google_service_account" "cloud_run_backend" {
  account_id   = "cloud-run-backend"
  display_name = "Cloud Run Backend Service Account"
}

# Cloud Run Frontend用サービスアカウント
resource "google_service_account" "cloud_run_frontend" {
  account_id   = "cloud-run-frontend"
  display_name = "Cloud Run Frontend Service Account"
}

# GitHub Actions用サービスアカウント
resource "google_service_account" "github_actions" {
  account_id   = "github-actions"
  display_name = "GitHub Actions Service Account"
}

# バックエンドがCloud Storageにアクセス
resource "google_storage_bucket_iam_member" "backend_card_images" {
  bucket = google_storage_bucket.card_images.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.cloud_run_backend.email}"
}

resource "google_storage_bucket_iam_member" "backend_data_files" {
  bucket = google_storage_bucket.data_files.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.cloud_run_backend.email}"
}

# GitHub ActionsにCloud Run管理権限
resource "google_project_iam_member" "github_actions_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

# GitHub ActionsにArtifact Registry書き込み権限
resource "google_project_iam_member" "github_actions_artifact_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

# GitHub ActionsがCloud Runサービスアカウントとして動作できるようにする
resource "google_service_account_iam_member" "github_actions_act_as_backend" {
  service_account_id = google_service_account.cloud_run_backend.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_service_account_iam_member" "github_actions_act_as_frontend" {
  service_account_id = google_service_account.cloud_run_frontend.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.github_actions.email}"
}

# Workload Identity Federation (GitHub Actions用)
resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github-pool"
  display_name              = "GitHub Actions Pool"
  description               = "Identity pool for GitHub Actions"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  display_name                       = "GitHub Provider"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
  }

  # attribute conditionはプロバイダのclaimを参照する必要がある
  attribute_condition = "assertion.repository == 'usuishouhei/OP_tcg_proxy_maker'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# GitHub ActionsがWorkload Identity Federationを使用できるようにする
resource "google_service_account_iam_member" "github_workload_identity" {
  service_account_id = google_service_account.github_actions.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/usuishouhei/OP_tcg_proxy_maker"
}
