"""
カード画像配信用のAPIサーバー + デッキブランチ管理
"""

import io
import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Response
from PIL import Image
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, field_validator

# .envファイルを読み込む
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip())

# 環境変数から設定を取得
CARD_IMAGES_BUCKET = os.environ.get("CARD_IMAGES_BUCKET")
DATA_FILES_BUCKET = os.environ.get("DATA_FILES_BUCKET")
GCS_PUBLIC_URL = os.environ.get("GCS_PUBLIC_URL")
USE_GCS = bool(CARD_IMAGES_BUCKET)

# CORS許可オリジン（環境変数から取得、カンマ区切り）
ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",")

# ブランチ名・カードIDの検証パターン
SAFE_NAME_PATTERN = re.compile(r"^[a-zA-Z0-9_\-]+$")

app = FastAPI(title="OP TCG Deck Builder API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

BASE_DIR = Path(__file__).parent
CARDS_DIR = BASE_DIR / "cards"
DATA_DIR = BASE_DIR / "data"
THUMB_CACHE_DIR = BASE_DIR / "cache" / "thumbnails"
DECKS_FILE = DATA_DIR / "decks.json"
CARDS_DATA_FILE = DATA_DIR / "all_cards.json"
SERIES_DATA_FILE = DATA_DIR / "series_data.json"

# サムネイルサイズ設定
THUMBNAIL_SIZES = {
    "xs": 60,   # デッキリスト用
    "sm": 120,  # モバイルカードグリッド用
    "md": 180,  # デスクトップカードグリッド用
}

# GCS使用時はCloud Storageクライアントを初期化
gcs_client = None
if USE_GCS:
    try:
        from google.cloud import storage
        gcs_client = storage.Client()
    except ImportError:
        print("Warning: google-cloud-storage not installed, GCS disabled")
        USE_GCS = False


class DeckCard(BaseModel):
    id: str
    name: str
    image: str
    count: int


class LeaderCard(BaseModel):
    id: str
    name: str
    image: str
    color: Optional[str] = None


class Branch(BaseModel):
    name: str
    deck: list[DeckCard]
    leader: Optional[LeaderCard] = None
    parent: Optional[str] = None
    created_at: str
    updated_at: str


def validate_safe_name(name: str, field_name: str = "name") -> str:
    """名前を検証（パストラバーサル・インジェクション防止）"""
    if not name or not SAFE_NAME_PATTERN.match(name):
        raise ValueError(
            f"Invalid {field_name}: only alphanumeric, underscore, and hyphen allowed"
        )
    if len(name) > 100:
        raise ValueError(f"{field_name} is too long (max 100 characters)")
    return name


class CreateBranchRequest(BaseModel):
    name: str
    from_branch: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        return validate_safe_name(v, "branch name")

    @field_validator("from_branch")
    @classmethod
    def validate_from_branch(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return validate_safe_name(v, "from_branch")
        return v


class SaveDeckRequest(BaseModel):
    branch: str
    deck: list[DeckCard]
    leader: Optional[LeaderCard] = None

    @field_validator("branch")
    @classmethod
    def validate_branch(cls, v: str) -> str:
        return validate_safe_name(v, "branch name")


class MergeRequest(BaseModel):
    source: str
    target: str

    @field_validator("source", "target")
    @classmethod
    def validate_branches(cls, v: str) -> str:
        return validate_safe_name(v, "branch name")


def load_data() -> dict:
    """データを読み込む"""
    DATA_DIR.mkdir(exist_ok=True)
    if not DECKS_FILE.exists():
        initial_data = {
            "current_branch": "main",
            "branches": {
                "main": {
                    "name": "main",
                    "deck": [],
                    "leader": None,
                    "parent": None,
                    "created_at": datetime.now().isoformat(),
                    "updated_at": datetime.now().isoformat(),
                }
            }
        }
        save_data(initial_data)
        return initial_data
    with open(DECKS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_data(data: dict):
    """データを保存"""
    DATA_DIR.mkdir(exist_ok=True)
    with open(DECKS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# --- カードAPI ---

@app.get("/api/cards")
def list_cards():
    """利用可能なカード一覧を返す（シリーズ別ディレクトリ対応）"""
    # GCS使用時はGCSからカード一覧を取得
    if USE_GCS and gcs_client and CARD_IMAGES_BUCKET:
        return _list_cards_from_gcs()

    # ローカルファイルから取得
    return _list_cards_from_local()


def _list_cards_from_gcs():
    """GCSからカード一覧を取得"""
    cards = []
    bucket = gcs_client.bucket(CARD_IMAGES_BUCKET)
    blobs = bucket.list_blobs()

    for blob in blobs:
        if not blob.name.endswith(".png"):
            continue

        parts = blob.name.rsplit("/", 1)
        if len(parts) == 2:
            # シリーズ/カードID.png 形式
            series_id, filename = parts
            card_id = filename.replace(".png", "")
            cards.append({
                "id": card_id,
                "name": card_id,
                "series_id": series_id,
                "image": f"/api/cards/{series_id}/{card_id}/image",
            })
        else:
            # カードID.png 形式（旧形式）
            card_id = blob.name.replace(".png", "")
            cards.append({
                "id": card_id,
                "name": card_id,
                "series_id": None,
                "image": f"/api/cards/{card_id}/image",
            })

    return {"cards": sorted(cards, key=lambda x: (x["series_id"] or "", x["id"]))}


def _list_cards_from_local():
    """ローカルファイルからカード一覧を取得"""
    if not CARDS_DIR.exists():
        return {"cards": []}

    cards = []
    # シリーズディレクトリを走査
    for series_dir in sorted(CARDS_DIR.iterdir()):
        if series_dir.is_dir():
            series_id = series_dir.name
            for img_path in sorted(series_dir.glob("*.png")):
                card_id = img_path.stem
                cards.append({
                    "id": card_id,
                    "name": card_id,
                    "series_id": series_id,
                    "image": f"/api/cards/{series_id}/{card_id}/image",
                })

    # 旧形式（直下のファイル）も対応
    for img_path in sorted(CARDS_DIR.glob("*.png")):
        card_id = img_path.stem
        cards.append({
            "id": card_id,
            "name": card_id,
            "series_id": None,
            "image": f"/api/cards/{card_id}/image",
        })

    return {"cards": cards}


def validate_path_component(name: str, component_type: str = "name") -> None:
    """パスコンポーネントを検証（パストラバーサル防止）"""
    if not name or not SAFE_NAME_PATTERN.match(name):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {component_type}: "
            "only alphanumeric, underscore, and hyphen allowed",
        )


@app.get("/api/cards/{series_id}/{card_id}/image")
def get_card_image_by_series(series_id: str, card_id: str):
    """シリーズ別カード画像を返す"""
    validate_path_component(series_id, "series_id")
    validate_path_component(card_id, "card_id")

    # GCS使用時はリダイレクト
    if USE_GCS and GCS_PUBLIC_URL:
        gcs_url = f"{GCS_PUBLIC_URL}/{series_id}/{card_id}.png"
        return RedirectResponse(url=gcs_url, status_code=302)

    # ローカルファイルから配信
    img_path = CARDS_DIR / series_id / f"{card_id}.png"

    # 追加のセキュリティチェック: パスがCARDS_DIR内に収まっているか確認
    try:
        img_path.resolve().relative_to(CARDS_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path")

    if not img_path.exists():
        raise HTTPException(status_code=404, detail="Card not found")
    with open(img_path, "rb") as f:
        content = f.read()
    return Response(
        content=content,
        media_type="image/png",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=86400",
        },
    )


@app.get("/api/cards/{card_id}/image")
def get_card_image(card_id: str):
    """カード画像を返す（旧形式互換）"""
    validate_path_component(card_id, "card_id")

    # GCS使用時はリダイレクト
    if USE_GCS and GCS_PUBLIC_URL:
        gcs_url = f"{GCS_PUBLIC_URL}/{card_id}.png"
        return RedirectResponse(url=gcs_url, status_code=302)

    # ローカルファイルから配信
    img_path = CARDS_DIR / f"{card_id}.png"

    # 追加のセキュリティチェック: パスがCARDS_DIR内に収まっているか確認
    try:
        img_path.resolve().relative_to(CARDS_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path")

    if not img_path.exists():
        raise HTTPException(status_code=404, detail="Card not found")
    with open(img_path, "rb") as f:
        content = f.read()
    return Response(
        content=content,
        media_type="image/png",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=86400",
        },
    )


def _generate_thumbnail(img_path: Path, size: int) -> bytes:
    """サムネイルを生成してバイト列を返す"""
    with Image.open(img_path) as img:
        # アスペクト比を維持してリサイズ
        width, height = img.size
        ratio = size / width
        new_height = int(height * ratio)

        # LANCZOS（高品質）でリサイズ
        img_resized = img.resize((size, new_height), Image.Resampling.LANCZOS)

        # WebP形式で出力（高圧縮・高品質）
        buffer = io.BytesIO()
        img_resized.save(buffer, format="WEBP", quality=80)
        return buffer.getvalue()


def _get_or_create_thumbnail(
    img_path: Path, series_id: str | None, card_id: str, size_name: str
) -> bytes:
    """キャッシュからサムネイルを取得、なければ生成"""
    size = THUMBNAIL_SIZES.get(size_name, THUMBNAIL_SIZES["sm"])

    # キャッシュパスを構築
    if series_id:
        cache_path = THUMB_CACHE_DIR / size_name / series_id / f"{card_id}.webp"
    else:
        cache_path = THUMB_CACHE_DIR / size_name / f"{card_id}.webp"

    # キャッシュが存在すれば返す
    if cache_path.exists():
        with open(cache_path, "rb") as f:
            return f.read()

    # サムネイルを生成
    content = _generate_thumbnail(img_path, size)

    # キャッシュに保存
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    with open(cache_path, "wb") as f:
        f.write(content)

    return content


@app.get("/api/cards/{series_id}/{card_id}/thumb")
def get_card_thumbnail_by_series(
    series_id: str,
    card_id: str,
    size: str = Query(default="sm", pattern="^(xs|sm|md)$"),
):
    """シリーズ別カードのサムネイル画像を返す"""
    validate_path_component(series_id, "series_id")
    validate_path_component(card_id, "card_id")

    # ローカルファイルのパス
    img_path = CARDS_DIR / series_id / f"{card_id}.png"

    # セキュリティチェック
    try:
        img_path.resolve().relative_to(CARDS_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path")

    if not img_path.exists():
        raise HTTPException(status_code=404, detail="Card not found")

    content = _get_or_create_thumbnail(img_path, series_id, card_id, size)
    return Response(
        content=content,
        media_type="image/webp",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=604800",  # 1週間キャッシュ
        },
    )


@app.get("/api/cards/{card_id}/thumb")
def get_card_thumbnail(
    card_id: str,
    size: str = Query(default="sm", pattern="^(xs|sm|md)$"),
):
    """カードのサムネイル画像を返す（旧形式互換）"""
    validate_path_component(card_id, "card_id")

    # ローカルファイルのパス
    img_path = CARDS_DIR / f"{card_id}.png"

    # セキュリティチェック
    try:
        img_path.resolve().relative_to(CARDS_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path")

    if not img_path.exists():
        raise HTTPException(status_code=404, detail="Card not found")

    content = _get_or_create_thumbnail(img_path, None, card_id, size)
    return Response(
        content=content,
        media_type="image/webp",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=604800",  # 1週間キャッシュ
        },
    )


# --- ブランチAPI ---

@app.get("/api/branches")
def list_branches():
    """ブランチ一覧を取得"""
    data = load_data()
    branches = []
    for name, branch in data["branches"].items():
        deck_count = sum(card["count"] for card in branch["deck"])
        branches.append({
            "name": name,
            "parent": branch.get("parent"),
            "deck_count": deck_count,
            "created_at": branch["created_at"],
            "updated_at": branch["updated_at"],
        })
    return {
        "current_branch": data["current_branch"],
        "branches": branches,
    }


@app.get("/api/branches/{branch_name}")
def get_branch(branch_name: str):
    """特定のブランチを取得"""
    data = load_data()
    if branch_name not in data["branches"]:
        raise HTTPException(status_code=404, detail="Branch not found")
    return data["branches"][branch_name]


@app.post("/api/branches")
def create_branch(request: CreateBranchRequest):
    """新しいブランチを作成"""
    data = load_data()

    if request.name in data["branches"]:
        raise HTTPException(status_code=400, detail="Branch already exists")

    parent_name = request.from_branch or data["current_branch"]
    if parent_name not in data["branches"]:
        raise HTTPException(status_code=400, detail="Parent branch not found")

    parent_branch = data["branches"][parent_name]
    parent_deck = parent_branch["deck"]
    parent_leader = parent_branch.get("leader")

    now = datetime.now().isoformat()
    data["branches"][request.name] = {
        "name": request.name,
        "deck": parent_deck.copy(),
        "leader": parent_leader,
        "parent": parent_name,
        "created_at": now,
        "updated_at": now,
    }

    save_data(data)
    return {"message": f"Branch '{request.name}' created from '{parent_name}'"}


@app.post("/api/branches/{branch_name}/checkout")
def checkout_branch(branch_name: str):
    """ブランチを切り替える"""
    data = load_data()

    if branch_name not in data["branches"]:
        raise HTTPException(status_code=404, detail="Branch not found")

    data["current_branch"] = branch_name
    save_data(data)

    return {
        "message": f"Switched to branch '{branch_name}'",
        "branch": data["branches"][branch_name]
    }


@app.delete("/api/branches/{branch_name}")
def delete_branch(branch_name: str):
    """ブランチを削除"""
    data = load_data()

    if branch_name == "main":
        raise HTTPException(status_code=400, detail="Cannot delete main branch")

    if branch_name not in data["branches"]:
        raise HTTPException(status_code=404, detail="Branch not found")

    if data["current_branch"] == branch_name:
        data["current_branch"] = "main"

    del data["branches"][branch_name]
    save_data(data)

    return {"message": f"Branch '{branch_name}' deleted"}


@app.post("/api/branches/merge")
def merge_branches(request: MergeRequest):
    """ブランチをマージ"""
    data = load_data()

    if request.source not in data["branches"]:
        raise HTTPException(status_code=404, detail="Source branch not found")
    if request.target not in data["branches"]:
        raise HTTPException(status_code=404, detail="Target branch not found")

    source_branch = data["branches"][request.source]
    data["branches"][request.target]["deck"] = source_branch["deck"].copy()
    data["branches"][request.target]["leader"] = source_branch.get("leader")
    data["branches"][request.target]["updated_at"] = datetime.now().isoformat()

    save_data(data)

    return {"message": f"Merged '{request.source}' into '{request.target}'"}


# --- デッキAPI ---

@app.post("/api/deck/save")
def save_deck(request: SaveDeckRequest):
    """現在のデッキをブランチに保存"""
    data = load_data()

    if request.branch not in data["branches"]:
        raise HTTPException(status_code=404, detail="Branch not found")

    data["branches"][request.branch]["deck"] = [
        card.model_dump() for card in request.deck
    ]
    data["branches"][request.branch]["leader"] = (
        request.leader.model_dump() if request.leader else None
    )
    data["branches"][request.branch]["updated_at"] = datetime.now().isoformat()

    save_data(data)

    return {"message": f"Deck saved to branch '{request.branch}'"}


@app.get("/api/deck/{branch_name}")
def get_deck(branch_name: str):
    """ブランチのデッキを取得"""
    data = load_data()

    if branch_name not in data["branches"]:
        raise HTTPException(status_code=404, detail="Branch not found")

    branch = data["branches"][branch_name]
    return {
        "deck": branch["deck"],
        "leader": branch.get("leader")
    }


# --- シリーズ・カードデータAPI ---

def _load_json_from_gcs(bucket_name: str, blob_name: str):
    """GCSからJSONファイルを読み込む"""
    if not gcs_client:
        return None
    try:
        bucket = gcs_client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        if not blob.exists():
            return None
        content = blob.download_as_text()
        return json.loads(content)
    except Exception as e:
        print(f"Error loading {blob_name} from GCS: {e}")
        return None


@app.get("/api/series")
def get_series():
    """シリーズ一覧を取得"""
    # GCS使用時はGCSから取得
    if USE_GCS and DATA_FILES_BUCKET:
        data = _load_json_from_gcs(DATA_FILES_BUCKET, "series_data.json")
        if data:
            return data

    # ローカルファイルから取得
    if not SERIES_DATA_FILE.exists():
        return {"series": [], "last_updated": None}

    with open(SERIES_DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/cards/data")
def get_cards_data():
    """保存済みのカードデータを取得"""
    # GCS使用時はGCSから取得
    if USE_GCS and DATA_FILES_BUCKET:
        data = _load_json_from_gcs(DATA_FILES_BUCKET, "all_cards.json")
        if data:
            return data

    # ローカルファイルから取得
    if not CARDS_DATA_FILE.exists():
        return {"cards": {}, "total_cards": 0, "crawled_at": None}

    with open(CARDS_DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="warning",  # アクセスログを抑制
    )
