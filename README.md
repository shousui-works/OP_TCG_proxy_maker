# OP TCG Proxy Maker

ONE PIECE カードゲームのデッキビルダー＆プロキシメーカー

## 機能

- **カードクローラー**: 公式サイトからカード画像・情報を取得
- **デッキビルダー**: 50枚のデッキを構築するWebアプリ
- **ブランチ機能**: GitHubライクなブランチ管理で複数のデッキ構築案を並行管理

## セットアップ

### 必要なもの

- Python 3.12+
- Node.js 18+
- Chrome (クローラー用)
- [uv](https://docs.astral.sh/uv/) (Pythonパッケージマネージャー)

### インストール

```bash
# Python依存関係をインストール
uv sync

# フロントエンド依存関係をインストール
cd frontend && npm install
```

### 環境変数

`.env.example` を `.env` にコピーして設定:

```bash
cp .env.example .env
```

## 使い方

### 1. カード画像をダウンロード（クローラー）

```bash
# シリーズ一覧を表示
uv run python crawler.py --list

# 特定シリーズをクロール
uv run python crawler.py --series 569901

# 全シリーズをクロール
uv run python crawler.py --all

# 既存カードも強制的に再取得
uv run python crawler.py --all --force
```

カード画像は `cards/{series_id}/` に、カード情報は `data/all_cards.json` に保存されます。

#### GCSにアップロードする場合

```bash
# GCS認証
gcloud auth application-default login

# 環境変数を設定して実行
CARD_IMAGES_BUCKET=your-bucket-card-images \
DATA_FILES_BUCKET=your-bucket-data-files \
uv run python crawler.py --all
```

### 2. デッキビルダーを起動

ターミナル1: APIサーバー
```bash
uv run python server.py
```

ターミナル2: フロントエンド
```bash
cd frontend && npm run dev
```

ブラウザで http://localhost:5173/ を開く

## デッキビルダーの使い方

### 基本操作

| 操作 | 説明 |
|------|------|
| カードをクリック | デッキに追加（最大4枚） |
| +/- ボタン | 枚数を調整 |
| クリア | デッキをリセット |
| 保存 | 現在のブランチにデッキを保存 |

### ブランチ機能

GitHubのようにブランチを使ってデッキ構築案を管理:

| 機能 | 説明 |
|------|------|
| main | メインのデッキ（削除不可） |
| + 新規ブランチ | 現在のデッキから派生して新しいブランチを作成 |
| チェックアウト | 左サイドバーのブランチをクリックして切り替え |
| マージ | 作業ブランチのデッキをmainに統合 |
| × | ブランチを削除 |

### ワークフロー例

1. mainでベースとなるデッキを作成して保存
2. 「+ 新規ブランチ」で`aggressive`ブランチを作成
3. 攻撃的な構築に調整して保存
4. 「+ 新規ブランチ」で`control`ブランチも作成
5. 比較検討して、良い方を「マージ」でmainに反映

## プロジェクト構造

```text
OP_tcg_proxy_maker/
├── crawler.py       # カード画像クローラー
├── server.py        # FastAPI バックエンド
├── cards/           # ダウンロードしたカード画像
├── data/            # カード・デッキデータ (JSON)
├── frontend/        # React フロントエンド
├── docker/          # Dockerfiles
└── terraform/       # インフラ定義 (GCP)
```

## デプロイ

Cloud Run にデプロイする場合は `terraform/` を参照。

## 技術スタック

- **バックエンド**: Python, FastAPI, Selenium
- **フロントエンド**: React, TypeScript, Vite
- **インフラ**: GCP (Cloud Run, Cloud Storage), Terraform
- **認証**: Firebase Authentication

## ライセンス

MIT
