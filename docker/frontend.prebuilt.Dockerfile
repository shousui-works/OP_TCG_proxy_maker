# プリビルド済みフロントエンド用Dockerfile
# GitHub Actionsでビルド＆プリレンダリング済みのファイルを使用

FROM nginx:alpine

# カスタムnginx設定
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# プリレンダリング済みのビルド成果物をコピー
COPY frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
