#!/bin/bash
set -e

# 色付き出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# プロジェクト設定
PROJECT_ID="op-tcg-project"
REGION="asia-northeast1"
REPO="op-tcg-images"

# 本番環境設定
PROD_API_BASE="https://op-tcg-backend-265857555428.asia-northeast1.run.app"

# Firebase設定（.envから読み込むか、ここに直接記載）
VITE_FIREBASE_API_KEY="AIzaSyCvuZTThBROfGsLbhFytL9Oxt_MJt4R3yc"
VITE_FIREBASE_AUTH_DOMAIN="op-tcg-proxy-maker.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="op-tcg-proxy-maker"
VITE_FIREBASE_STORAGE_BUCKET="op-tcg-proxy-maker.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="34223040991"
VITE_FIREBASE_APP_ID="1:34223040991:web:effbe8d8c32b259a9a3c6a"
VITE_ADMIN_EMAIL="shousui.works@gmail.com"

# スクリプトのディレクトリに移動
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo -e "${GREEN}=== OP TCG デプロイスクリプト ===${NC}"
echo "プロジェクト: $PROJECT_ID"
echo "リージョン: $REGION"
echo ""

# 引数チェック
DEPLOY_TARGET="${1:-all}"

case $DEPLOY_TARGET in
  frontend|f)
    DEPLOY_FRONTEND=true
    DEPLOY_BACKEND=false
    ;;
  backend|b)
    DEPLOY_FRONTEND=false
    DEPLOY_BACKEND=true
    ;;
  all|a)
    DEPLOY_FRONTEND=true
    DEPLOY_BACKEND=true
    ;;
  *)
    echo -e "${RED}使用方法: $0 [frontend|backend|all]${NC}"
    echo "  frontend (f): フロントエンドのみデプロイ"
    echo "  backend (b):  バックエンドのみデプロイ"
    echo "  all (a):      両方デプロイ（デフォルト）"
    exit 1
    ;;
esac

# Docker認証
echo -e "${YELLOW}>>> Docker認証中...${NC}"
gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet

# フロントエンドのデプロイ
if [ "$DEPLOY_FRONTEND" = true ]; then
  echo ""
  echo -e "${GREEN}=== フロントエンドのビルド＆デプロイ ===${NC}"

  FRONTEND_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/frontend:latest"

  echo -e "${YELLOW}>>> Dockerイメージをビルド中...${NC}"
  docker build \
    --platform linux/amd64 \
    -f docker/frontend.Dockerfile \
    --build-arg VITE_API_BASE="$PROD_API_BASE" \
    --build-arg VITE_FIREBASE_API_KEY="$VITE_FIREBASE_API_KEY" \
    --build-arg VITE_FIREBASE_AUTH_DOMAIN="$VITE_FIREBASE_AUTH_DOMAIN" \
    --build-arg VITE_FIREBASE_PROJECT_ID="$VITE_FIREBASE_PROJECT_ID" \
    --build-arg VITE_FIREBASE_STORAGE_BUCKET="$VITE_FIREBASE_STORAGE_BUCKET" \
    --build-arg VITE_FIREBASE_MESSAGING_SENDER_ID="$VITE_FIREBASE_MESSAGING_SENDER_ID" \
    --build-arg VITE_FIREBASE_APP_ID="$VITE_FIREBASE_APP_ID" \
    --build-arg VITE_ADMIN_EMAIL="$VITE_ADMIN_EMAIL" \
    -t "$FRONTEND_IMAGE" \
    .

  echo -e "${YELLOW}>>> イメージをプッシュ中...${NC}"
  docker push "$FRONTEND_IMAGE"

  echo -e "${YELLOW}>>> Cloud Runにデプロイ中...${NC}"
  gcloud run deploy op-tcg-frontend \
    --image "$FRONTEND_IMAGE" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --quiet

  echo -e "${GREEN}>>> フロントエンドのデプロイ完了！${NC}"
fi

# バックエンドのデプロイ
if [ "$DEPLOY_BACKEND" = true ]; then
  echo ""
  echo -e "${GREEN}=== バックエンドのビルド＆デプロイ ===${NC}"

  BACKEND_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/backend:latest"

  echo -e "${YELLOW}>>> Dockerイメージをビルド中...${NC}"
  docker build \
    --platform linux/amd64 \
    -f docker/backend.Dockerfile \
    -t "$BACKEND_IMAGE" \
    .

  echo -e "${YELLOW}>>> イメージをプッシュ中...${NC}"
  docker push "$BACKEND_IMAGE"

  echo -e "${YELLOW}>>> Cloud Runにデプロイ中...${NC}"
  gcloud run deploy op-tcg-backend \
    --image "$BACKEND_IMAGE" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --set-env-vars "CARD_IMAGES_BUCKET=op-tcg-project-card-images,DATA_FILES_BUCKET=op-tcg-project-data-files,GCS_PUBLIC_URL=https://storage.googleapis.com/op-tcg-project-card-images,ALLOWED_ORIGINS=https://op-tcg-frontend-265857555428.asia-northeast1.run.app" \
    --quiet

  echo -e "${GREEN}>>> バックエンドのデプロイ完了！${NC}"
fi

echo ""
echo -e "${GREEN}=== デプロイ完了 ===${NC}"
echo "フロントエンド: https://op-tcg-frontend-265857555428.asia-northeast1.run.app"
echo "バックエンド: https://op-tcg-backend-265857555428.asia-northeast1.run.app"
