variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "asia-northeast1"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "prod"
}

# Cloud Run設定
variable "backend_cpu" {
  description = "Backend CPU allocation"
  type        = string
  default     = "1"
}

variable "backend_memory" {
  description = "Backend memory allocation"
  type        = string
  default     = "512Mi"
}

variable "backend_min_instances" {
  description = "Minimum instances for backend"
  type        = number
  default     = 0
}

variable "backend_max_instances" {
  description = "Maximum instances for backend"
  type        = number
  default     = 10
}

variable "frontend_min_instances" {
  description = "Minimum instances for frontend"
  type        = number
  default     = 0
}

variable "frontend_max_instances" {
  description = "Maximum instances for frontend"
  type        = number
  default     = 5
}
