# バックエンドサービス
resource "google_cloud_run_v2_service" "backend" {
  name     = "op-tcg-backend"
  location = var.region

  template {
    service_account = google_service_account.cloud_run_backend.email

    scaling {
      min_instance_count = var.backend_min_instances
      max_instance_count = var.backend_max_instances
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker_repo.repository_id}/backend:latest"

      resources {
        limits = {
          cpu    = var.backend_cpu
          memory = var.backend_memory
        }
      }

      # 環境変数
      env {
        name  = "CARD_IMAGES_BUCKET"
        value = google_storage_bucket.card_images.name
      }

      env {
        name  = "DATA_FILES_BUCKET"
        value = google_storage_bucket.data_files.name
      }

      env {
        name  = "GCS_PUBLIC_URL"
        value = "https://storage.googleapis.com/${google_storage_bucket.card_images.name}"
      }

      env {
        name  = "ALLOWED_ORIGINS"
        value = google_cloud_run_v2_service.frontend.uri
      }

      ports {
        container_port = 8000
      }

      startup_probe {
        http_get {
          path = "/api/cards"
        }
        initial_delay_seconds = 5
        period_seconds        = 10
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/api/cards"
        }
        period_seconds = 30
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_service.apis,
    google_cloud_run_v2_service.frontend
  ]
}

# フロントエンドサービス
resource "google_cloud_run_v2_service" "frontend" {
  name     = "op-tcg-frontend"
  location = var.region

  template {
    service_account = google_service_account.cloud_run_frontend.email

    scaling {
      min_instance_count = var.frontend_min_instances
      max_instance_count = var.frontend_max_instances
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker_repo.repository_id}/frontend:latest"

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle = true  # CPUをアイドル時にスロットル（コスト削減）
      }

      ports {
        container_port = 80
      }

      startup_probe {
        http_get {
          path = "/health"
        }
        initial_delay_seconds = 2
        period_seconds        = 5
        failure_threshold     = 3
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [google_project_service.apis]
}

# 公開アクセス設定（バックエンド）
resource "google_cloud_run_v2_service_iam_member" "backend_public" {
  location = google_cloud_run_v2_service.backend.location
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# 公開アクセス設定（フロントエンド）
resource "google_cloud_run_v2_service_iam_member" "frontend_public" {
  location = google_cloud_run_v2_service.frontend.location
  name     = google_cloud_run_v2_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
