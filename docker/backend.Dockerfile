# ビルドステージ
FROM python:3.12-slim AS builder

WORKDIR /app

# uv をインストール
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# 依存関係をインストール
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# 実行ステージ
FROM python:3.12-slim

WORKDIR /app

# 仮想環境をコピー
COPY --from=builder /app/.venv /app/.venv

# アプリケーションコードをコピー
COPY backend/ ./backend/
COPY server.py ./

# dataディレクトリを作成（ローカル開発用）
RUN mkdir -p data cards

# 環境変数設定
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1

# 非rootユーザーで実行
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
