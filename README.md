# OP TCG Proxy Maker

ONE PIECE カードゲームのデッキビルダー＆プロキシメーカー

## 機能

- **カードクローラー**: 公式サイトからカード画像を取得
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

## 使い方

### 1. カード画像をダウンロード

```bash
uv run python crawler.py
```

カード画像は `cards/` フォルダに保存されます。

`crawler.py` の `series_url` を変更して別のシリーズを取得できます:

```python
series_url = "https://www.onepiece-cardgame.com/cardlist/?series=550115"
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

```
OP_tcg_proxy_maker/
├── crawler.py       # カード画像クローラー
├── server.py        # FastAPI バックエンド
├── cards/           # ダウンロードしたカード画像
├── data/            # デッキ・ブランチデータ (JSON)
├── frontend/        # React フロントエンド
│   └── src/
│       ├── App.tsx
│       └── App.css
└── pyproject.toml   # Python プロジェクト設定
```

## 技術スタック

- **バックエンド**: Python, FastAPI, Selenium
- **フロントエンド**: React, TypeScript, Vite
- **データ**: JSON ファイル

## ライセンス

MIT
