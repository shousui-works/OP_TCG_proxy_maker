# Terraform state管理用のGCSバックエンド
# 注意: このバケットは事前に手動で作成する必要があります
# gsutil mb gs://op-tcg-project-terraform-state

terraform {
  backend "gcs" {
    bucket = "op-tcg-project-terraform-state"
    prefix = "terraform/state"
  }
}
