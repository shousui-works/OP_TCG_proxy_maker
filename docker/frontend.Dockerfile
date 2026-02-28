# ビルドステージ
FROM node:20-alpine AS builder

WORKDIR /app

# 依存関係をインストール
COPY frontend/package*.json ./
RUN npm ci

# ソースをコピー
COPY frontend/ ./

# ビルド時の環境変数（ARGで受け取る）
ARG VITE_API_BASE
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_ADMIN_EMAIL

# ビルド実行
RUN npm run build

# 実行ステージ (nginx)
FROM nginx:alpine

# カスタムnginx設定
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# ビルド成果物をコピー
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
